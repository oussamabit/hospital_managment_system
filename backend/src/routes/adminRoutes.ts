import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { Role } from '../models/User';

const router = Router();

router.use(authenticate);
router.use(authorize([Role.ADMIN]));

router.get('/export-data', adminController.exportAllData);

export default router;
