import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IAnalyseRequest extends Document<string> {
  _id: string;
  consultation: string;
  patient: string;
  medecin: string;
  serviceName: string;
  motifDemande?: string;
  selectedTests: string[];
  otherTests?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyseRequestSchema = new Schema<IAnalyseRequest>(
  {
    _id: { type: String, default: () => uuidv4() },
    consultation: { type: String, ref: 'Consultation', required: true },
    patient: { type: String, ref: 'Patient', required: true },
    medecin: { type: String, ref: 'User', required: true },
    serviceName: { type: String, required: true, default: 'Chirurgie Generale et Cancerogene' },
    motifDemande: { type: String, trim: true },
    selectedTests: [{ type: String, required: true }],
    otherTests: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

AnalyseRequestSchema.index({ consultation: 1 });
AnalyseRequestSchema.index({ patient: 1, createdAt: -1 });
AnalyseRequestSchema.index({ medecin: 1, createdAt: -1 });

const AnalyseRequest = mongoose.model<IAnalyseRequest>('AnalyseRequest', AnalyseRequestSchema);
export default AnalyseRequest;
