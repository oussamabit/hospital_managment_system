import { Router } from 'express';
import * as ordonnanceController from '../controllers/ordonnanceController';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { Role } from '../models/User';

const router = Router();

router.use(authenticate);

router.post('/', authorize([Role.MEDECIN, Role.ADMIN]), ordonnanceController.createOrdonnance);
router.get('/', ordonnanceController.getAllOrdonnances);
router.get('/consultation/:consultationId', ordonnanceController.getOrdonnanceByConsultation);
router.get('/:id', ordonnanceController.getOrdonnanceById);
router.patch('/:id', authorize([Role.MEDECIN, Role.ADMIN]), ordonnanceController.updateOrdonnance);
router.delete('/:id', authorize([Role.MEDECIN, Role.ADMIN]), ordonnanceController.deleteOrdonnance);

export default router;
