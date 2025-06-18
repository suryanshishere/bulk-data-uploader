import { connectDB } from "../db";
import nodemailer from "nodemailer";
import { FileProcess } from "@models/FileProcess";
import { storeQueue } from "../queue";
import { computeFileHash } from "@utils/fileHash";

export async function initDatabase() {
  await connectDB();
  console.log("▶️ MongoDB ready");
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

export async function enqueueFile(path: string, userEmail: string) {
  const fileHash = await computeFileHash(path);

  // Check if a matching file with same hash is already queued
  let tracker = await FileProcess.findOne({
    userEmail,
    fileHash,
    status: "queued",
  });

  if (!tracker) {
    tracker = await FileProcess.create({
      userEmail,
      filePath: path,
      fileHash,
      status: "queued",
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
    });
  }

  await storeQueue.add(
    "processStores",
    {
      path,
      userEmail,
      fileProcessId: tracker._id.toString(),
    },
    {
      jobId: `job:${tracker._id}`, // Prevents duplicate jobs
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  return tracker;
}

