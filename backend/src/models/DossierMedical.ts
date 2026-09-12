import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum StatutDossier {
    ACTIF = 'ACTIF',
    FERME = 'FERME',
    ARCHIVE = 'ARCHIVE',
}

export interface IDossierMedical extends Document<string> {
    _id: string;
    patientId: string; // Reference to Patient
    dateOuverture: Date;
    statut: StatutDossier;
    derniereConsultationId?: string; // Reference to Consultation
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const DossierMedicalSchema = new Schema<IDossierMedical>(
    {
        _id: { type: String, default: () => uuidv4() },
        patientId: { type: String, ref: 'Patient', required: true, unique: true },
        dateOuverture: { type: Date, default: Date.now },
        statut: {
            type: String,
            enum: Object.values(StatutDossier),
            default: StatutDossier.ACTIF,
        },
        derniereConsultationId: { type: String, ref: 'Consultation' },
        createdBy: { type: String, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

const DossierMedical = mongoose.model<IDossierMedical>('DossierMedical', DossierMedicalSchema);
export default DossierMedical;
