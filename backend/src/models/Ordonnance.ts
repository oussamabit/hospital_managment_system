import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IMedication {
  name: string;
  dosage: string;
  duration: string;
  instructions?: string;
}

export interface IOrdonnance extends Document<string> {
  _id: string;
  consultation: string;
  patient: string;
  medecin: string;
  medications: IMedication[];
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MedicationSchema = new Schema<IMedication>({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  duration: { type: String, required: true },
  instructions: { type: String },
});

const OrdonnanceSchema = new Schema<IOrdonnance>(
  {
    _id: { type: String, default: () => uuidv4() },
    consultation: { type: String, ref: 'Consultation', required: true },
    patient: { type: String, ref: 'Patient', required: true },
    medecin: { type: String, ref: 'User', required: true },
    medications: [MedicationSchema],
    date: { type: Date, default: Date.now },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

OrdonnanceSchema.index({ consultation: 1 });
OrdonnanceSchema.index({ patient: 1 });
OrdonnanceSchema.index({ medecin: 1 });

const Ordonnance = mongoose.model<IOrdonnance>('Ordonnance', OrdonnanceSchema);
export default Ordonnance;
