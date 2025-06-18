import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {},
});

export const storeQueue = new Queue("storeQueue", { connection });
