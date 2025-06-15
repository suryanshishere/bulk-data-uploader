import { Worker, Job } from "bullmq";
import fs from "fs";
import csv from "csv-parser";
import "dotenv/config";

import IORedis from "ioredis";
import { getIO } from "./socket";
import { connectDB } from "./db";
import { Store } from "./models/Store";
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
    const { path, socketId, userEmail } = job.data as {
      path: string;
      socketId?: string;
      userEmail?: string;
    };
    if (socketId) io.to(socketId).emit("log", `👷 Job ${job.id} start`);

    if (!fs.existsSync(path)) {
      if (socketId) io.to(socketId).emit("error", "File not found");
      throw new Error(`Missing file: ${path}`);
    }

    if (socketId) io.to(socketId).emit("log", "🔢 Counting rows...");
    const total = await new Promise<number>((res, rej) => {
      let count = 0;
      fs.createReadStream(path)
        .pipe(csv())
        .on("data", () => count++)
        .on("end", () => res(count))
        .on("error", rej);
    });
    if (socketId) io.to(socketId).emit("log", `📊 Total rows: ${total}`);

    let processed = 0;
    let allErrors: { row: number; message: string }[] = [];

    await new Promise<void>((resolve, reject) => {
      let buffer: any[] = [];
      let rowNum = 0;
      const stream = fs.createReadStream(path).pipe(csv());

      stream.on("data", (row) => {
        rowNum++;
        buffer.push({ ...row, status: "pending" });
        if (buffer.length >= BATCH_SIZE) {
          stream.pause();
          if (socketId) io.to(socketId).emit("log", `🔄 Batch @ row ${rowNum}`);
          processBatch(buffer, rowNum - buffer.length + 1)
            .then((stats) => {
              processed += stats.inserted + stats.failed;
              allErrors.push(...stats.errors);
              if (socketId)
                io.to(socketId).emit(
                  "log",
                  `✅ ${stats.inserted} ok, ${stats.failed} fail`
                );
              emitProgress();
              buffer = [];
              stream.resume();
            })
            .catch((err) => {
              if (socketId) io.to(socketId).emit("error", "Batch error");
              reject(err);
            });
        }
      });

      stream.on("end", async () => {
        if (buffer.length) {
          if (socketId)
            io.to(socketId).emit("log", `🔄 Final ${buffer.length}`);
          const stats = await processBatch(buffer, rowNum - buffer.length + 1);
          processed += stats.inserted + stats.failed;
          allErrors.push(...stats.errors);
          if (socketId)
            io.to(socketId).emit(
              "log",
              `✅ Final ${stats.inserted} ok, ${stats.failed} fail`
            );
        }
        if (socketId) io.to(socketId).emit("log", "🎉 Done");
        emitProgress(100);
        emitSummary();
        cleanup();
        resolve();
      });

      stream.on("error", (err) => {
        if (socketId) io.to(socketId).emit("error", "Read error");
        reject(err);
      });

      function emitProgress(fixed?: number) {
        const pct = fixed ?? Math.round((processed / total) * 100);
        if (socketId) io.to(socketId).emit("progress", pct);
      }
      function emitSummary() {
        const summary = {
          total,
          success: total - allErrors.length,
          failed: allErrors.length,
          errors: allErrors,
        };
        if (socketId) io.to(socketId).emit("summary", summary);
        if (userEmail) sendEmailSummary(userEmail, summary);
      }
      function cleanup() {
        try {
          fs.unlinkSync(path);
        } catch {}
      }
    });

    async function processBatch(batch: any[], startRow: number) {
      const ops = batch.map((doc) => ({ insertOne: { document: doc } }));
      try {
        const res = await Store.bulkWrite(ops, { ordered: false });
        return {
          inserted: res.insertedCount,
          failed: batch.length - res.insertedCount,
          errors: [],
        };
      } catch (err: any) {
        const inserted = err.result?.nInserted ?? 0;
        const errors = (err.writeErrors || []).map((e: any) => ({
          row: startRow + e.index,
          message: e.errmsg,
        }));
        return { inserted, failed: errors.length, errors };
      }
    }

    async function sendEmailSummary(to: string, summary: any) {
      interface UploadError {
        row: number;
        message: string;
      }

      interface UploadSummary {
        total: number;
        success: number;
        failed: number;
        errors: UploadError[];
      }

      const html = `<h3>Upload Summary</h3><p>Total: ${
        summary.total
      }</p><p>Success: ${summary.success}</p><p>Failed: ${
        summary.failed
      }</p><ul>${(summary.errors as UploadError[])
        .map((e) => `<li>Row ${e.row}: ${e.message}</li>`)
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
