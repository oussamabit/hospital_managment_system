import { Router } from 'express';
import {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
} from '../controllers/patientController';
import { authenticate } from '../middlewares/authMiddleware';
import { isAnyRole, isSenior } from '../middlewares/roleGuard';

const router = Router();

router.use(authenticate);

router.get('/', isAnyRole, getAllPatients);
router.get('/:id', isAnyRole, getPatientById);
router.post('/', isAnyRole, createPatient);
router.put('/:id', isAnyRole, updatePatient);
router.delete('/:id', isSenior, deletePatient);

export default router;
