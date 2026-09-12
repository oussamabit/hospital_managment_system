import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IConsultation extends Document<string> {
  _id: string;
  rendezvous: string;
  patient: string;
  medecin: string;
  dossierMedical: string; // Ref to DossierMedical
  dateConsultation: Date;
  diagnosticPrincipal: string;
  examenClinique: string;
  conclusion: string;
  traitementPrescrit?: string;
  recommendations?: string;
  notes?: string;
  isValidatedBySenior: boolean;
  validatorId?: string; // ID of the Senior who validated
  digitalSignature?: string; // Security hash/signature
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationSchema = new Schema<IConsultation>(
  {
    _id: { type: String, default: () => uuidv4() },
    rendezvous: {
      type: String,
      ref: 'RendezVous',
      required: true,
      unique: true, // 1:1 with RendezVous
    },
    patient: { type: String, ref: 'Patient', required: true },
    medecin: { type: String, ref: 'User', required: true },
    dossierMedical: { type: String, ref: 'DossierMedical', required: true },
    dateConsultation: { type: Date, default: Date.now },
    diagnosticPrincipal: { type: String, required: true, trim: true },
    examenClinique: { type: String, required: true },
    conclusion: { type: String, required: true },
    traitementPrescrit: { type: String },
    recommendations: { type: String },
    notes: { type: String },
    isValidatedBySenior: { type: Boolean, default: false },
    validatorId: { type: String, ref: 'User' },
    digitalSignature: { type: String },
    createdBy: { type: String, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

ConsultationSchema.index({ patient: 1, createdAt: -1 });
ConsultationSchema.index({ medecin: 1 });

const Consultation = mongoose.model<IConsultation>('Consultation', ConsultationSchema);
export default Consultation;
