import { Emitter } from "@socket.io/redis-emitter";
import { connectDB } from "db";
import nodemailer from "nodemailer";
import IORedis from "ioredis";

export async function initDatabase() {
  await connectDB();
  console.log("▶️ MongoDB ready");
}

export function initEmitter() {
  const redisConn = new IORedis(process.env.REDIS_URL!);
  return new Emitter(redisConn);
}

export function initMailer() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}
