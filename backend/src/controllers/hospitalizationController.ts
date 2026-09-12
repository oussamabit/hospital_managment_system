import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import Hospitalization from '../models/Hospitalization';
import { IImagingStudy, IStudyFile, ViewerType } from '../models/Hospitalization';
import { AuthRequest } from '../middlewares/authMiddleware';
import logger from '../config/logger';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const PATIENTS_ROOT = 'uploads/patients';

const VALID_IMAGING_TYPES = ['radiographie', 'echographie', 'scanner', 'irm'] as const;
type ImagingType = typeof VALID_IMAGING_TYPES[number];

const MODALITY_MAP: Record<ImagingType, string> = {
  radiographie: 'RX',
  echographie:  'US',
  scanner:      'CT',
  irm:          'MR',
};

const FOLDER_MAP: Record<ImagingType, string> = {
  radiographie: 'xray',
  echographie:  'echo',
  scanner:      'scanner',
  irm:          'irm',
};

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines viewer type from file list.
 * If majority are .dcm → 'dicom', PDF → 'pdf', else 'image'
 */
function detectViewerType(files: Express.Multer.File[]): ViewerType {
  const names = files.map(f => f.originalname.toLowerCase());
  const dicomCount = names.filter(n => n.endsWith('.dcm') || n.endsWith('.dicom') || !path.extname(n)).length;
  const pdfCount   = names.filter(n => n.endsWith('.pdf')).length;
  if (dicomCount > 0 && dicomCount >= files.length / 2) return 'dicom';
  if (pdfCount === files.length) return 'pdf';
  return 'image';
}

/**
 * Build the deterministic study folder path:
 *   uploads/patients/{patientId}/hospitalization_{hospN}/{modalityFolder}/{studyN}/
 *
 * hospN and studyN are determined by counting existing entries.
 */
async function buildStudyFolder(
  patientId: string,
  hospId:    string,
  imagingType: ImagingType,
): Promise<{ studyFolder: string; seriesNumber: number; hospNumber: number }> {

  // Get hospitalization index for this patient (1-based)
  const allHosps = await Hospitalization.find({ patientId }).sort({ createdAt: 1 }).select('_id');
  const hospNumber = allHosps.findIndex(h => String(h._id) === hospId) + 1 || 1;

  // Get current study count for this modality in this hospitalization
  const hosp = await Hospitalization.findById(hospId).select('bilanMorphologique');
  const existingStudies = (hosp?.bilanMorphologique?.studies || []) as IImagingStudy[];
  const sameModality = existingStudies.filter(s => s.imagingType === imagingType);
  const seriesNumber = sameModality.length + 1;

  const folderName = FOLDER_MAP[imagingType];
  const studyFolder = path.join(
    PATIENTS_ROOT,
    `patient_${patientId}`,
    `hospitalization_${hospNumber}`,
    folderName,
    `${folderName}_${seriesNumber}`,
  );

  return { studyFolder, seriesNumber, hospNumber };
}

/**
 * Sort files by DICOM metadata when available.
 * Priority: InstanceNumber > SliceLocation > ImagePositionPatient[2] > filename
 */
