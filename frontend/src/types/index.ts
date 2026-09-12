// ===== USER / AUTH TYPES =====
export enum Role {
  ADMIN = 'ADMIN',
  MEDECIN = 'MEDECIN',
  SECRETAIRE = 'SECRETAIRE',
  INFIRMIER = 'INFIRMIER',
}

export enum Grade {
  SENIOR = 'SENIOR',
  JUNIOR = 'JUNIOR',
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  isActive: boolean;
  grade?: Grade;
  specialite?: string;
  numeroOrdre?: string;
  service?: string;
  codePoste?: string;
  matricule?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ===== PATIENT TYPES =====
export interface Patient {
  _id: string;
  dossierNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email?: string;
  address?: string;
  gender: 'M' | 'F';
  bloodGroup?: string;
  notes?: string;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  gender: 'M' | 'F';
  email?: string;
  address?: string;
  bloodGroup?: string;
  notes?: string;
  service?: string;
}

// ===== SERVICE TYPES =====
export interface Service {
  _id: string;
  nomService: string;
  chefDeServiceId: string | User;
  createdBy?: User | string;
  createdAt: string;
  updatedAt: string;
}

// ===== OPTION TYPES =====
export interface OptionType {
  _id: string;
  category: 'SPECIALITE' | 'SERVICE';
  value: string;
  createdAt: string;
  updatedAt: string;
}

// ===== RENDEZVOUS TYPES =====
export type RdvStatus = 'PLANIFIE' | 'CONFIRME' | 'EN_COURS' | 'TERMINE' | 'ANNULE' | 'ABSENT';

export interface RendezVous {
  _id: string;
  patient: Patient | string;
  medecin: User | string;
  service: Service | string;
  dateTime: string;
  duration: number;
  status: RdvStatus;
  motif: string;
  notes?: string;
  cancelReason?: string;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRdvDto {
  patient: string;
  medecin: string;
  service: string;
  dateTime: string;
  duration?: number;
  motif: string;
  notes?: string;
  status?: RdvStatus;
}

// ===== CONSULTATION TYPES =====
export interface Consultation {
  _id: string;
  rendezvous: RendezVous | string;
  patient: Patient | string;
  medecin: User | string;
  diagnosticPrincipal: string;
  examenClinique: string;
  conclusion: string;
  traitementPrescrit?: string;
  recommendations?: string;
  notes?: string;
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsultationDto {
  rendezvous: string;
  diagnosticPrincipal: string;
  examenClinique: string;
  conclusion: string;
  traitementPrescrit?: string;
  recommendations?: string;
  notes?: string;
}

// ===== DOCUMENT TYPES =====
export enum DocumentType {
  RADIO = 'RADIO',
  IRM = 'IRM',
  REPORT = 'REPORT',
  IMAGE = 'IMAGE',
  OTHER = 'OTHER',
}

export interface MedicalDocument {
  _id: string;
  patient: string;
  type: DocumentType;
  fileName: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  notes?: string;
  uploadedBy: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  name: string;
  dosage: string;
  duration: string;
  instructions?: string;
}

export interface Ordonnance {
  _id: string;
  consultation: string | Consultation;
  patient: string | Patient;
  medecin: string | User;
  medications: Medication[];
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrdonnanceDto {
  consultation: string;
  patient: string;
  medications: Medication[];
  notes?: string;
}


// ===== HOSPITALIZATION TYPES =====
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

// ── Legacy single-file (used in old radiographie/echographie/scanner/irm arrays) ──
export interface IImagingFile {
  fileId: string;
  filePath: string;
  originalName: string;
  fileType: string;
  uploadedAt: string;
  notes?: string;
  description?: string;
}

// ── Legacy DICOM series types (kept so DicomSeriesViewerModal still compiles) ──
export interface IDicomSeriesFile {
  fileId: string;
  filePath: string;
  originalName: string;
  fileType: string;
  uploadedAt: string;
  notes?: string;
}

export interface IDicomSeries {
  seriesId: string;
  seriesLabel: string;
  modality: string;
  imagingType: string;
  folderPath: string;
  files: IDicomSeriesFile[];
  frameCount: number;
  uploadedAt: string;
  notes?: string;
}

// ── NEW imaging architecture ──────────────────────────────────────────────────
export type ViewerType = 'dicom' | 'image' | 'pdf';

/** One file inside a study (DICOM slice or standard image). */
export interface IStudyFile {
  fileId:               string;
  storedName:           string;   // 0001.dcm (sequential, deterministic)
  originalName:         string;
  filePath:             string;
  fileType:             string;
  instanceNumber?:      number;
  sliceLocation?:       number;
  imagePositionPatient?: string;
  acquisitionDate?:     string;
  uploadedAt:           string;
}

/** One imaging study = one acquisition folder or single file. */
export interface IImagingStudy {
  studyId:          string;
  studyLabel:       string;
  viewerType:       ViewerType;
  modality:         string;       // CT | MR | RX | US | …
  imagingType:      string;       // scanner | irm | radiographie | echographie
  studyFolder:      string;
  seriesNumber:     number;
  studyUID?:        string;
  seriesUID?:       string;
  acquisitionDate?: string;
  files:            IStudyFile[];
  sliceCount:       number;
  uploadedAt:       string;
  notes?:           string;
  description?:     string;
}

export interface IBilanMorphologique {
  // ── New: unified study array (all modalities) ─────────────────────────────
  studies?: IImagingStudy[];

