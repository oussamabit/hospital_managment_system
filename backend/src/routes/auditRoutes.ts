import { Router } from 'express';
import { getLogs, undo } from '../controllers/auditController';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { Role } from '../models/User';

const router = Router();

// Only Admins can see or revert audit logs
router.use(authenticate, authorize([Role.ADMIN]));

router.get('/', getLogs);
router.post('/:id/undo', undo);

export default router;
