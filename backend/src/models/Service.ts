import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IService extends Document<string> {
  _id: string;
  nomService: string;
  chefDeServiceId: string; // Reference to a Senior Doctor (Medecin)
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    _id: { type: String, default: () => uuidv4() },
    nomService: { type: String, required: true, unique: true, trim: true },
    chefDeServiceId: { type: String, ref: 'User', required: true },
    createdBy: { type: String, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

const Service = mongoose.model<IService>('Service', ServiceSchema);
export default Service;
