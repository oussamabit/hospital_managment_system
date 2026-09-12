import { Response } from 'express';
import { z } from 'zod';
import RendezVous, { RdvStatus } from '../models/RendezVous';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Role, Grade } from '../models/User';
import logger from '../config/logger';
import { logAction } from '../services/auditService';
import { AuditAction } from '../models/AuditLog';

const createRdvSchema = z.object({
  patient: z.string().min(1, 'Patient requis'),
  medecin: z.string().min(1, 'Médecin requis'),
  service: z.string().min(1, 'Service requis'),
  dateTime: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date/heure invalide'),
  duration: z.number().min(15).max(240).default(30),
  motif: z.string().min(3, 'Motif requis'),
  notes: z.string().optional(),
});

const updateRdvSchema = createRdvSchema.partial().extend({
  status: z.nativeEnum(RdvStatus).optional(),
  cancelReason: z.string().optional(),
});

const checkRdvConflict = async (medecinId: string, dateTime: Date, duration: number, excludeId?: string) => {
  const start = new Date(dateTime);
  const end = new Date(start.getTime() + duration * 60000);

  const query: any = {
    medecin: medecinId,
    status: { $in: [RdvStatus.PLANIFIE, RdvStatus.CONFIRME, RdvStatus.EN_COURS] },
    $and: [
      { dateTime: { $lt: end } },
      { 
        $expr: {
          $gt: [
            { $add: ['$dateTime', { $multiply: ['$duration', 60000] }] },
            start
          ]
        }
      }
    ]
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existing = await RendezVous.findOne(query).populate('patient', 'firstName lastName');
  return existing;
};

export const getAllRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      status,
      medecin,
      patient,
      service,
      dateFrom,
      dateTo,
      search,
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, unknown> = {};

    // MEDECIN (JUNIOR) only sees their own RDV
    if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.JUNIOR) {
      filter.medecin = req.user._id;
    } else if (medecin) {
      filter.medecin = medecin;
    }

    if (status) {
      if (status.includes(',')) {
        filter.status = { $in: status.split(',') };
      } else {
        filter.status = status;
      }
    }
    if (patient) filter.patient = patient;
    if (service) filter.service = service;
    if (dateFrom || dateTo) {
      filter.dateTime = {};
      if (dateFrom) (filter.dateTime as Record<string, unknown>).$gte = new Date(dateFrom);
      if (dateTo) (filter.dateTime as Record<string, unknown>).$lte = new Date(dateTo);
    }

    const [rdvs, total] = await Promise.all([
      RendezVous.find(filter)
        .populate('patient', 'firstName lastName dossierNumber phone')
        .populate('medecin', 'firstName lastName role')
        .populate('service', 'nomService')
        .populate('createdBy', 'firstName lastName')
        .sort({ dateTime: 1 })
        .skip(skip)
        .limit(limitNum),
      RendezVous.countDocuments(filter),
    ]);

    res.json({
      rdvs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get rdv error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des rendez-vous' });
  }
};

export const getRdvById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdv = await RendezVous.findById(req.params.id)
      .populate('patient', 'firstName lastName dossierNumber phone birthDate gender')
      .populate('medecin', 'firstName lastName role phone')
      .populate('service', 'nomService')
      .populate('createdBy', 'firstName lastName');

    if (!rdv) {
      res.status(404).json({ message: 'Rendez-vous introuvable' });
      return;
    }

    // JUNIOR can only see their own
    if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.JUNIOR && rdv.medecin.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }

    res.json({ rdv });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du rendez-vous' });
  }
};

