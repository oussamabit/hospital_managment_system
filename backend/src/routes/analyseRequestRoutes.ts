import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRoles } from '../middlewares/roleGuard';
import { Role } from '../models/User';
import {
  createAnalyseRequest,
  getAnalyseRequestById,
  getAnalyseRequestsByConsultation,
  updateAnalyseRequest,
  deleteAnalyseRequest,
} from '../controllers/analyseRequestController';

const router = Router();

router.use(authenticate);

router.post('/', requireRoles(Role.MEDECIN, Role.ADMIN), createAnalyseRequest);
router.get('/consultation/:consultationId', requireRoles(Role.MEDECIN, Role.ADMIN, Role.INFIRMIER), getAnalyseRequestsByConsultation);
router.get('/:id', requireRoles(Role.MEDECIN, Role.ADMIN, Role.INFIRMIER), getAnalyseRequestById);
router.patch('/:id', requireRoles(Role.MEDECIN, Role.ADMIN), updateAnalyseRequest);
router.delete('/:id', requireRoles(Role.MEDECIN, Role.ADMIN), deleteAnalyseRequest);

export default router;
