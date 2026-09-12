import { Router } from 'express';
import {
    getPendingUsers,
    getAllUsers,
    getUserById,
    approveUser,
    updateUserRole,
    updateUser,
    terminateUser,
    createUser,
} from '../controllers/userController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRoles } from '../middlewares/roleGuard';
import { Role } from '../models/User';

const router = Router();

// All routes here require Admin (Super Senior)
router.use(authenticate);
router.use(requireRoles(Role.ADMIN));

router.post('/', createUser);
router.get('/pending', getPendingUsers);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/approve', approveUser);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/terminate', terminateUser);

export default router;
