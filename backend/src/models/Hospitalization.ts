import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// ── Bilan Biologique ──────────────────────────────────────────────────────────
export interface IFns {
  gb?: number; gr?: number; hb?: number; ht?: number;
  vgm?: number; tcmh?: number; ccmh?: number; plq?: number;
}
export interface IFormuleLeuco {
  neutrophiles?: number; lymphocytes?: number; monocytes?: number;
  eosinophiles?: number; basophiles?: number;
}
export interface IBilanBiologique {
  uree?: number; creatinine?: number;
  positif?: string; negatif?: string;
  fns?: IFns; formuleLeuco?: IFormuleLeuco; autresExamens?: string;
}

// ── Medical Imaging — New Architecture ───────────────────────────────────────

/**
 * One file inside a study (DICOM slice or standard image).
 * For DICOM: originalName = original filename, storedName = 0001.dcm (sequential)
 */
export interface IStudyFile {
  fileId:        string;
  storedName:    string;   // 0001.dcm / 0001.jpg (sequential, deterministic)
  originalName:  string;   // original upload filename
  filePath:      string;   // absolute path on disk
  fileType:      string;   // MIME type
  // DICOM metadata (populated by Python sorter when available)
  instanceNumber?:      number;
  sliceLocation?:       number;
  imagePositionPatient?: string;  // "x\\y\\z"
  acquisitionDate?:     string;
  uploadedAt:    Date;
}

/**
 * Viewer type: determines which renderer the frontend uses.
 * - 'dicom'  → Cornerstone.js WASM renderer
 * - 'image'  → Standard <img> / canvas renderer
 * - 'pdf'    → iframe PDF viewer
 */
export type ViewerType = 'dicom' | 'image' | 'pdf';

/**
 * One imaging study = one acquisition folder or single file.
 * Replaces old IDicomSeries + IImagingFile.
 *
 * Folder structure on disk:
 *   uploads/patients/{patientId}/hospitalization_{hospN}/{modality}/{studyN}/
 *     0001.dcm, 0002.dcm, ...
 */
export interface IImagingStudy {
  studyId:       string;          // UUID (internal reference)
  studyLabel:    string;          // human label: "CT Thorax 12/05/2026"
  viewerType:    ViewerType;      // 'dicom' | 'image' | 'pdf'
  modality:      string;          // CT | MR | RX | US | XA | ...
  imagingType:   string;          // scanner | irm | radiographie | echographie
  studyFolder:   string;          // absolute path of the study folder on disk
  seriesNumber:  number;          // 1, 2, 3 ... (per modality per hosp)
  studyUID?:     string;          // DICOM StudyInstanceUID if available
  seriesUID?:    string;          // DICOM SeriesInstanceUID if available
  acquisitionDate?: string;       // DICOM AcquisitionDate YYYYMMDD
  files:         IStudyFile[];    // ordered slice list
  sliceCount:    number;          // total number of slices/files
  uploadedAt:    Date;
  notes?:        string;
  description?:  string;          // required text description (shown in print)
}

export interface IBilanMorphologique {
  studies?: IImagingStudy[];

  // ── Legacy single-file arrays (kept for backward compatibility) ─────────────
  radiographie?: ILegacyFile[];
  echographie?:  ILegacyFile[];
  scanner?:      ILegacyFile[];
  irm?:          ILegacyFile[];
}

/** Kept only for backward compat with existing uploaded single files */
export interface ILegacyFile {
  fileId: string; filePath: string; originalName: string;
  fileType: string; uploadedAt: Date; notes?: string; description?: string;
}

// ── Protocole Opératoire ──────────────────────────────────────────────────────
export interface IProtocoleOperatoire {
  nomOperateur?: string; aide?: string; anesthesistes?: string;
  diagnosticOperatoire?: string; contenuProtocole?: string;
}

// ── Suivi journalier ──────────────────────────────────────────────────────────
export interface IDailyFollowup {
  date: Date; notes: string; evolution?: string; createdBy?: string;
}

// ── Examen Clinique ───────────────────────────────────────────────────────────
export interface IExamenClinique {
  etatGeneral?: string; appareilCardioRespiratoire?: string;
  histoireMaladie?: string; appareilGenitoUrinaire?: string;
  systemeNerveux?: string; appareilDigestif?: string; autresSystemes?: string;
}

// ── Dossier principal ─────────────────────────────────────────────────────────
export interface IHospitalization extends Document<string> {
  _id: string;
  patientId: string;
  annee?: string; dossierN?: string; noBilletSalle?: string; noLit?: string;
  groupage?: string; rh?: string; profession?: string;
  dateEntree?: Date; dateSortie?: Date;
  transfert?: string; deces?: string; motifAdmission?: string; diagnostic?: string;
  chirurgienTraitantId?: string; chirurgienTraitantNom?: string;
  examenClinique?: IExamenClinique;
  motifHospitalisation?: string; histoireMaladie?: string;
  antecedentsMedicaux?: string; antecedentsChirurgicaux?: string; allergies?: string;
  bilanBiologique?: IBilanBiologique;
  bilanMorphologique?: IBilanMorphologique;
  protocoleOperatoire?: IProtocoleOperatoire;
  dailyFollowups?: IDailyFollowup[];
  createdBy: string;
  createdAt: Date; updatedAt: Date;
}

