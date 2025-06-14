// src/queue.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("❌ REDIS_URL not defined in .env");
}

console.log("🔗 Connecting to Redis at", process.env.REDIS_URL);

const connection = new IORedis(process.env.REDIS_URL);

connection.on('connect', () => {
  console.log("✅ Connected to Redis");
});

connection.on('error', (err) => {
  console.error("❌ Redis connection error:", err);
});

export const storeQueue = new Queue("storeQueue", {
  connection,
});
