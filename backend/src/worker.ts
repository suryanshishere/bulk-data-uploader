import { Worker, Job } from "bullmq";
import fs from "fs";
import csv from "csv-parser";
import "dotenv/config";

import IORedis from "ioredis";
import { getIO } from "./socket";
import { connectDB } from "./db";
import { Store, IStore } from "./models/Store";
import nodemailer from "nodemailer";

const BATCH_SIZE = 1000;
connectDB();

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379"
);
const io = getIO();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

new Worker(
  "storeQueue",
  async (job: Job) => {
    const {
      path,
      socketId = "",
      userEmail,
    } = job.data as { path: string; socketId?: string; userEmail?: string };
    io.to(socketId).emit("log", `👷 Job ${job.id} start`);

    if (!fs.existsSync(path)) {
      io.to(socketId).emit("error", "File not found");
      throw new Error(`Missing file: ${path}`);
    }

    io.to(socketId).emit("log", "🔢 Counting rows...");
    const total = await new Promise<number>((res, rej) => {
      let count = 0;
      fs.createReadStream(path)
        .pipe(csv())
        .on("data", () => count++)
        .on("end", () => res(count))
        .on("error", rej);
    });
    io.to(socketId).emit("log", `📊 Total rows: ${total}`);

    let processed = 0;
    let allErrors: { row: number; message: string }[] = [];

    await new Promise<void>((resolve, reject) => {
      let buffer: Array<Partial<IStore>> = [];
      let rowNum = 0;
      const stream = fs.createReadStream(path).pipe(csv());

      stream.on("data", (row) => {
        rowNum++;
        buffer.push({ ...row, status: "pending" });

        if (buffer.length >= BATCH_SIZE) {
          stream.pause();
          io.to(socketId).emit("log", `🔄 Batch @ row ${rowNum}`);
          processBatch(buffer, rowNum - buffer.length + 1)
            .then((stats) => {
              processed += stats.inserted + stats.failed;
              allErrors.push(...stats.errors);
              if (stats.failed === 0) {
                io.to(socketId).emit(
                  "log",
                  `✅ All ${stats.inserted} records inserted successfully`
                );
              } else {
                io.to(socketId).emit(
                  "log",
                  `✅ ${stats.inserted} ok, ${stats.failed} fail`
                );
              }

              emitProgress();
              buffer = [];
              stream.resume();
            })
            .catch((err) => {
              io.to(socketId).emit("error", "Batch error");
              reject(err);
            });
        }
      });

      stream.on("end", async () => {
        if (buffer.length) {
          io.to(socketId).emit("log", `🔄 Final ${buffer.length}`);
          const stats = await processBatch(buffer, rowNum - buffer.length + 1);
          processed += stats.inserted + stats.failed;
          allErrors.push(...stats.errors);
          if (stats.failed === 0) {
            io.to(socketId).emit(
              "log",
              `✅ All ${stats.inserted} records inserted successfully`
            );
          } else {
            io.to(socketId).emit(
              "log",
              `✅ ${stats.inserted} ok, ${stats.failed} fail`
            );
          }
        }
        io.to(socketId).emit("log", "🎉 Done");
        emitProgress(100);
        emitSummary();
        cleanup();
        resolve();
      });

      stream.on("error", (err) => {
        io.to(socketId).emit("error", "Read error");
        reject(err);
      });

      function emitProgress(fixed?: number) {
        const pct = fixed ?? Math.round((processed / total) * 100);
        io.to(socketId).emit("progress", pct);
      }
      function emitSummary() {
        const summary = {
          total,
          success: total - allErrors.length,
          failed: allErrors.length,
          errors: allErrors,
        };
        io.to(socketId).emit("summary", summary);
        if (userEmail) sendEmailSummary(userEmail, summary);
      }
      function cleanup() {
        try {
          fs.unlinkSync(path);
        } catch {}
      }
    });

    async function processBatch(
      batch: Array<Partial<IStore>>,
      startRow: number
    ) {
      const results = await Promise.all(
        batch.map(async (doc, idx) => {
          try {
            const created = await Store.create(doc);
            await Store.findByIdAndUpdate(created._id, { status: "success" });
            return { inserted: 1, failed: 0, errors: [] };
          } catch (err: any) {
            await Store.create({
              ...doc,
              status: "failed",
              error: err.message,
            });
            return {
              inserted: 0,
              failed: 1,
              errors: [{ row: startRow + idx, message: err.message }],
            };
          }
        })
      );

      const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
      const failed = results.reduce((sum, r) => sum + r.failed, 0);
      const errors = results.flatMap((r) => r.errors);
      return { inserted, failed, errors };
    }

    async function sendEmailSummary(to: string, summary: any) {
      interface ErrorDetail {
        row: number;
        message: string;
      }

      interface Summary {
        total: number;
        success: number;
        failed: number;
        errors: ErrorDetail[];
      }

      const html = `<h3>Upload Summary</h3><p>Total: ${
        (summary as Summary).total
      }</p><p>Success: ${(summary as Summary).success}</p><p>Failed: ${
        (summary as Summary).failed
      }</p><ul>${(summary as Summary).errors
        .map((e: ErrorDetail) => `<li>Row ${e.row}: ${e.message}</li>`)
        .join("")}</ul>`;
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject: "Upload Complete",
        html,
      });
    }
  },
  { connection }
);
