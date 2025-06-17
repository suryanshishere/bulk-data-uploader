import express, { NextFunction, Request, Response } from "express";
import http from "http";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import "dotenv/config";
import { Store } from "./models/Store";
import { connectDB } from "./db";
import { storeQueue } from "./queue";
import { initSocket } from "./socket";
import { FileProcess } from "@models/FileProcess";
import HttpError from "@utils/http-errors";

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

app.get("/file/:id", async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  try {
    // 1. Fetch FileProcess
    const fileProcess = await FileProcess.findById(id).exec();
    if (!fileProcess) {
      res.status(404).json({ error: "FileProcess not found" });
      return;
    }

    // 2. Fetch Store document whose _id matches fileProcess._id
    const storeDoc = await Store.findById(id).lean().exec();
    if (!storeDoc) {
      // If you expect a Store always present, you can 404 or return empty record.
      res.status(404).json({ error: "Store record not found for this FileProcess" });
      return;
    }

    // 3. Transform the storeDoc to strip out internal fields.
    //    We want: _id, maybe status/error if those fields exist on storeDoc,
    //    and dynamic fields (everything else except fileProcess, createdAt, updatedAt, __v).
    const { _id, fileProcess: fpRef, createdAt, updatedAt, __v, ...rest } = storeDoc;

    // If your Store schema includes status/error fields at top-level, extract them:
    // e.g., if you had defined storeDoc.status or storeDoc.error, you can extract like:
    // const { status, error, ...dynamicFields } = rest;
    // But since schema is strict:false, we don't know fixed keys; if status/error are dynamic fields, you can include them in 'rest'.
    // If you want to explicitly pick out status/error and leave the rest as dynamicFields:
    let statusValue: any = undefined;
    let errorValue: any = undefined;
    const dynamicRecord: Record<string, any> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (key === "status") {
        statusValue = value;
      } else if (key === "error") {
        errorValue = value;
      } else {
        // everything else is dynamic
        dynamicRecord[key] = value;
      }
    }

    // 4. Build the response
    const responsePayload: any = {
      fileProcess: {
        _id: fileProcess._id,
        userEmail: fileProcess.userEmail,
        socketId: fileProcess.socketId,
        filePath: fileProcess.filePath,
        total: fileProcess.total,
        processed: fileProcess.processed,
        success: fileProcess.success,
        failed: fileProcess.failed,
        processingErrors: fileProcess.processingErrors,
        status: fileProcess.status,
        createdAt: fileProcess.createdAt,
        updatedAt: fileProcess.updatedAt,
      },
      record: {
        _id,
        // include status/error if present:
        ...(statusValue !== undefined ? { status: statusValue } : {}),
        ...(errorValue !== undefined ? { error: errorValue } : {}),
        record: dynamicRecord,
      },
    };

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({ error: "Internal server error" });
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
  console.log(`📩 Received file: ${absPath}`);

  if (!fs.existsSync(absPath)) {
    console.error(`❌ Missing file: ${absPath}`);
    res.status(500).json({ error: "File not found" });
    return;
  }

  try {
    const job = await storeQueue.add("processStores", {
      path: absPath,
      userEmail: email,
    });
    console.log(`📦 Job queued: ${job.id}`);
    res.json({ queued: true, jobId: job.id });
  } catch (err) {
    console.error("❌ Queue error:", err);
    res.status(500).json({ error: "Queue failed" });
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
