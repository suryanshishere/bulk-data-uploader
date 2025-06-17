// models/FileProcess.ts
import { Schema, model, Document, Types } from "mongoose";

interface ErrorDetail {
  row: number;
  message: string;
}

export interface IFileProcess extends Document {
  userEmail: string;
  filePath: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  processingErrors: ErrorDetail[];
  status: "pending" | "processing" | "completed" | "failed" | "stopped";
  record?: Types.Subdocument & Record<string, any>; // single Store document populated via `record`
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
    filePath: { type: String, required: true },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    processingErrors: { type: [ErrorDetailSchema], default: [] },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "stopped"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  }
);

// Virtual to populate the single Store document for this FileProcess
FileProcessSchema.virtual('record', {
  ref: 'Store',             // The model to use
  localField: '_id',        // Find Store docs where `fileProcess` equals this _id
  foreignField: 'fileProcess',
  justOne: true,            // Return a single document, not an array
});

export const FileProcess = model<IFileProcess>(
  "FileProcess",
  FileProcessSchema
);
