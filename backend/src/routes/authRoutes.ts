import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  getDoctors,
  signup,
} from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10'),
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Trop de requêtes de rafraîchissement.' },
});

router.post('/signup', signup);
router.post('/login', loginLimiter, login);
router.post('/refresh', refreshLimiter, refreshToken);
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.get('/doctors', authenticate, getDoctors);

export default router;
