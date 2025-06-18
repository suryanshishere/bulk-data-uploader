import { Schema, model, Document, Types } from "mongoose";

interface ErrorDetail {
  row: number;
  message: string;
}

export interface IFileProcess extends Document {
  userEmail: string;
  fileHash: string; // added
  total: number;
  processed: number;
  success: number;
  failed: number;
  processingErrors: ErrorDetail[];
  status: "queued" | "processing" | "completed" | "failed" | "stopped";
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
    fileHash: { type: String, required: true, index: true }, // ✅ Added here
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    processingErrors: { type: [ErrorDetailSchema], default: [] },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed", "stopped"],
      default: "queued",
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
  ref: 'Store',
  localField: '_id',
  foreignField: 'fileProcess',
  justOne: true,
});

export const FileProcess = model<IFileProcess>(
  "FileProcess",
  FileProcessSchema
);
