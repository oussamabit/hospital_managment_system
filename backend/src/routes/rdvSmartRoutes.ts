import { Router } from 'express';
import {
  getAllRdv,
  getRdvById,
  createRdv,
  updateRdv,
  cancelRdv,
  deleteRdv,
  getCancelledSlots,
  getRescheduleSuggestions,
} from '../controllers/rdvSmartController';
import { authenticate } from '../middlewares/authMiddleware';
import { isAnyRole } from '../middlewares/roleGuard';

const router = Router();
router.use(authenticate);

router.get('/cancelled-slots',              isAnyRole, getCancelledSlots);
router.get('/:id/reschedule-suggestions',   isAnyRole, getRescheduleSuggestions);
router.get('/',                             isAnyRole, getAllRdv);
router.get('/:id',                          isAnyRole, getRdvById);
router.post('/',                            isAnyRole, createRdv);
router.put('/:id',                          isAnyRole, updateRdv);
router.patch('/:id/cancel',                isAnyRole, cancelRdv);
router.delete('/:id',                       isAnyRole, deleteRdv);

export default router;
