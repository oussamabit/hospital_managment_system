import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Ordonnance from '../models/Ordonnance';
import Consultation from '../models/Consultation';
import logger from '../config/logger';
import { logAction } from '../services/auditService';
import { AuditAction } from '../models/AuditLog';
import { z } from 'zod';

const medicationSchema = z.object({
  name: z.string().min(1, 'Nom du médicament requis'),
  dosage: z.string().min(1, 'Dosage requis'),
  duration: z.string().min(1, 'Durée requise'),
  instructions: z.string().optional(),
});

const createOrdonnanceSchema = z.object({
  consultation: z.string().uuid('ID Consultation invalide'),
  patient: z.string().uuid('ID Patient invalide'),
  medications: z.array(medicationSchema).min(1, 'Au moins un médicament est requis'),
  notes: z.string().optional(),
});

export const createOrdonnance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = createOrdonnanceSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message, errors: result.error.errors });
      return;
    }

    const { consultation, patient, medications, notes } = result.data;

    // Verify consultation existence and medecin ownership
    const consul = await Consultation.findById(consultation);
    if (!consul) {
      res.status(404).json({ message: 'Consultation introuvable' });
      return;
    }

    const ordonnance = await Ordonnance.create({
      consultation,
      patient,
      medecin: req.user?._id,
      medications,
      notes,
    });

    res.status(201).json({ ordonnance, message: 'Ordonnance créée avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.CREATE,
      resourceType: 'Ordonnance',
      resourceId: ordonnance._id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Créé une ordonnance pour le patient ${patient}`,
      newState: ordonnance.toObject(),
    });
  } catch (error) {
    logger.error('Create ordonnance error:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'ordonnance' });
  }
};

export const getOrdonnanceByConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { consultationId } = req.params;
    const ordonnances = await Ordonnance.find({ consultation: consultationId });
    res.json({ ordonnances });
  } catch (error) {
    logger.error('Get ordonnance error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'ordonnance' });
  }
};

export const getOrdonnanceById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ordonnance = await Ordonnance.findById(id)
      .populate('patient', 'firstName lastName dossierNumber')
      .populate('medecin', 'firstName lastName specialite numeroOrdre');
    
    if (!ordonnance) {
      res.status(404).json({ message: 'Ordonnance introuvable' });
      return;
    }
    res.json({ ordonnance });
  } catch (error) {
    logger.error('Get ordonnance by id error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'ordonnance' });
  }
};

export const updateOrdonnance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = createOrdonnanceSchema.partial().safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ message: result.error.errors[0].message, errors: result.error.errors });
            return;
        }

        const ordonnance = await Ordonnance.findByIdAndUpdate(id, req.body, { new: true });

        if (!ordonnance) {
            res.status(404).json({ message: 'Ordonnance introuvable' });
            return;
        }

        res.json({ ordonnance, message: 'Ordonnance mise à jour' });

        // Audit Log
        logAction({
            action: AuditAction.UPDATE,
            resourceType: 'Ordonnance',
            resourceId: id,
            performedBy: req.user?._id || 'SYSTEM',
            description: `Mis à jour l'ordonnance ${id}`,
            newState: ordonnance.toObject(),
        });
    } catch (error) {
        logger.error('Update ordonnance error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'ordonnance' });
    }
};

export const getAllOrdonnances = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { patient, medecin } = req.query;
        const filter: any = {};
        if (patient) filter.patient = patient;
        if (medecin) filter.medecin = medecin;

        const ordonnances = await Ordonnance.find(filter)
            .populate('patient', 'firstName lastName dossierNumber')
            .populate('medecin', 'firstName lastName specialite')
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({ ordonnances });
    } catch (error) {
        logger.error('Get all ordonnances error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des ordonnances' });
    }
};

export const deleteOrdonnance = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const ordonnance = await Ordonnance.findByIdAndDelete(id);

        if (!ordonnance) {
            res.status(404).json({ message: 'Ordonnance introuvable' });
            return;
        }

        res.json({ message: 'Ordonnance supprimée' });

        // Audit Log
        logAction({
            action: AuditAction.DELETE,
            resourceType: 'Ordonnance',
            resourceId: id,
            performedBy: req.user?._id || 'SYSTEM',
            description: `Supprimé l'ordonnance ${id}`,
            previousState: ordonnance.toObject()
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'ordonnance' });
    }
};