  // ── Legacy single-file arrays (backward compat) ───────────────────────────
  radiographie?: IImagingFile[];
  echographie?: IImagingFile[];
  scanner?: IImagingFile[];
  irm?: IImagingFile[];

  // Legacy series field (old name — superseded by studies)
  series?: IDicomSeries[];
}

export interface IExamenClinique {
  etatGeneral?: string;
  appareilCardioRespiratoire?: string;
  histoireMaladie?: string;
  appareilGenitoUrinaire?: string;
  systemeNerveux?: string;
  appareilDigestif?: string;
  autresSystemes?: string;
}

export interface IDailyFollowup {
  _id?: string;
  date: string;
  notes: string;
  evolution?: string;
  createdBy?: string | User;
}

export interface IProtocoleOperatoire {
  nomOperateur?: string;
  aide?: string;
  anesthesistes?: string;
  diagnosticOperatoire?: string;
  contenuProtocole?: string;
}

export interface Hospitalization {
  _id: string;
  patientId: string;

  // Page 1
  annee?: string;
  dossierN?: string;
  noBilletSalle?: string;
  noLit?: string;
  groupage?: string;
  rh?: string;
  profession?: string;
  dateEntree?: string;
  dateSortie?: string;
  transfert?: string;
  deces?: string;
  motifAdmission?: string;
  diagnostic?: string;
  chirurgienTraitantId?: User | string;
  chirurgienTraitantNom?: string;

  // Page 2
  examenClinique?: IExamenClinique;

  // Page 3
  motifHospitalisation?: string;
  histoireMaladie?: string;
  antecedentsMedicaux?: string;
  antecedentsChirurgicaux?: string;
  allergies?: string;

  // Page 4
  bilanBiologique?: IBilanBiologique;

  // Page 5 - Imagerie
  bilanMorphologique?: IBilanMorphologique;

  // Page 5b - Protocole opératoire
  protocoleOperatoire?: IProtocoleOperatoire;

  // Page 6 - Suivi
  dailyFollowups?: IDailyFollowup[];

  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

// ===== API RESPONSE TYPES =====
export interface ApiError {
  message: string;
  errors?: Array<{ message: string; path: string[] }>;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DashboardStats {
  todayTotal: number;
  todayInProgress: number;
  todayCompleted: number;
  todayPlanned: number;
  totalPatients: number;
}

// ===== STATUS DISPLAY HELPERS =====
export const RdvStatusLabels: Record<RdvStatus, string> = {
  PLANIFIE: 'Planifié',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
  ABSENT: 'Absent',
};

export const RdvStatusColors: Record<RdvStatus, string> = {
  PLANIFIE: 'bg-blue-100 text-blue-700',
  CONFIRME: 'bg-teal-100 text-teal-700',
  EN_COURS: 'bg-amber-100 text-amber-700',
  TERMINE: 'bg-green-100 text-green-700',
  ANNULE: 'bg-red-100 text-red-700',
  ABSENT: 'bg-gray-100 text-gray-700',
};

export const RoleLabels: Record<Role, string> = {
  ADMIN: 'Administrateur',
  MEDECIN: 'Médecin',
  SECRETAIRE: 'Secrétaire',
  INFIRMIER: 'Infirmier',
};

export const RoleColors: Record<Role, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MEDECIN: 'bg-blue-100 text-blue-700',
  SECRETAIRE: 'bg-orange-100 text-orange-700',
  INFIRMIER: 'bg-teal-100 text-teal-700',
};
