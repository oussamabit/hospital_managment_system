import { Router } from 'express';
import {
  getAllRdv,
  getRdvById,
  createRdv,
  updateRdv,
  cancelRdv,
  deleteRdv,
  getTodayRdv,
  getDashboardStats,
} from '../controllers/rdvController';
import { authenticate } from '../middlewares/authMiddleware';
import { isAnyRole, isSenior } from '../middlewares/roleGuard';

const router = Router();

router.use(authenticate);

router.get('/stats', isAnyRole, getDashboardStats);
router.get('/today', isAnyRole, getTodayRdv);
router.get('/', isAnyRole, getAllRdv);
router.get('/:id', isAnyRole, getRdvById);
router.post('/', isAnyRole, createRdv);
router.put('/:id', isAnyRole, updateRdv);
router.patch('/:id/cancel', isAnyRole, cancelRdv);
router.delete('/:id', isSenior, deleteRdv);

export default router;
