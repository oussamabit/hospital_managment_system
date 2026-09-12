import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IPatient extends Document<string> {
  _id: string;
  dossierNumber: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  phone: string;
  email?: string;
  address?: string;
  gender: 'M' | 'F';
  bloodGroup?: string;
  numSecu?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>(
  {
    _id: { type: String, default: () => uuidv4() },
    dossierNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    birthDate: { type: Date, required: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    gender: { type: String, enum: ['M', 'F'], required: true },
    bloodGroup: { type: String, trim: true },
    numSecu: { type: String, unique: true, sparse: true, trim: true }, // Sparse because it might be added later
    notes: { type: String },
    createdBy: { type: String, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

// Auto-generate dossier number
PatientSchema.pre('validate', async function (next) {
  if (!this.dossierNumber) {
    const lastPatient = await mongoose.model('Patient').findOne({}, {}, { sort: { 'createdAt': -1 } });
    const lastNumber = lastPatient ? parseInt((lastPatient.dossierNumber as string).split('-')[1]) : 0;

    // Check if the current list of unsaved docs has our number
    const count = await mongoose.model('Patient').countDocuments();

    // Generate a timestamp based random number as fallback for bulk imports
    this.dossierNumber = `DOS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
export default Patient;