function naturalSort(files: Express.Multer.File[]): Express.Multer.File[] {
  return [...files].sort((a, b) =>
    a.originalname.localeCompare(b.originalname, undefined, { numeric: true, sensitivity: 'base' })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MULTER — temp storage for all uploads
// ─────────────────────────────────────────────────────────────────────────────
const tmpStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tmp = 'uploads/_tmp/';
    fs.mkdirSync(tmp, { recursive: true });
    cb(null, tmp);
  },
  filename: (_req, file, cb) => {
    // Keep original name; dedup handled during move
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

export const uploadImaging = multer({
  storage: tmpStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(dcm|dicom|jpe?g|png|pdf)$/i.test(file.originalname)
      || file.mimetype === 'application/dicom'
      || !path.extname(file.originalname); // DICOM without extension
    ok ? cb(null, true) : cb(new Error(`Format non supporté: ${file.originalname}`));
  },
});

export const uploadDicomFolder = multer({
  storage: tmpStorage,
  limits: { fileSize: 200 * 1024 * 1024, files: 2000 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(dcm|dicom|jpe?g|png|pdf)$/i.test(file.originalname)
      || file.mimetype === 'application/dicom'
      || !path.extname(file.originalname);
    ok ? cb(null, true) : cb(new Error(`Fichier non accepté: ${file.originalname}`));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  ZOD VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
const fnsSchema = z.object({
  gb: z.number().optional(), gr: z.number().optional(), hb: z.number().optional(),
  ht: z.number().optional(), vgm: z.number().optional(), tcmh: z.number().optional(),
  ccmh: z.number().optional(), plq: z.number().optional(),
}).optional();

const formuleLeucoSchema = z.object({
  neutrophiles: z.number().optional(), lymphocytes: z.number().optional(),
  monocytes: z.number().optional(), eosinophiles: z.number().optional(),
  basophiles: z.number().optional(),
}).optional();

const hospitalizationSchema = z.object({
  annee: z.string().optional(), dossierN: z.string().optional(),
  noBilletSalle: z.string().optional(), noLit: z.string().optional(),
  groupage: z.string().optional(), rh: z.string().optional(),
  profession: z.string().optional(), dateEntree: z.string().optional(),
  dateSortie: z.string().optional(), transfert: z.string().optional(),
  deces: z.string().optional(), motifAdmission: z.string().optional(),
  diagnostic: z.string().optional(), chirurgienTraitantId: z.string().optional(),
  chirurgienTraitantNom: z.string().optional(),
  examenClinique: z.object({
    etatGeneral: z.string().optional(), appareilCardioRespiratoire: z.string().optional(),
    histoireMaladie: z.string().optional(), appareilGenitoUrinaire: z.string().optional(),
    systemeNerveux: z.string().optional(), appareilDigestif: z.string().optional(),
    autresSystemes: z.string().optional(),
  }).optional(),
  motifHospitalisation: z.string().optional(), histoireMaladie: z.string().optional(),
  antecedentsMedicaux: z.string().optional(), antecedentsChirurgicaux: z.string().optional(),
  allergies: z.string().optional(),
  bilanBiologique: z.object({
    uree: z.number().optional(), creatinine: z.number().optional(),
    positif: z.string().optional(), negatif: z.string().optional(),
    fns: fnsSchema, formuleLeuco: formuleLeucoSchema, autresExamens: z.string().optional(),
  }).optional(),
  protocoleOperatoire: z.object({
    nomOperateur: z.string().optional(), aide: z.string().optional(),
    anesthesistes: z.string().optional(), diagnosticOperatoire: z.string().optional(),
    contenuProtocole: z.string().optional(),
  }).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────────────────────────────
export const getByPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hospitalizations = await Hospitalization.find({ patientId: req.params.patientId })
      .populate('chirurgienTraitantId', 'firstName lastName role')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json({ hospitalizations });
  } catch (error) {
    logger.error('getByPatient error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hosp = await Hospitalization.findById(req.params.id)
      .populate('chirurgienTraitantId', 'firstName lastName role specialite')
      .populate('createdBy', 'firstName lastName');
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }
    res.json({ hospitalization: hosp });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const createHospitalization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = hospitalizationSchema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ message: result.error.errors[0].message }); return; }
    const data: any = { ...result.data, patientId: req.params.patientId, createdBy: req.user!._id };
    if (data.dateEntree) data.dateEntree = new Date(data.dateEntree);
    if (data.dateSortie) data.dateSortie = new Date(data.dateSortie);
    const hosp = await Hospitalization.create(data);
    res.status(201).json({ hospitalization: hosp, message: 'Hospitalisation créée' });
  } catch (error) {
    logger.error('createHospitalization error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateHospitalization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = hospitalizationSchema.partial().safeParse(req.body);
    if (!result.success) { res.status(400).json({ message: result.error.errors[0].message }); return; }
    const data: any = { ...result.data };
    if (data.dateEntree) data.dateEntree = new Date(data.dateEntree);
    if (data.dateSortie) data.dateSortie = new Date(data.dateSortie);
    const hosp = await Hospitalization.findByIdAndUpdate(
      req.params.id, { $set: data }, { new: true, runValidators: true }
    ).populate('chirurgienTraitantId', 'firstName lastName').populate('createdBy', 'firstName lastName');
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }
    res.json({ hospitalization: hosp, message: 'Mise à jour effectuée' });
  } catch (error) {
    logger.error('updateHospitalization error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteHospitalization = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hosp = await Hospitalization.findByIdAndDelete(req.params.id);
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }
    // Delete all study folders on disk
    const studies = (hosp.bilanMorphologique?.studies || []) as IImagingStudy[];
    for (const s of studies) {
      if (s.studyFolder && fs.existsSync(s.studyFolder)) {
        fs.rmSync(s.studyFolder, { recursive: true, force: true });
      }
    }
    // Also clean up old-style folder if it exists
    const oldDir = path.join('uploads/hospitalization', req.params.id);
    if (fs.existsSync(oldDir)) fs.rmSync(oldDir, { recursive: true, force: true });
    res.json({ message: 'Hospitalisation supprimée' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DAILY FOLLOWUP
// ─────────────────────────────────────────────────────────────────────────────
export const addDailyFollowup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, notes, evolution } = req.body;
    if (!date || !notes) { res.status(400).json({ message: 'Date et notes requis' }); return; }
    const hosp = await Hospitalization.findByIdAndUpdate(
      req.params.id,
      { $push: { dailyFollowups: { date: new Date(date), notes, evolution, createdBy: req.user!._id } } },
      { new: true }
    );
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }
    res.json({ hospitalization: hosp, message: 'Suivi ajouté' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteDailyFollowup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hosp = await Hospitalization.findByIdAndUpdate(
      req.params.id,
      { $pull: { dailyFollowups: { _id: req.params.followupId } } },
      { new: true }
    );
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }
    res.json({ message: 'Suivi supprimé' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  UPLOAD — single file (legacy route kept for compat) + new studies route
// ─────────────────────────────────────────────────────────────────────────────
export const uploadImagingFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ message: 'Aucun fichier reçu' }); return; }
    const { imagingType, notes, description } = req.body;
    if (!VALID_IMAGING_TYPES.includes(imagingType)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ message: "Type d'imagerie invalide" });
      return;
    }

    const hospId    = req.params.id;
    const patientId = req.params.patientId || (await Hospitalization.findById(hospId))?.patientId || 'unknown';
    const { studyFolder, seriesNumber } = await buildStudyFolder(patientId, hospId, imagingType as ImagingType);

    fs.mkdirSync(studyFolder, { recursive: true });

    const ext          = path.extname(req.file.originalname).toLowerCase();
    const storedName   = `0001${ext}`;
    const destPath     = path.join(studyFolder, storedName);
    fs.renameSync(req.file.path, destPath);

    const viewerType: ViewerType = ext === '.pdf' ? 'pdf' : ext === '.dcm' || ext === '.dicom' ? 'dicom' : 'image';
    const modality = MODALITY_MAP[imagingType as ImagingType];

    const studyFile: IStudyFile = {
      fileId:       uuidv4(),
      storedName,
      originalName: req.file.originalname,
      filePath:     destPath.replace(/\\/g, '/'),
      fileType:     req.file.mimetype || 'application/octet-stream',
      uploadedAt:   new Date(),
    };

    const study: IImagingStudy = {
      studyId:      uuidv4(),
      studyLabel:   notes || `${modality} — ${new Date().toLocaleDateString('fr-FR')}`,
      viewerType,
      modality,
      imagingType,
      studyFolder:  studyFolder.replace(/\\/g, '/'),
      seriesNumber,
      files:        [studyFile],
      sliceCount:   1,
      uploadedAt:   new Date(),
      notes:        notes || '',
      description:  description || '',
    };

    const hosp = await Hospitalization.findByIdAndUpdate(
      hospId,
      { $push: { 'bilanMorphologique.studies': study } },
      { new: true }
    );
    if (!hosp) { fs.unlinkSync(destPath); res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }

    res.json({ message: 'Fichier uploadé', study, hospitalization: hosp });
  } catch (error) {
    logger.error('uploadImagingFile error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  UPLOAD — DICOM series / multi-file study
//
//  POST /api/hospitalizations/:id/imaging-series
//  POST /api/hospitalizations/:patientId/:id/studies  (new route alias)
//
//  New folder structure:
//    uploads/patients/patient_{patientId}/hospitalization_{N}/{modality}/{modality}_{N}/
//      0001.dcm, 0002.dcm, ...
//
//  Calls Python AI service for DICOM metadata extraction + slice ordering.
// ─────────────────────────────────────────────────────────────────────────────
export const uploadDicomSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  const tmpFiles: string[] = [];

  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ message: 'Aucun fichier reçu' }); return; }

    files.forEach(f => tmpFiles.push(f.path));

    const { imagingType, seriesLabel, notes, description } = req.body;
    if (!VALID_IMAGING_TYPES.includes(imagingType)) {
      tmpFiles.forEach(p => { try { fs.unlinkSync(p); } catch (_) {} });
      res.status(400).json({ message: "Type d'imagerie invalide" });
      return;
    }

    const hospId = req.params.id;
    const hosp0  = await Hospitalization.findById(hospId).select('patientId');
    if (!hosp0) {
      tmpFiles.forEach(p => { try { fs.unlinkSync(p); } catch (_) {} });
      res.status(404).json({ message: 'Hospitalisation introuvable' }); return;
    }

    const patientId  = hosp0.patientId;
    const { studyFolder, seriesNumber } = await buildStudyFolder(patientId, hospId, imagingType as ImagingType);
    fs.mkdirSync(studyFolder, { recursive: true });

    const viewerType = detectViewerType(files);
    const modality   = MODALITY_MAP[imagingType as ImagingType];

    // Sort files (natural order by original name — DICOM metadata sort done by Python)
    const sorted = naturalSort(files);

    // Move files → studyFolder with sequential naming 0001.ext, 0002.ext, ...
    const studyFiles: IStudyFile[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const f         = sorted[i];
      const ext       = path.extname(f.originalname).toLowerCase() || '.dcm';
      const storedName = `${String(i + 1).padStart(4, '0')}${ext}`;
      const destPath  = path.join(studyFolder, storedName);

      fs.renameSync(f.path, destPath);
      tmpFiles.splice(tmpFiles.indexOf(f.path), 1); // no longer temp

      studyFiles.push({
        fileId:       uuidv4(),
        storedName,
        originalName: f.originalname,
        filePath:     destPath.replace(/\\/g, '/'),
        fileType:     f.mimetype || 'application/dicom',
        uploadedAt:   new Date(),
      });
    }

    const studyId    = uuidv4();
    const studyLabel = seriesLabel || `${modality} — ${new Date().toLocaleDateString('fr-FR')}`;

    const studyEntry: IImagingStudy = {
      studyId,
      studyLabel,
      viewerType,
      modality,
      imagingType,
      studyFolder: studyFolder.replace(/\\/g, '/'),
      seriesNumber,
      files:       studyFiles,
      sliceCount:  studyFiles.length,
      uploadedAt:  new Date(),
      notes:       notes || '',
      description: description || '',
    };

    // Save to DB immediately — don't wait for Python metadata enrichment
    const updatedHosp = await Hospitalization.findByIdAndUpdate(
      hospId,
      { $push: { 'bilanMorphologique.studies': studyEntry } },
      { new: true }
    );

    logger.info(`Study uploaded: ${studyId} — ${studyFiles.length} files → ${studyFolder}`);

    // ── Background: call Python to sort by DICOM metadata & extract UIDs ──────
    if (viewerType === 'dicom') {
      const absFolder = path.resolve(studyFolder).replace(/\\/g, '/');
      fetch('http://localhost:8000/api/dicom/sort', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ folder_path: absFolder, study_id: studyId }),
      })
      .then(async r => {
        if (!r.ok) { logger.warn(`DICOM sort returned ${r.status}`); return; }
        const result = await r.json();
        logger.info(`DICOM sort done for ${studyId}: ${JSON.stringify(result.metadata)}`);
        // Update MongoDB with enriched metadata (studyUID, seriesUID, acquisitionDate, sorted files)
        if (result.ordered_files?.length) {
          const enrichedFiles: IStudyFile[] = result.ordered_files.map((of: any) => ({
            fileId:               uuidv4(),
            storedName:           of.storedName,
            originalName:         of.originalName,
            filePath:             of.filePath.replace(/\\/g, '/'),
            fileType:             'application/dicom',
            instanceNumber:       of.instanceNumber,
            sliceLocation:        of.sliceLocation,
            imagePositionPatient: of.imagePositionPatient,
            acquisitionDate:      of.acquisitionDate,
            uploadedAt:           new Date(),
          }));
          await Hospitalization.findOneAndUpdate(
            { _id: hospId, 'bilanMorphologique.studies.studyId': studyId },
            {
              $set: {
                'bilanMorphologique.studies.$.files':           enrichedFiles,
                'bilanMorphologique.studies.$.studyUID':        result.metadata?.studyUID,
                'bilanMorphologique.studies.$.seriesUID':       result.metadata?.seriesUID,
                'bilanMorphologique.studies.$.acquisitionDate': result.metadata?.acquisitionDate,
              }
            },
            { new: true }
          );
          logger.info(`DICOM metadata saved to DB for study ${studyId}`);
        }
      })
      .catch(err => logger.warn(`DICOM sort unavailable: ${err.message}`));
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.json({
      message:         `Étude uploadée : ${studyFiles.length} fichier(s)`,
      study:           studyEntry,
      hospitalization: updatedHosp,
    });

  } catch (error) {
    logger.error('uploadDicomSeries error:', error);
    tmpFiles.forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} });
    res.status(500).json({ message: "Erreur lors de l'upload" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE — study
// ─────────────────────────────────────────────────────────────────────────────
export const deleteDicomSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, seriesId } = req.params;   // seriesId = studyId in new arch
    const hosp = await Hospitalization.findById(id);
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }

    const studies = (hosp.bilanMorphologique?.studies || []) as IImagingStudy[];
    const target  = studies.find(s => s.studyId === seriesId);

    if (target?.studyFolder && fs.existsSync(target.studyFolder)) {
      fs.rmSync(target.studyFolder, { recursive: true, force: true });
      logger.info(`Deleted study folder: ${target.studyFolder}`);
    }

    await Hospitalization.findByIdAndUpdate(
      id,
      { $pull: { 'bilanMorphologique.studies': { studyId: seriesId } } },
      { new: true }
    );
    res.json({ message: 'Étude supprimée' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE — legacy single file
// ─────────────────────────────────────────────────────────────────────────────
export const deleteImagingFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, imagingType, fileId } = req.params;
    if (!VALID_IMAGING_TYPES.includes(imagingType as any)) {
      res.status(400).json({ message: "Type d'imagerie invalide" }); return;
    }
    const hosp = await Hospitalization.findById(id);
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }
    const legacyFiles: any[] = (hosp.bilanMorphologique as any)?.[imagingType] || [];
    const f = legacyFiles.find((x: any) => x.fileId === fileId);
    if (f?.filePath && fs.existsSync(f.filePath)) fs.unlinkSync(f.filePath);
    await Hospitalization.findByIdAndUpdate(
      id,
      { $pull: { [`bilanMorphologique.${imagingType}`]: { fileId } } },
      { new: true }
    );
    res.json({ message: 'Fichier supprimé' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DOWNLOAD — zip a study folder
// ─────────────────────────────────────────────────────────────────────────────
export const downloadDicomSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, seriesId } = req.params;
    const hosp = await Hospitalization.findById(id);
    if (!hosp) { res.status(404).json({ message: 'Hospitalisation introuvable' }); return; }

    const studies  = (hosp.bilanMorphologique?.studies || []) as IImagingStudy[];
    const target   = studies.find(s => s.studyId === seriesId);
    if (!target) { res.status(404).json({ message: 'Étude introuvable' }); return; }

    const folder = target.studyFolder;
    if (!folder || !fs.existsSync(folder)) {
      res.status(404).json({ message: 'Dossier introuvable sur le disque' }); return;
    }

    let archiverMod: any;
    try { archiverMod = require('archiver'); } catch (_) { archiverMod = null; }
    if (!archiverMod) {
      res.status(501).json({ message: 'Module archiver non installé. Exécutez: npm install archiver' });
      return;
    }

    const safeLabel = target.studyLabel.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeLabel}.zip"`);
    const archive = archiverMod('zip', { zlib: { level: 6 } });
    archive.on('error', (err: Error) => { logger.error('Archive error:', err); });
    archive.pipe(res);
    archive.directory(folder, safeLabel);
    await archive.finalize();

  } catch (error) {
    logger.error('downloadDicomSeries error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur téléchargement' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SERVE — individual file by studyId + index (for Cornerstone wado loader)
//  GET /api/hospitalizations/:id/studies/:studyId/files/:fileIndex
// ─────────────────────────────────────────────────────────────────────────────
export const serveStudyFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, studyId, fileIndex } = req.params;
    const hosp = await Hospitalization.findById(id);
    if (!hosp) { res.status(404).json({ message: 'Non trouvé' }); return; }

    const studies = (hosp.bilanMorphologique?.studies || []) as IImagingStudy[];
    const study   = studies.find(s => s.studyId === studyId);
    if (!study) { res.status(404).json({ message: 'Étude introuvable' }); return; }

    const idx  = parseInt(fileIndex, 10);
    const file = study.files[idx];
    if (!file) { res.status(404).json({ message: 'Fichier introuvable' }); return; }

    if (!fs.existsSync(file.filePath)) { res.status(404).json({ message: 'Fichier manquant sur le disque' }); return; }

    const mime = file.fileType || 'application/dicom';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${file.storedName}"`);
    // CORS headers for Cornerstone
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length');
    fs.createReadStream(file.filePath).pipe(res);

  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
