import { Response } from 'express';
import { z } from 'zod';
import Consultation from '../models/Consultation';
import RendezVous, { RdvStatus } from '../models/RendezVous';
import DossierMedical from '../models/DossierMedical';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Role, Grade } from '../models/User';
import logger from '../config/logger';
import { logAction } from '../services/auditService';
import { AuditAction } from '../models/AuditLog';

const createConsultationSchema = z.object({
  rendezvous: z.string().min(1, 'Rendez-vous requis'),
  diagnosticPrincipal: z.string().min(3, 'Diagnostic principal requis'),
  examenClinique: z.string().min(3, 'Examen clinique requis'),
  conclusion: z.string().min(3, 'Conclusion requise'),
  traitementPrescrit: z.string().optional(),
  recommendations: z.string().optional(),
  notes: z.string().optional(),
  digitalSignature: z.string().optional(),
});

export const getAllConsultations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      medecin,
      patient,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    // MEDECIN (JUNIOR) only sees their own
    if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.JUNIOR) {
      filter.medecin = req.user._id;
    } else if (medecin) {
      filter.medecin = medecin;
    }

    if (patient) filter.patient = patient;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) (filter.createdAt as Record<string, unknown>).$gte = new Date(dateFrom);
      if (dateTo) (filter.createdAt as Record<string, unknown>).$lte = new Date(dateTo);
    }

    const [consultations, total] = await Promise.all([
      Consultation.find(filter)
        .populate('patient', 'firstName lastName dossierNumber')
        .populate('medecin', 'firstName lastName role')
        .populate('rendezvous', 'dateTime motif')
        .populate('createdBy', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Consultation.countDocuments(filter),
    ]);

    res.json({
      consultations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get consultations error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des consultations' });
  }
};

export const createConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = createConsultationSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message, errors: result.error.errors });
      return;
    }

    // Find the RDV
    const rdv = await RendezVous.findById(result.data.rendezvous);
    if (!rdv) {
      res.status(404).json({ message: 'Rendez-vous introuvable' });
      return;
    }

    // MEDECIN (JUNIOR) can only create consultation for own RDV
    if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.JUNIOR && rdv.medecin.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Vous ne pouvez créer des consultations que pour vos propres patients' });
      return;
    }

    // Check if consultation already exists
    const existing = await Consultation.findOne({ rendezvous: result.data.rendezvous });
    if (existing) {
      res.status(409).json({ message: 'Une consultation existe déjà pour ce rendez-vous' });
      return;
    }

    // Find DossierMedical
    const dossier = await DossierMedical.findOne({ patientId: rdv.patient });
    if (!dossier) {
      res.status(404).json({ message: 'Dossier médical introuvable pour ce patient' });
      return;
    }

    // Validation logic
    const isSenior = req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.SENIOR;

    const consultation = await Consultation.create({
      ...result.data,
      patient: rdv.patient,
      medecin: rdv.medecin,
      dossierMedical: dossier._id,
      isValidatedBySenior: isSenior,
      validatorId: isSenior ? req.user?._id : undefined,
      dateConsultation: new Date(),
      createdBy: req.user!._id,
    });

    // Update RDV status to TERMINE
    rdv.status = RdvStatus.TERMINE;
    await rdv.save();

    // Update DossierMedical with last consultation
    dossier.derniereConsultationId = consultation._id;
    await dossier.save();

    const populated = await consultation.populate([
      { path: 'patient', select: 'firstName lastName dossierNumber' },
      { path: 'medecin', select: 'firstName lastName role' },
      { path: 'rendezvous', select: 'dateTime motif' },
      { path: 'dossierMedical', select: 'statut' },
      { path: 'createdBy', select: 'firstName lastName role' },
    ]);

    res.status(201).json({ consultation: populated, message: 'Consultation créée avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.CREATE,
      resourceType: 'Consultation',
      resourceId: consultation._id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Créé la consultation pour le patient ${populated.patient.firstName} ${populated.patient.lastName}`,
      newState: populated.toObject()
    });
  } catch (error) {
    logger.error('Create consultation error:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la consultation' });
  }
};

export const getConsultationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('patient', 'firstName lastName dossierNumber birthDate gender phone')
      .populate('medecin', 'firstName lastName role')
      .populate('rendezvous', 'dateTime motif')
      .populate('createdBy', 'firstName lastName role');

    if (!consultation) {
      res.status(404).json({ message: 'Consultation introuvable' });
      return;
    }

    // MEDECIN (JUNIOR) can only view own consultations
    if (
      req.user?.role === Role.MEDECIN &&
      (req.user as any).grade === Grade.JUNIOR &&
      consultation.medecin.toString() !== req.user._id.toString()
    ) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }

    res.json({ consultation });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la consultation' });
  }
};

export const getConsultationByRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const consultation = await Consultation.findOne({ rendezvous: req.params.rdvId })
      .populate('patient', 'firstName lastName dossierNumber birthDate gender phone')
      .populate('medecin', 'firstName lastName role')
      .populate('rendezvous', 'dateTime motif')
      .populate('dossierMedical')
      .populate('createdBy', 'firstName lastName role');

    if (!consultation) {
      res.status(404).json({ message: 'Aucune consultation pour ce rendez-vous' });
      return;
    }

    res.json({ consultation });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la consultation' });
  }
};

export const getPatientConsultations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const consultations = await Consultation.find({ patient: req.params.patientId })
      .populate('medecin', 'firstName lastName role')
      .populate('rendezvous', 'dateTime motif')
      .populate('dossierMedical')
      .populate('createdBy', 'firstName lastName role')
      .sort({ createdAt: -1 });

    res.json({ consultations });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des consultations' });
  }
};

export const updateConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updateSchema = createConsultationSchema.omit({ rendezvous: true }).partial();
    const result = updateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) {
      res.status(404).json({ message: 'Consultation introuvable' });
      return;
    }

    // MEDECIN (JUNIOR) can only update own consultations
    if (
      req.user?.role === Role.MEDECIN &&
      (req.user as any).grade === Grade.JUNIOR &&
      consultation.medecin.toString() !== req.user._id.toString()
    ) {
      res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres consultations' });
      return;
    }

    const oldConsult = await Consultation.findById(req.params.id);
    const oldConsultState = oldConsult?.toObject();

    const updated = await Consultation.findByIdAndUpdate(
      req.params.id,
      { $set: result.data },
      { new: true, runValidators: true }
    )
      .populate('patient', 'firstName lastName dossierNumber')
      .populate('medecin', 'firstName lastName role')
      .populate('rendezvous', 'dateTime motif')
      .populate('createdBy', 'firstName lastName role');

    res.json({ consultation: updated, message: 'Consultation mise à jour avec succès' });

    // Audit Log
    if (updated) {
      logAction({
        action: AuditAction.UPDATE,
        resourceType: 'Consultation',
        resourceId: updated._id,
        performedBy: req.user?._id || 'SYSTEM',
        description: `Mis à jour la consultation du patient ${updated.patient.firstName} ${updated.patient.lastName}`,
        previousState: oldConsultState,
        newState: updated.toObject()
      });
    }
  } catch (error) {
    logger.error('Update consultation error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la consultation' });
  }
};
export const deleteConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const consultation = await Consultation.findById(req.params.id).populate('patient', 'firstName lastName');
    if (!consultation) {
      res.status(404).json({ message: 'Consultation introuvable' });
      return;
    }

    // Only Admin or the creator/medecin can delete
    const isOwner = consultation.medecin.toString() === req.user?._id.toString() || 
                    consultation.createdBy.toString() === req.user?._id.toString();
    
    if (req.user?.role !== Role.ADMIN && !isOwner) {
      res.status(403).json({ message: 'Vous n\'avez pas la permission de supprimer cette consultation' });
      return;
    }

    const patientName = (consultation.patient as any)?.firstName + ' ' + (consultation.patient as any)?.lastName;
    const oldState = consultation.toObject();

    await Consultation.findByIdAndDelete(req.params.id);

    res.json({ message: 'Consultation supprimée avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.DELETE,
      resourceType: 'Consultation',
      resourceId: req.params.id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Supprimé la consultation du patient ${patientName}`,
      previousState: oldState
    });
  } catch (error) {
    logger.error('Delete consultation error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la consultation' });
  }
};