// ── Mongoose Schemas ──────────────────────────────────────────────────────────

const FnsSchema = new Schema<IFns>({
  gb: Number, gr: Number, hb: Number, ht: Number,
  vgm: Number, tcmh: Number, ccmh: Number, plq: Number,
}, { _id: false });

const FormuleLeucoSchema = new Schema<IFormuleLeuco>({
  neutrophiles: Number, lymphocytes: Number, monocytes: Number,
  eosinophiles: Number, basophiles: Number,
}, { _id: false });

const BilanBiologiqueSchema = new Schema<IBilanBiologique>({
  uree: Number, creatinine: Number, positif: String, negatif: String,
  fns: FnsSchema, formuleLeuco: FormuleLeucoSchema, autresExamens: String,
}, { _id: false });

// New architecture: study file schema
const StudyFileSchema = new Schema<IStudyFile>({
  fileId:               { type: String, required: true },
  storedName:           { type: String, required: true },
  originalName:         { type: String, required: true },
  filePath:             { type: String, required: true },
  fileType:             { type: String, default: 'application/dicom' },
  instanceNumber:       Number,
  sliceLocation:        Number,
  imagePositionPatient: String,
  acquisitionDate:      String,
  uploadedAt:           { type: Date, default: Date.now },
}, { _id: false });

// New architecture: imaging study schema
const ImagingStudySchema = new Schema<IImagingStudy>({
  studyId:        { type: String, required: true },
  studyLabel:     { type: String, required: true },
  viewerType:     { type: String, enum: ['dicom', 'image', 'pdf'], required: true },
  modality:       { type: String, required: true },
  imagingType:    { type: String, required: true },
  studyFolder:    { type: String, required: true },
  seriesNumber:   { type: Number, required: true },
  studyUID:       String,
  seriesUID:      String,
  acquisitionDate: String,
  files:          [StudyFileSchema],
  sliceCount:     { type: Number, default: 0 },
  uploadedAt:     { type: Date, default: Date.now },
  notes:          String,
  description:    String,
}, { _id: false });

// Legacy single-file schema (backward compat)
const LegacyFileSchema = new Schema<ILegacyFile>({
  fileId: String, filePath: String, originalName: String,
  fileType: String, uploadedAt: { type: Date, default: Date.now },
  notes: String, description: String,
}, { _id: false });

const BilanMorphologiqueSchema = new Schema<IBilanMorphologique>({
  studies:      [ImagingStudySchema],
  // Legacy arrays kept for backward compat
  radiographie: [LegacyFileSchema],
  echographie:  [LegacyFileSchema],
  scanner:      [LegacyFileSchema],
  irm:          [LegacyFileSchema],
}, { _id: false });

const ProtocoleOperatoireSchema = new Schema<IProtocoleOperatoire>({
  nomOperateur: String, aide: String, anesthesistes: String,
  diagnosticOperatoire: String, contenuProtocole: String,
}, { _id: false });

const DailyFollowupSchema = new Schema<IDailyFollowup>({
  date: { type: Date, required: true }, notes: { type: String, required: true },
  evolution: String, createdBy: String,
});

const ExamenCliniqueSchema = new Schema<IExamenClinique>({
  etatGeneral: String, appareilCardioRespiratoire: String, histoireMaladie: String,
  appareilGenitoUrinaire: String, systemeNerveux: String,
  appareilDigestif: String, autresSystemes: String,
}, { _id: false });

const HospitalizationSchema = new Schema<IHospitalization>(
  {
    _id: { type: String, default: () => uuidv4() },
    patientId: { type: String, ref: 'Patient', required: true },
    annee: String, dossierN: String, noBilletSalle: String, noLit: String,
    groupage: String, rh: String, profession: String,
    dateEntree: Date, dateSortie: Date,
    transfert: String, deces: String, motifAdmission: String, diagnostic: String,
    chirurgienTraitantId: { type: String, ref: 'User' },
    chirurgienTraitantNom: String,
    examenClinique: ExamenCliniqueSchema,
    motifHospitalisation: String, histoireMaladie: String,
    antecedentsMedicaux: String, antecedentsChirurgicaux: String, allergies: String,
    bilanBiologique: BilanBiologiqueSchema,
    bilanMorphologique: BilanMorphologiqueSchema,
    protocoleOperatoire: ProtocoleOperatoireSchema,
    dailyFollowups: [DailyFollowupSchema],
    createdBy: { type: String, ref: 'User', required: true },
  },
  { timestamps: true }
);

HospitalizationSchema.index({ patientId: 1, createdAt: -1 });

const Hospitalization = mongoose.model<IHospitalization>('Hospitalization', HospitalizationSchema);
export default Hospitalization;
