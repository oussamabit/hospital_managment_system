import { Router } from 'express';
import { getAllServices, getServiceById, createService } from '../controllers/serviceController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// All service routes are protected
router.use(authenticate);

router.get('/', getAllServices);
router.post('/', createService);
router.get('/:id', getServiceById);

export default router;