export const createRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = createRdvSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message, errors: result.error.errors });
      return;
    }

    // Role-based medecin selection logic
    let medecinId = result.data.medecin;
    // We allow doctors to choose themselves or others if specified
    if (!medecinId && req.user?.role === Role.MEDECIN) {
      medecinId = req.user._id as string;
    }

    const rdvDate = new Date(result.data.dateTime);
    const duration = result.data.duration || 30;

    const conflict = await checkRdvConflict(medecinId, rdvDate, duration);
    if (conflict) {
      res.status(400).json({ 
        message: `Le médecin a déjà un rendez-vous à cette heure (${(conflict.patient as any).firstName} ${(conflict.patient as any).lastName})`,
        conflict 
      });
      return;
    }

    const rdv = await RendezVous.create({
      ...result.data,
      medecin: medecinId,
      dateTime: rdvDate,
      createdBy: req.user!._id,
    });

    const populated = await rdv.populate([
      { path: 'patient', select: 'firstName lastName dossierNumber' },
      { path: 'medecin', select: 'firstName lastName role' },
      { path: 'service', select: 'nomService' },
    ]);

    res.status(201).json({ rdv: populated, message: 'Rendez-vous créé avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.CREATE,
      resourceType: 'RendezVous',
      resourceId: rdv._id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Créé un rendez-vous pour le patient ${populated.patient.firstName} ${populated.patient.lastName}`,
      newState: populated.toObject()
    });
  } catch (error) {
    logger.error('Create rdv error:', error);
    res.status(500).json({ message: 'Erreur lors de la création du rendez-vous' });
  }
};

export const updateRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = updateRdvSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const rdv = await RendezVous.findById(req.params.id);
    if (!rdv) {
      res.status(404).json({ message: 'Rendez-vous introuvable' });
      return;
    }

    // MEDECIN (JUNIOR) can only modify their own
    if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.JUNIOR && rdv.medecin.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres rendez-vous' });
      return;
    }

    // Can't modify a TERMINE or ANNULE rdv
    if ([RdvStatus.TERMINE, RdvStatus.ANNULE].includes(rdv.status)) {
      res.status(400).json({ message: 'Impossible de modifier un rendez-vous terminé ou annulé' });
      return;
    }

    const updateData = {
      ...result.data,
      ...(result.data.dateTime && { dateTime: new Date(result.data.dateTime) }),
    };

    // Check conflict if date or doctor or duration changes
    if (updateData.dateTime || updateData.medecin || updateData.duration) {
      const finalMedecin = updateData.medecin || rdv.medecin.toString();
      const finalDate = updateData.dateTime || rdv.dateTime;
      const finalDuration = updateData.duration || rdv.duration;

      const conflict = await checkRdvConflict(finalMedecin, finalDate, finalDuration, rdv._id.toString());
      if (conflict) {
        res.status(400).json({ 
          message: `Conflit d'horaire: le médecin est déjà occupé (${(conflict.patient as any).firstName} ${(conflict.patient as any).lastName})`,
          conflict 
        });
        return;
      }
    }

    const oldRdvState = rdv.toObject();

    const updated = await RendezVous.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('patient', 'firstName lastName dossierNumber')
      .populate('medecin', 'firstName lastName role');

    if (!updated) {
      res.status(404).json({ message: 'Rendez-vous introuvable' });
      return;
    }

    res.json({ rdv: updated, message: 'Rendez-vous mis à jour avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.UPDATE,
      resourceType: 'RendezVous',
      resourceId: updated._id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Mis à jour le rendez-vous de ${updated.patient.firstName} ${updated.patient.lastName}`,
      previousState: oldRdvState,
      newState: updated.toObject()
    });
  } catch (error) {
    logger.error('Update rdv error:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du rendez-vous' });
  }
};

export const cancelRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cancelReason } = req.body;

    const rdv = await RendezVous.findById(req.params.id).populate('patient', 'firstName lastName');
    if (!rdv) {
      res.status(404).json({ message: 'Rendez-vous introuvable' });
      return;
    }

    if (rdv.status === RdvStatus.ANNULE) {
      res.status(400).json({ message: 'Ce rendez-vous est déjà annulé' });
      return;
    }

    if (rdv.status === RdvStatus.TERMINE) {
      res.status(400).json({ message: 'Impossible d\'annuler un rendez-vous terminé' });
      return;
    }

    const oldState = rdv.toObject();
    rdv.status = RdvStatus.ANNULE;
    rdv.cancelReason = cancelReason || 'Annulé par l\'utilisateur';
    await rdv.save();

    res.json({ rdv, message: 'Rendez-vous annulé avec succès' });

    // Audit Log
    logAction({
      action: AuditAction.STATUS_CHANGE,
      resourceType: 'RendezVous',
      resourceId: rdv._id,
      performedBy: req.user?._id || 'SYSTEM',
      description: `Annulé le rendez-vous de ${(rdv.patient as any).firstName} ${(rdv.patient as any).lastName}`,
      previousState: oldState,
      newState: rdv.toObject()
    });
  } catch (error) {
    logger.error('Cancel rdv error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'annulation du rendez-vous' });
  }
};

export const deleteRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const oldRdv = await RendezVous.findById(req.params.id).populate('patient', 'firstName lastName');
    const rdv = await RendezVous.findByIdAndDelete(req.params.id);
    if (!rdv) {
      res.status(404).json({ message: 'Rendez-vous introuvable' });
      return;
    }
    res.json({ message: 'Rendez-vous supprimé avec succès' });

    // Audit Log
    if (oldRdv) {
      logAction({
        action: AuditAction.DELETE,
        resourceType: 'RendezVous',
        resourceId: oldRdv._id,
        performedBy: req.user?._id || 'SYSTEM',
        description: `Supprimé le rendez-vous de ${(oldRdv.patient as any).firstName} ${(oldRdv.patient as any).lastName}`,
        previousState: oldRdv.toObject()
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du rendez-vous' });
  }
};

export const getTodayRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filter: Record<string, unknown> = {
      dateTime: { $gte: today, $lt: tomorrow },
    };

    if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.JUNIOR) {
      filter.medecin = req.user._id;
    }

    const rdvs = await RendezVous.find(filter)
      .populate('patient', 'firstName lastName dossierNumber phone')
      .populate('medecin', 'firstName lastName')
      .sort({ dateTime: 1 });

    res.json({ rdvs });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des rendez-vous du jour' });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseFilter: Record<string, unknown> = {};
    if (req.user?.role === Role.MEDECIN && (req.user as any).grade === Grade.JUNIOR) {
      baseFilter.medecin = req.user?._id;
    }

    const [todayTotal, todayInProgress, todayCompleted, todayPlanned, totalPatients] = await Promise.all([
      RendezVous.countDocuments({ ...baseFilter, dateTime: { $gte: today, $lt: tomorrow } }),
      RendezVous.countDocuments({ ...baseFilter, dateTime: { $gte: today, $lt: tomorrow }, status: RdvStatus.EN_COURS }),
      RendezVous.countDocuments({ ...baseFilter, dateTime: { $gte: today, $lt: tomorrow }, status: RdvStatus.TERMINE }),
      RendezVous.countDocuments({ ...baseFilter, dateTime: { $gte: today, $lt: tomorrow }, status: { $in: [RdvStatus.PLANIFIE, RdvStatus.CONFIRME] } }),
      req.user?.role !== Role.SECRETAIRE ? require('../models/Patient').default.countDocuments() : Promise.resolve(0),
    ]);

    res.json({
      stats: {
        todayTotal,
        todayInProgress,
        todayCompleted,
        todayPlanned,
        totalPatients,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
};
