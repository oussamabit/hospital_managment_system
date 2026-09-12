import { Router } from 'express';
import { getOptions, createOption, deleteOption } from '../controllers/optionController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Publicly readable or authenticated readable
router.get('/', getOptions);

// Protected editing (Role guard can be checked via frontend or middleware)
router.use(authenticate);
router.post('/', createOption);
router.delete('/:id', deleteOption);

export default router;
