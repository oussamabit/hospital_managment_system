import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum RdvStatus {
  PLANIFIE = 'PLANIFIE',
  CONFIRME = 'CONFIRME',
  EN_COURS = 'EN_COURS',
  TERMINE = 'TERMINE',
  ANNULE = 'ANNULE',
  ABSENT = 'ABSENT',
}

export interface IRendezVous extends Document<string> {
  _id: string;
  patient: string;
  medecin: string;
  service: string; // Ref to Service
  dateTime: Date;
  duration: number; // in minutes
  status: RdvStatus;
  motif: string;
  notes?: string;
  cancelReason?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const RendezVousSchema = new Schema<IRendezVous>(
  {
    _id: { type: String, default: () => uuidv4() },
    patient: { type: String, ref: 'Patient', required: true },
    medecin: { type: String, ref: 'User', required: true },
    service: { type: String, ref: 'Service', required: true },
    dateTime: { type: Date, required: true },
    duration: { type: Number, default: 30 },
    status: {
      type: String,
      enum: Object.values(RdvStatus),
      default: RdvStatus.PLANIFIE,
    },
    motif: { type: String, required: true, trim: true },
    notes: { type: String },
    cancelReason: { type: String },
    cancelledAt:  { type: Date },
    cancelledBy:  { type: String, ref: 'User' },
    createdBy: { type: String, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
RendezVousSchema.index({ dateTime: 1, medecin: 1 });
RendezVousSchema.index({ patient: 1, dateTime: -1 });
RendezVousSchema.index({ status: 1 });

const RendezVous = mongoose.model<IRendezVous>('RendezVous', RendezVousSchema);
export default RendezVous;
