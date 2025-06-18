import { Worker, Job } from "bullmq";
import fs from "fs";
import "dotenv/config";
import { Emitter } from "@socket.io/redis-emitter";
import { Store } from "./models/Store";
import { FileProcess, IFileProcess } from "./models/FileProcess";
import { countRows, processCsvFile, sendEmailSummary } from "worker/utils";
import { initDatabase, initEmitter, initMailer } from "worker/helpers";


// --- Core Job Handler ---
async function handleJob(
  job: Job<{ path: string; userEmail: string }>,
  emitter: Emitter,
  transporter: ReturnType<typeof initMailer>
) {
  const { path, userEmail } = job.data;
  const room = userEmail;

  // 1️⃣ Create FileProcess tracker
  const tracker = await FileProcess.create({
    userEmail,
    filePath: path,
    status: "processing",
  });
  emitter.to(room).emit("fileProcessId", tracker._id.toString());
  emitter.to(room).emit("log", `👷 Job ${job.id} start | PID: ${tracker._id}`);

  // 2️⃣ Helpers for updating & emitting history
  const emitHistory = async () => {
    const history = await FileProcess.find({ userEmail })
      .sort({ createdAt: -1 })
      .select("_id status total processed success failed createdAt updatedAt")
      .lean();

    const current = history.find((h) => h.status === "processing");
    let currentStores: any[] = [];
    if (current) {
      currentStores = await Store.find({ fileProcess: current._id })
        .select("_id fileProcess")
        .lean();
    }
    emitter.to(room).emit("history", {
      list: history,
      currentProcessingId: current?._id.toString() || null,
      currentStores,
    });
  };

  const updateTracker = async (fields: Partial<IFileProcess>) => {
    await FileProcess.findByIdAndUpdate(tracker._id, fields);
    await emitHistory();
  };

  await emitHistory();

  // 3️⃣ Validate file exists
  if (!fs.existsSync(path)) {
    emitter.to(room).emit("error", "File not found");
    await updateTracker({ status: "failed" });
    throw new Error(`Missing file at ${path}`);
  }

  // 4️⃣ Count rows
  emitter.to(room).emit("log", "🔢 Counting rows...");
  const total = await countRows(path);
  emitter.to(room).emit("log", `📊 Total rows: ${total}`);
  await updateTracker({ total });

  // 5️⃣ Process CSV in batches
  const summary = await processCsvFile(
    path,
    tracker._id,
    emitter,
    updateTracker,
    total
  );

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
  const emitter = initEmitter();
  const transporter = initMailer();

  new Worker<{ path: string; userEmail: string }>(
    "storeQueue",
    (job) => handleJob(job, emitter, transporter),
    { connection: (emitter as any).redis }
  );
})();
