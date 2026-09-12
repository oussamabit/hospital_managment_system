import { Router } from 'express';
import {
  getScheduleByDate,
  getScheduleRange,
  getAvailableSlots,
  getDoctorsOnCall,
  upsertSchedule,
  publishSchedule,
  deleteSchedule,
  getDoctorConstraints,
  upsertDoctorConstraints,
} from '../controllers/onCallController';
import { authenticate } from '../middlewares/authMiddleware';
import { isAnyRole } from '../middlewares/roleGuard';

const router = Router();
router.use(authenticate);

// Read (Secretary + Admin)
router.get('/range',                            isAnyRole, getScheduleRange);
router.get('/doctors-on-call/:date',            isAnyRole, getDoctorsOnCall);
router.get('/available-slots/:doctorId/:date',  isAnyRole, getAvailableSlots);
router.get('/constraints/:doctorId',            isAnyRole, getDoctorConstraints);
router.get('/date/:date',                       isAnyRole, getScheduleByDate);

// Write (Admin only — enforced inside controller)
router.post('/',                                isAnyRole, upsertSchedule);
router.patch('/:id/publish',                   isAnyRole, publishSchedule);
router.delete('/:id',                          isAnyRole, deleteSchedule);
router.put('/constraints/:doctorId',           isAnyRole, upsertDoctorConstraints);

export default router;
