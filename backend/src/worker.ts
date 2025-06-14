// src/worker.ts
import { Worker, Job } from 'bullmq';
import fs from 'fs';
import csv from 'csv-parser';
import { connectDB } from './db';
import { Store } from './models/Store';
import { io } from './socket';
import 'dotenv/config';

const BATCH_SIZE = 1000;

connectDB();

console.log("👷 Worker started and connected to DB...");

new Worker('storeQueue', async (job: Job) => {
  console.log("🛠️ Worker picked up job:", job.id);
  const { path, socketId } = job.data;
  console.log("📂 Processing file:", path);
  console.log("🔌 Emitting to socket:", socketId);

  const total = await new Promise<number>((resolve) => {
    let count = 0;
    fs.createReadStream(path)
      .pipe(csv())
      .on('data', () => count++)
      .on('end', () => {
        console.log(`📊 Total rows to process: ${count}`);
        resolve(count);
      });
  });

  let count = 0;
  let buffer: any[] = [];
  const stream = fs.createReadStream(path).pipe(csv());

  return new Promise<void>((resolve) => {
    stream.on('data', async (row) => {
      buffer.push({ ...row, status: 'pending' });

      if (buffer.length >= BATCH_SIZE) {
        await Store.insertMany(buffer, { ordered: false }).catch((err) =>
          console.warn("⚠️ Batch insert failed:", err)
        );
        count += buffer.length;
        buffer = [];

        const percent = Math.round((count / total) * 100);
        console.log(`📤 Emitting progress to ${socketId}: ${percent}%`);
        io.to(socketId).emit('progress', percent);
      }
    });

    stream.on('end', async () => {
      if (buffer.length > 0) {
        await Store.insertMany(buffer, { ordered: false }).catch((err) =>
          console.warn("⚠️ Final insert failed:", err)
        );
        count += buffer.length;
      }

      console.log(`✅ Final emit to ${socketId}: 100%`);
      io.to(socketId).emit('progress', 100);
      io.to(socketId).emit('complete');
      resolve();
    });

    stream.on('error', (err) => {
      console.error("❌ Stream error:", err);
    });
  });
});
