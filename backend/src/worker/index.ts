import { Worker, Job } from "bullmq";
import fs from "fs";
import "dotenv/config";
import { Emitter } from "@socket.io/redis-emitter";
import { Store } from "@models/Store";
import { FileProcess, IFileProcess } from "@models/FileProcess";
import { countRows, processCsvFile, sendEmailSummary } from "worker/utils";
import { initDatabase, initMailer } from "worker/helpers";
import { storeQueue } from "queue";
import { Redis } from "ioredis";

const QUEUE_NAME = storeQueue.name;

// --- History & Tracker Helpers ---
async function emitHistory(userEmail: string, emitter: Emitter) {
  const history = await FileProcess.find({ userEmail })
    .sort({ createdAt: -1 })
    .select("_id status total processed success failed createdAt updatedAt")
    .lean();

  const current = history.find((h) => h.status === "processing");
  const currentStores = current
    ? await Store.find({ fileProcess: current._id })
        .select("_id fileProcess")
        .lean()
    : [];

  emitter.to(userEmail).emit("history", {
    list: history,
    currentProcessingId: current?._id.toString() || null,
    currentStores,
  });
}

async function updateTracker(id: any, fields: Partial<IFileProcess>) {
  await FileProcess.findByIdAndUpdate(id, fields);
}

// --- Core Job Handler ---
async function handleJob(
  job: Job<{ path: string; userEmail: string; fileProcessId: string }>,
  emitter: Emitter,
  transporter: ReturnType<typeof initMailer>
) {
  const { path, userEmail, fileProcessId } = job.data;
  const room = userEmail;

  // 1️⃣ Load the existing tracker doc:
  const tracker = await FileProcess.findById(fileProcessId)!;
   if (!tracker) {
    emitter.to(room).emit("error", `Tracker ${fileProcessId} not found`);
    throw new Error(`FileProcess ${fileProcessId} not found`);
  }

  // 2️⃣ Move it from "queued" to "processing":
  await tracker.updateOne({ status: "processing" });
  emitter.to(room).emit("fileProcessId", tracker._id.toString());
  emitter.to(room).emit("log", `👷 Job ${job.id} start | PID: ${tracker._id}`);
  await emitHistory(userEmail, emitter);

  // 2️⃣ Validate file exists
  if (!fs.existsSync(path)) {
    emitter.to(room).emit("error", "File not found");
    await updateTracker(tracker._id, { status: "failed" });
    throw new Error(`Missing file at ${path}`);
  }

  // 3️⃣ Count rows
  emitter.to(room).emit("log", "🔢 Counting rows...");
  const total = await countRows(path);
  emitter.to(room).emit("log", `📊 Total rows: ${total}`);
  await updateTracker(tracker._id, { total });

  // 4️⃣ Process CSV in batches
  const summary = await processCsvFile(
    path,
    tracker._id,
    emitter,
    (fields) => updateTracker(tracker._id, fields),
    total
  );

  // 5️⃣ Complete and summarize
  await updateTracker(tracker._id, {
    status: "completed",
    processed: summary.total,
    success: summary.success,
    failed: summary.failed,
    processingErrors: summary.errors,
  });
  emitter.to(room).emit("summary", {
    ...summary,
    processId: tracker._id.toString(),
  });

  // 6️⃣ Send summary email
  await sendEmailSummary(
    transporter,
    userEmail,
    summary,
    tracker._id.toString()
  );
}

// --- Worker Entry Point ---
(async () => {
  await initDatabase();
  const emitter = new Emitter(storeQueue.opts.connection as Redis);
  const transporter = initMailer();

 new Worker<{ path: string; userEmail: string; fileProcessId: string }>(
  QUEUE_NAME,
  (job) => handleJob(job, emitter, transporter),
  { connection: storeQueue.opts.connection }
);

})();
