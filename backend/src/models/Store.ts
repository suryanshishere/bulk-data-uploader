import { Schema, model, Document, Types } from 'mongoose';

export interface IStore extends Document {
  [key: string]: any;
  fileProcess: Types.ObjectId;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

const storeSchema = new Schema<IStore>(
  {
    // … your flexible CSV fields …,
    fileProcess: {
      type: Schema.Types.ObjectId,
      ref: 'FileProcess',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    error: { type: String, default: null },
  },
  { strict: false }
);

export const Store = model<IStore>('Store', storeSchema);
