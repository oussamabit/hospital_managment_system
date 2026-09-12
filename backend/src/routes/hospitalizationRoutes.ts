import { Router } from 'express';
import {
  getByPatient, getById,
  createHospitalization, updateHospitalization, deleteHospitalization,
  addDailyFollowup, deleteDailyFollowup,
  uploadImagingFile, deleteImagingFile, uploadImaging,
  uploadDicomSeries, deleteDicomSeries, downloadDicomSeries,
  uploadDicomFolder, serveStudyFile,
} from '../controllers/hospitalizationController';
import { authenticate } from '../middlewares/authMiddleware';
import { isAnyRole } from '../middlewares/roleGuard';

const router = Router();
router.use(authenticate);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/patient/:patientId',  isAnyRole, getByPatient);
router.post('/patient/:patientId', isAnyRole, createHospitalization);
router.get('/:id',    isAnyRole, getById);
router.put('/:id',    isAnyRole, updateHospitalization);
router.delete('/:id', isAnyRole, deleteHospitalization);

// ── Daily followup ────────────────────────────────────────────────────────────
router.post('/:id/followup',               isAnyRole, addDailyFollowup);
router.delete('/:id/followup/:followupId', isAnyRole, deleteDailyFollowup);

// ── Single file upload (legacy + new single-file studies) ─────────────────────
router.post('/:id/imaging',                        isAnyRole, uploadImaging.single('file'), uploadImagingFile);
router.delete('/:id/imaging/:imagingType/:fileId', isAnyRole, deleteImagingFile);

// ── Multi-file DICOM series / imaging studies ─────────────────────────────────
router.post('/:id/imaging-series',                    isAnyRole, uploadDicomFolder.array('files', 2000), uploadDicomSeries);
router.get('/:id/imaging-series/:seriesId/download',  isAnyRole, downloadDicomSeries);
router.delete('/:id/imaging-series/:seriesId',        isAnyRole, deleteDicomSeries);

// ── Individual file serving for Cornerstone WADO loader ──────────────────────
// GET /api/hospitalizations/:id/studies/:studyId/files/:fileIndex
router.get('/:id/studies/:studyId/files/:fileIndex', isAnyRole, serveStudyFile);

export default router;
