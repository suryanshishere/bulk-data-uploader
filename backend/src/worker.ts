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

  // Check if file exists before processing
  if (!fs.existsSync(path)) {
    console.error(`❌ File not found: ${path}`);
    io.to(socketId).emit('error', 'File not found');
    throw new Error(`File not found: ${path}`);
  }

  // Wait a bit more to ensure file is fully written
  await new Promise(resolve => setTimeout(resolve, 200));

  try {
    const total = await new Promise<number>((resolve, reject) => {
      let count = 0;
      const stream = fs.createReadStream(path);
      
      stream.on('error', (err) => {
        console.error('❌ Error reading file for counting:', err);
        reject(err);
      });

      stream
        .pipe(csv())
        .on('data', () => count++)
        .on('end', () => {
          console.log(`📊 Total rows to process: ${count}`);
          resolve(count);
        })
        .on('error', (err) => {
          console.error('❌ Error parsing CSV for counting:', err);
          reject(err);
        });
    });

    let count = 0;
    let buffer: any[] = [];
    
    return new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(path);
      
      stream.on('error', (err) => {
        console.error('❌ Error reading file for processing:', err);
        io.to(socketId).emit('error', 'Error reading file');
        reject(err);
      });

      const csvStream = stream.pipe(csv());

      csvStream.on('data', async (row) => {
        buffer.push({ ...row, status: 'pending' });

        if (buffer.length >= BATCH_SIZE) {
          try {
            await Store.insertMany(buffer, { ordered: false });
          } catch (err) {
            console.warn("⚠️ Batch insert failed:", err);
          }
          count += buffer.length;
          buffer = [];

          const percent = Math.round((count / total) * 100);
          console.log(`📤 Emitting progress to ${socketId}: ${percent}%`);
          io.to(socketId).emit('progress', percent);
        }
      });

      csvStream.on('end', async () => {
        if (buffer.length > 0) {
          try {
            await Store.insertMany(buffer, { ordered: false });
          } catch (err) {
            console.warn("⚠️ Final insert failed:", err);
          }
          count += buffer.length;
        }

        console.log(`✅ Final emit to ${socketId}: 100%`);
        io.to(socketId).emit('progress', 100);
        io.to(socketId).emit('complete');
        
        // Clean up the file after processing
        try {
          fs.unlinkSync(path);
          console.log(`🗑️ Cleaned up file: ${path}`);
        } catch (err) {
          console.warn('⚠️ Failed to delete file:', err);
        }
        
        resolve();
      });

      csvStream.on('error', (err) => {
        console.error("❌ CSV parsing error:", err);
        io.to(socketId).emit('error', 'Error parsing CSV file');
        reject(err);
      });
    });

  } catch (error) {
    console.error('❌ Worker error:', error);
    io.to(socketId).emit('error', 'Processing failed');
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }
});