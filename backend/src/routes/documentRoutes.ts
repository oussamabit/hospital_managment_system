import { Router } from 'express';
import { uploadDocument, getPatientDocuments, deleteDocument, upload } from '../controllers/documentController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/patient/:patientId', getPatientDocuments);
router.delete('/:id', deleteDocument);

export default router;
