import { Router } from 'express';
import {
  createConsultation,
  getConsultationById,
  getConsultationByRdv,
  getPatientConsultations,
  updateConsultation,
  getAllConsultations,
  deleteConsultation,
} from '../controllers/consultationController';
import { authenticate } from '../middlewares/authMiddleware';
import { isDoctor, blockSecretaire, requireRoles } from '../middlewares/roleGuard';
import { Role } from '../models/User';

const router = Router();

// ALL consultation routes are blocked for SECRETAIRE
router.use(authenticate, blockSecretaire);

const isMedical = requireRoles(Role.MEDECIN, Role.ADMIN);

router.get('/', requireRoles(Role.MEDECIN, Role.ADMIN, Role.INFIRMIER), getAllConsultations);
router.post('/', isMedical, createConsultation);
router.get('/rdv/:rdvId', isMedical, getConsultationByRdv);
router.get('/patient/:patientId', isMedical, getPatientConsultations);
router.get('/:id', isMedical, getConsultationById);
router.put('/:id', isMedical, updateConsultation);
router.delete('/:id', isMedical, deleteConsultation);

export default router;
