// worker.ts
import { Worker, Job } from "bullmq";
import fs from "fs";
import csv from "csv-parser";
import "dotenv/config";
import IORedis from "ioredis";
import { Emitter } from "@socket.io/redis-emitter";
import nodemailer from "nodemailer";

import { connectDB } from "./db";
import { Store, IStore } from "./models/Store";
import { FileProcess, IFileProcess } from "./models/FileProcess";

const BATCH_SIZE = 1000;

(async () => {
  await connectDB();
  console.log("▶️  MongoDB ready, starting worker…");

  const connection = new IORedis(process.env.REDIS_URL!);
  const emitter = new Emitter(connection);

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  new Worker<{ path: string; userEmail: string }>(
    "storeQueue",
    async (
      job: Job<{ path: string; socketId?: string; userEmail?: string }>
    ) => {
      const { path, socketId = "", userEmail } = job.data;

      let tracker: IFileProcess;
      try {
        tracker = await FileProcess.create({
          userEmail,
          socketId,
          filePath: path,
          status: "processing",
        });
      } catch (err) {
        console.error("❌ Failed to create FileProcess record:", err);
        throw err;
      }

      const room = userEmail || socketId;
      emitter.to(room).emit("fileProcessId", tracker._id.toString());
      emitter
        .to(room)
        .emit("log", `👷 Job ${job.id} start | PID: ${tracker._id}`);

      const emitHistory = async () => {
        if (!userEmail) return;

        const history = await FileProcess.find({ userEmail })
          .sort({ createdAt: -1 }) // sort by time (latest first)
          .select(
            "_id status total processed success failed createdAt updatedAt"
          )
          .lean();

        const currentProcessing = history.find(
          (h) => h.status === "processing"
        );

        emitter.to(room).emit("history", {
          list: history,
          currentProcessingId: currentProcessing?._id.toString() || null,
        });
      };

      await emitHistory();

      const updateTracker = async (
        fields: Partial<Omit<IFileProcess, "processingErrors">> & {
          processingErrors?: IFileProcess["processingErrors"];
        }
      ) => {
        await FileProcess.findByIdAndUpdate(tracker._id, fields);
        await emitHistory();
      };

      if (!fs.existsSync(path)) {
        emitter.to(room).emit("error", "File not found");
        await updateTracker({ status: "failed" });
        throw new Error(`Missing file: ${path}`);
      }

      emitter.to(room).emit("log", "🔢 Counting rows...");
      const total = await new Promise<number>((res, rej) => {
        let cnt = 0;
        fs.createReadStream(path)
          .pipe(csv())
          .on("data", () => cnt++)
          .on("end", () => res(cnt))
          .on("error", rej);
      });

      emitter.to(room).emit("log", `📊 Total: ${total}`);
      await updateTracker({ total });

      let processed = 0;
      let allErrors: { row: number; message: string }[] = [];

      await new Promise<void>((resolve, reject) => {
        let buffer: Array<Partial<IStore>> = [];
        let rowNum = 0;
        const stream = fs.createReadStream(path).pipe(csv());

        const reportProgress = async (final = false) => {
          const pct = final ? 100 : Math.round((processed / total) * 100);
          emitter.to(room).emit("progress", {
            processId: tracker._id.toString(),
            percent: pct,
          });
          await updateTracker({
            processed,
            success: processed - allErrors.length,
            failed: allErrors.length,
          });
        };

        const flushBatch = async (
          batch: Array<Partial<IStore>>,
          start: number
        ) => {
          emitter.to(room).emit("log", `🔄 Batch @ row ${start}`);
          const stats = await processBatch(batch, start);
          processed += stats.inserted + stats.failed;
          allErrors.push(...stats.errors);
          const msg =
            stats.failed === 0
              ? `✅ ${stats.inserted} inserted`
              : `✅ ${stats.inserted} ok, ${stats.failed} failed`;
          emitter.to(room).emit("log", msg);
          await reportProgress(false);
        };

        const summarize = async () => {
          const summary = {
            total,
            success: total - allErrors.length,
            failed: allErrors.length,
            errors: allErrors,
          };
          emitter
            .to(room)
            .emit("summary", { ...summary, processId: tracker._id });
          if (userEmail)
            await sendEmailSummary(userEmail, summary, tracker._id.toString());
          await updateTracker({
            processed: total,
            success: summary.success,
            failed: summary.failed,
            processingErrors: summary.errors,
            status: "completed",
          });
        };

        stream
          .on("data", (row) => {
            rowNum++;
            buffer.push({
              ...row,
              status: "pending",
              fileProcess: tracker._id,
            });
            if (buffer.length >= BATCH_SIZE) {
              stream.pause();
              flushBatch(buffer.splice(0), rowNum - buffer.length + 1)
                .then(() => stream.resume())
                .catch(reject);
            }
          })
          .on("end", async () => {
            if (buffer.length) {
              await flushBatch(buffer.splice(0), rowNum - buffer.length + 1);
            }
            emitter.to(room).emit("log", "🎉 Done");
            await reportProgress(true);
            await summarize();
            fs.unlinkSync(path);
            resolve();
          })
          .on("error", reject);
      });

      async function processBatch(
        batch: Array<Partial<IStore>>,
        startRow: number
      ) {
        const results = await Promise.all(
          batch.map(async (doc, idx) => {
            try {
              const rec = await Store.create(doc);
              await Store.findByIdAndUpdate(rec._id, { status: "success" });
              return { inserted: 1, failed: 0, errors: [] };
            } catch (e: any) {
              await Store.create({
                ...doc,
                status: "failed",
                error: e.message,
              });
              return {
                inserted: 0,
                failed: 1,
                errors: [{ row: startRow + idx, message: e.message }],
              };
            }
          })
        );
        const inserted = results.reduce((s, r) => s + r.inserted, 0);
        const failed = results.reduce((s, r) => s + r.failed, 0);
        const errors = results.flatMap((r) => r.errors);
        return { inserted, failed, errors };
      }

      async function sendEmailSummary(to: string, summary: any, pid: string) {
        const html =
          `<h3>Processed file link and upload summary</h3>` +
          `<p><a href="${process.env.FRONTEND_URL}/file/${pid}" target="_blank" rel="noopener noreferrer">View processed file</a></p>` +
          `<p>PID: ${pid}</p>` +
          `<p>Total: ${summary.total}</p><p>Success: ${summary.success}</p><p>Failed: ${summary.failed}</p>` +
          `<ul>${summary.errors
            .map((e: any) => `<li>Row ${e.row}: ${e.message}</li>`)
            .join("")}</ul>`;
        await transporter.sendMail({
          from: process.env.MAIL_FROM,
          to,
          subject: "Bulk Data File Processing Completed",
          html,
        });
      }
    },
    { connection }
  );
})();
