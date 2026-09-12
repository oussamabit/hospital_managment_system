import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import MedicalDocument, { DocumentType } from '../models/MedicalDocument';
import { AuthRequest } from '../middlewares/authMiddleware';
import logger from '../config/logger';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg, .jpeg and .pdf formats allowed!'));
  },
});

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Aucun fichier téléchargé' });
      return;
    }

    const { patient, type, notes } = req.body;

    if (!patient) {
      // Cleanup uploaded file if patient is missing
      fs.unlinkSync(req.file.path);
      res.status(400).json({ message: 'ID du patient requis' });
      return;
    }

    const document = await MedicalDocument.create({
      patient,
      type: type || DocumentType.OTHER,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      notes,
      uploadedBy: req.user!._id,
    });

    res.status(201).json({
      message: 'Document téléchargé avec succès',
      document,
    });
  } catch (error) {
    logger.error('Upload document error:', error);
    res.status(500).json({ message: 'Erreur lors du téléchargement du document' });
  }
};

export const getPatientDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { patientId } = req.params;
    const documents = await MedicalDocument.find({ patient: patientId })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ documents });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des documents' });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await MedicalDocument.findById(req.params.id);
    if (!document) {
      res.status(404).json({ message: 'Document introuvable' });
      return;
    }

    // Delete file from disk
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    await MedicalDocument.findByIdAndDelete(req.params.id);

    res.json({ message: 'Document supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du document' });
  }
};
