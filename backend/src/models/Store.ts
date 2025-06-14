import { Schema, model, Document } from 'mongoose';

export interface IStore extends Document {
  [key: string]: any;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

const storeSchema = new Schema<IStore>({
  // adjust fields per CSV headers
}, { strict: false });

storeSchema.add({
  status: { type: String, enum: ['pending','success','failed'], default: 'pending' },
  error: String
});

export const Store = model<IStore>('Store', storeSchema);