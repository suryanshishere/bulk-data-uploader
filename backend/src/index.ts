import 'module-alias/register';
import express, { NextFunction, Request, Response } from "express";
import http from "http";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import "dotenv/config";
import { Store } from "./models/Store";
import { connectDB } from "./db";
import { initSocket } from "./socket";
import { FileProcess } from "@models/FileProcess";
import HttpError from "@utils/http-errors";
import { enqueueFile } from "@worker/helpers";

// ensure uploads folder
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
const server = http.createServer(app);
initSocket(server);
connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/processed-file-data/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const skip = parseInt(req.query.skip as string) || 0;
  const limit = parseInt(req.query.limit as string) || 10;

  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400).json({ error: "Invalid ID format" });
    return;
  }

  try {
    const fileProcess = await FileProcess.findById(id).lean().exec();
    if (!fileProcess) {
      res.status(404).json({ error: "FileProcess not found" });
      return;
    }

    const storeRecords = await Store.find({ fileProcess: id })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const records = storeRecords.map(
      ({ _id, fileProcess: _fp, __v, ...rest }) => ({
        _id,
        record: rest,
      })
    );

    const payload = {
      fileProcess: {
        _id: fileProcess._id,
        userEmail: fileProcess.userEmail,
        total: fileProcess.total,
        processed: fileProcess.processed,
        success: fileProcess.success,
        failed: fileProcess.failed,
        processingErrors: fileProcess.processingErrors,
        status: fileProcess.status,
        createdAt: fileProcess.createdAt,
        updatedAt: fileProcess.updatedAt,
      },
      records,
    };

    res.status(200).json(payload);
    return;
  } catch (err) {
    console.error("Error in /processed-file-data/:id:", err);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

const upload = multer({ dest: uploadDir });

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "File not received" });
    return;
  }

  const absPath = path.resolve(req.file.path);
  const { email } = req.body as { email: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  if (!fs.existsSync(absPath)) {
    console.error(`❌ Missing file: ${absPath}`);
    res.status(500).json({ error: "File not found" });
    return;
  }

  try {
    // 1️⃣ First, save the FileProcess doc with status "queued"
    const tracker = await enqueueFile(absPath, email);

    res.json({
      queued: true,
      trackerId: tracker._id.toString(),
    });
  } catch (err) {
    console.error("❌ Queue error:", err);
    res.status(500).json({ error: "Queue failed" });
    return;
  }
});

// --- 404 Fallback ---
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new HttpError("Could not find this route.", 404));
});

// --- Global Error Handler ---
app.use((error: HttpError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = error.code || 500;
  const errorMessage = error.message || "An unknown error occurred!";
  const response = {
    message: errorMessage,
    ...(error.extraData && { extraData: error.extraData }),
  };
  res.status(statusCode).json(response);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
