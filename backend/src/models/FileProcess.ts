// models/FileProcess.ts
import { Schema, model, Document, Types } from "mongoose";

interface ErrorDetail {
  row: number;
  message: string;
}

export interface IFileProcess extends Document {
  userEmail: string;
  socketId?: string;
  filePath: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  processingErrors: ErrorDetail[]; // ✅ renamed here
  status: "pending" | "processing" | "completed" | "failed" | "stopped";
  records?: Types.Array<any>;
  createdAt: Date;
  updatedAt: Date;
}

const ErrorDetailSchema = new Schema<ErrorDetail>(
  { row: Number, message: String },
  { _id: false }
);

const FileProcessSchema = new Schema<IFileProcess>(
  {
    userEmail: { type: String, required: true },
    socketId: { type: String },
    filePath: { type: String, required: true },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    processingErrors: { type: [ErrorDetailSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

FileProcessSchema.virtual('records', {
  ref: 'Store',
  localField: '_id',
  foreignField: 'fileProcess',
});

export const FileProcess = model<IFileProcess>(
  "FileProcess",
  FileProcessSchema
);
