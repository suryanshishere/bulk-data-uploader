import { Schema, model, Document, Types } from 'mongoose';

export interface IStore extends Document {
  [key: string]: any; // allow any top-level key-value pairs
  fileProcess: Types.ObjectId;
}

const storeSchema = new Schema<IStore>(
  {
    fileProcess: {
      type: Schema.Types.ObjectId,
      ref: 'FileProcess',
      required: true,
    },
  },
  {
    strict: false, // allow extra top-level keys
  }
);

export const Store = model<IStore>('Store', storeSchema);
