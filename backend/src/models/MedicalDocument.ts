import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum DocumentType {
  RADIO = 'RADIO',
  IRM = 'IRM',
  REPORT = 'REPORT',
  IMAGE = 'IMAGE',
  OTHER = 'OTHER',
}

export interface IDocument extends Document<string> {
  _id: string;
  patient: string;
  type: DocumentType;
  fileName: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  notes?: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    _id: { type: String, default: () => uuidv4() },
    patient: { type: String, ref: 'Patient', required: true },
    type: {
      type: String,
      enum: Object.values(DocumentType),
      default: DocumentType.OTHER,
    },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    notes: { type: String },
    uploadedBy: { type: String, ref: 'User', required: true },
  },
  {
    timestamps: true,
  }
);

DocumentSchema.index({ patient: 1, createdAt: -1 });

const MedicalDocument = mongoose.model<IDocument>('MedicalDocument', DocumentSchema);
export default MedicalDocument;
