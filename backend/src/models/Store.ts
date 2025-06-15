import { Schema, model, Document } from 'mongoose';

export interface IStore extends Document {
  [key: string]: any;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

// Define your CSV fields here (this example is flexible with strict:false)
const storeSchema = new Schema<IStore>({}, { strict: false });

// Add status and error fields
storeSchema.add({
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  error: { type: String, default: null }
});

export const Store = model<IStore>('Store', storeSchema);