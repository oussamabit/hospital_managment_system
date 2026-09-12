import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/authMiddleware';
import AnalyseRequest from '../models/AnalyseRequest';
import Consultation from '../models/Consultation';
import logger from '../config/logger';

const DEFAULT_SERVICE_NAME = 'Chirurgie Generale et Cancerogene';

const analyseRequestSchema = z.object({
  consultation: z.string().uuid('ID Consultation invalide'),
  patient: z.string().uuid('ID Patient invalide'),
  motifDemande: z.string().optional(),
  selectedTests: z.array(z.string().min(1)).min(1, 'Au moins une analyse doit etre selectionnee'),
  otherTests: z.string().optional(),
});

export const createAnalyseRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = analyseRequestSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.issues[0].message, errors: result.error.issues });
      return;
    }

    const consultation = await Consultation.findById(result.data.consultation);
    if (!consultation) {
      res.status(404).json({ message: 'Consultation introuvable' });
      return;
    }

    const analyseRequest = await AnalyseRequest.create({
      ...result.data,
      medecin: req.user?._id,
      serviceName: DEFAULT_SERVICE_NAME,
    });

    res.status(201).json({ analyseRequest, message: 'Demande d\'analyse creee avec succes' });
  } catch (error) {
    logger.error('Create analyse request error:', error);
    res.status(500).json({ message: 'Erreur lors de la creation de la demande d\'analyse' });
  }
};

export const getAnalyseRequestById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analyseRequest = await AnalyseRequest.findById(req.params.id)
      .populate('patient', 'firstName lastName dossierNumber birthDate')
      .populate('medecin', 'firstName lastName numeroOrdre');

    if (!analyseRequest) {
      res.status(404).json({ message: 'Demande d\'analyse introuvable' });
      return;
    }

    res.json({ analyseRequest });
  } catch (error) {
    logger.error('Get analyse request by id error:', error);
    res.status(500).json({ message: 'Erreur lors de la recuperation de la demande d\'analyse' });
  }
};

export const getAnalyseRequestsByConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analyseRequests = await AnalyseRequest.find({ consultation: req.params.consultationId }).sort({ createdAt: -1 });
    res.json({ analyseRequests });
  } catch (error) {
    logger.error('Get analyse requests by consultation error:', error);
    res.status(500).json({ message: 'Erreur lors de la recuperation des demandes d\'analyse' });
  }
};

export const updateAnalyseRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = analyseRequestSchema.partial().safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.issues[0].message, errors: result.error.issues });
      return;
    }

    const analyseRequest = await AnalyseRequest.findByIdAndUpdate(
      req.params.id,
      { ...req.body, serviceName: DEFAULT_SERVICE_NAME },
      { new: true }
    );

    if (!analyseRequest) {
      res.status(404).json({ message: 'Demande d\'analyse introuvable' });
      return;
    }

    res.json({ analyseRequest, message: 'Demande d\'analyse mise a jour' });
  } catch (error) {
    logger.error('Update analyse request error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise a jour de la demande d\'analyse' });
  }
};

export const deleteAnalyseRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const analyseRequest = await AnalyseRequest.findByIdAndDelete(req.params.id);
    if (!analyseRequest) {
      res.status(404).json({ message: 'Demande d\'analyse introuvable' });
      return;
    }

    res.json({ message: 'Demande d\'analyse supprimee' });
  } catch (error) {
    logger.error('Delete analyse request error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la demande d\'analyse' });
  }
};
