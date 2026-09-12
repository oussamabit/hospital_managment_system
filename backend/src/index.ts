import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db';
import logger from './config/logger';
import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import rdvRoutes from './routes/rdvRoutes';
import consultationRoutes from './routes/consultationRoutes';
import userRoutes from './routes/userRoutes';
import serviceRoutes from './routes/serviceRoutes';
import optionRoutes from './routes/optionRoutes';
import auditRoutes from './routes/auditRoutes';
import ordonnanceRoutes from './routes/ordonnanceRoutes';
import adminRoutes from './routes/adminRoutes';
import documentRoutes from './routes/documentRoutes';
import hospitalizationRoutes from './routes/hospitalizationRoutes';
import onCallRoutes from './routes/onCallRoutes';
import rdvSmartRoutes from './routes/rdvSmartRoutes';
import { errorHandler, notFound } from './middlewares/errorHandler';
import './models'; // Register all models
import analyseRequestRoutes from './routes/analyseRequestRoutes';

const app = express();
const PORT = process.env.PORT || 5005;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  // Allow Cornerstone.js to load DICOM files in cross-origin context
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Support comma-separated origins in CORS_ORIGIN env var
// e.g. CORS_ORIGIN=http://localhost:5173,http://localhost:5174
const rawOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set(rawOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Expose Content-Length so Cornerstone can track download progress
    exposedHeaders: ['Content-Length', 'Content-Type'],
  })
);

// Preflight for all routes
app.options('*', cors());

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.includes('/studies/') && req.path.includes('/files/'),
});
app.use(globalLimiter);

// High-limit rate limiter specifically for DICOM file serving
// 133 slices + preloading = hundreds of requests per session
const dicomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/hospitalizations', dicomLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static folder for uploads — with cross-origin headers for DICOM files
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  next();
}, express.static('uploads'));

// Routes
app.use('/api/auth',            authRoutes);
app.use('/api/patients',        patientRoutes);
app.use('/api/rdv',             rdvRoutes);
app.use('/api/consultations',   consultationRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/services',        serviceRoutes);
app.use('/api/options',         optionRoutes);
app.use('/api/audit',           auditRoutes);
app.use('/api/ordonnances',     ordonnanceRoutes);
app.use('/api/admin',           adminRoutes);
app.use('/api/documents',       documentRoutes);
app.use('/api/hospitalizations', hospitalizationRoutes);
app.use('/api/on-call',         onCallRoutes);
app.use('/api/rdv-smart',       rdvSmartRoutes);
app.use('/api/analyse-requests', analyseRequestRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`CORS allowed origins: ${[...allowedOrigins].join(', ')}`);
});

export default app;
