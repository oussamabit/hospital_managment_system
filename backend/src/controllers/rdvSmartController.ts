import { Response } from 'express';
import { z } from 'zod';
import RendezVous from '../models/RendezVous';
import { OnCallSchedule } from '../models/OnCallSchedule';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  checkConflict,
  getFreedSlotInfo,
  normalizeDate,
  getDoctorAvailability,
  findAffectedAppointments,
} from '../services/appointmentService';
import logger from '../config/logger';

// ── Validation ────────────────────────────────────────────────────────────────

const rdvCreateSchema = z.object({
  patient:  z.string().min(1, 'Patient requis'),
  medecin:  z.string().min(1, 'Medecin requis'),
  service:  z.string().optional(),
  dateTime: z.string().min(1, 'Date et heure requises'),
  motif:    z.string().min(1, 'Motif requis'),
  notes:    z.string().optional(),
  status:   z.string().default('PLANIFIE'),
  duration: z.number().int().optional(),
});

// ── GET all RDV ───────────────────────────────────────────────────────────────

export const getAllRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { patient, medecin, date, status, from, to, limit = 50, page = 1 } = req.query as any;

    const filter: any = {};
    if (patient) filter.patient = patient;
    if (medecin) filter.medecin = medecin;
    if (status)  filter.status  = status;

    if (date) {
      const d = normalizeDate(new Date(date));
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      filter.dateTime = { $gte: d, $lte: end };
    } else if (from || to) {
      filter.dateTime = {};
      if (from) filter.dateTime.$gte = new Date(from);
      if (to)   filter.dateTime.$lte = new Date(to);
    }

    const total = await RendezVous.countDocuments(filter);
    const rdvs  = await RendezVous.find(filter)
      .populate('patient', 'firstName lastName phone dossierNumber bloodGroup')
      .populate('medecin', 'firstName lastName specialite role')
      .sort({ dateTime: 1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.json({ rdvs, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET single RDV ────────────────────────────────────────────────────────────

export const getRdvById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdv = await RendezVous.findById(req.params.id)
      .populate('patient', 'firstName lastName phone dossierNumber bloodGroup')
      .populate('medecin', 'firstName lastName specialite');
    if (!rdv) { res.status(404).json({ message: 'RDV introuvable' }); return; }
    res.json({ rdv });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── POST — create RDV with smart validation ───────────────────────────────────

export const createRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = rdvCreateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const { patient, medecin, dateTime, motif, notes, status, duration } = result.data;
    const dt = new Date(dateTime);

    // Find default service if none provided
    let serviceId = result.data.service;
    if (!serviceId) {
      const Service = require('../models/Service').default;
      const defaultService = await Service.findOne({});
      serviceId = defaultService?._id || 'default';
    }

    // Anti-doublon : same patient + same doctor + same day
    const sameDay = normalizeDate(dt);
    const sameDayEnd = new Date(sameDay);
    sameDayEnd.setHours(23, 59, 59, 999);

    const existing = await RendezVous.findOne({
      patient,
      medecin,
      dateTime: { $gte: sameDay, $lte: sameDayEnd },
      status: { $nin: ['ANNULE', 'ABSENT'] },
    });

    if (existing) {
      res.status(409).json({
        message: 'Ce patient a deja un rendez-vous avec ce medecin ce jour-la',
        existingRdv: existing,
      });
      return;
    }

    // Smart conflict check (guard schedule + doctor constraints + double-booking)
    const conflict = await checkConflict(medecin, dt);
    if (conflict.hasConflict) {
      res.status(409).json({
        message: conflict.reason,
        suggestedSlots: conflict.suggestedSlots || [],
      });
      return;
    }

    const rdv = await RendezVous.create({
      patient, medecin,
      service: serviceId,
      dateTime: dt,
      motif, notes, status,
      duration: duration || 30,
      createdBy: (req.user as any)?._id,
    });

    const populated = await RendezVous.findById(rdv._id)
      .populate('patient', 'firstName lastName phone dossierNumber')
      .populate('medecin', 'firstName lastName specialite');

    res.status(201).json({ rdv: populated, message: 'Rendez-vous cree' });
  } catch (error) {
    logger.error('createRdv error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── PUT — update RDV ──────────────────────────────────────────────────────────

export const updateRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dateTime, medecin, status, motif, notes } = req.body;

    const existing = await RendezVous.findById(req.params.id);
    if (!existing) { res.status(404).json({ message: 'RDV introuvable' }); return; }

    const newDateTime = dateTime ? new Date(dateTime) : new Date(existing.dateTime);
    const newDoctor   = medecin || String(existing.medecin);

    if (dateTime || medecin) {
      const conflict = await checkConflict(newDoctor, newDateTime, req.params.id);
      if (conflict.hasConflict) {
        res.status(409).json({ message: conflict.reason });
        return;
      }
    }

    const updated = await RendezVous.findByIdAndUpdate(
      req.params.id,
      { $set: { dateTime: newDateTime, medecin: newDoctor, status, motif, notes } },
      { new: true }
    )
      .populate('patient', 'firstName lastName phone')
      .populate('medecin', 'firstName lastName specialite');

    res.json({ rdv: updated, message: 'Rendez-vous mis a jour' });
  } catch (error) {
    logger.error('updateRdv error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── PATCH — cancel RDV + notify freed slot ────────────────────────────────────

export const cancelRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdv = await RendezVous.findById(req.params.id);
    if (!rdv) { res.status(404).json({ message: 'RDV introuvable' }); return; }

    if (rdv.status === 'ANNULE') {
      res.status(400).json({ message: 'Ce RDV est deja annule' });
      return;
    }

    // Get freed slot info BEFORE cancelling
    const freedSlot = await getFreedSlotInfo(req.params.id);

    await RendezVous.findByIdAndUpdate(req.params.id, {
      $set: {
        status:       'ANNULE',
        cancelReason: req.body.reason || 'Annule',
        cancelledAt:  new Date(),
        cancelledBy:  (req.user as any)?._id,
      },
    });

    res.json({
      message: 'Rendez-vous annule',
      freedSlot: freedSlot ? {
        ...freedSlot,
        message: `Creneau libere : ${freedSlot.from}–${freedSlot.to} avec ${freedSlot.doctorName} le ${freedSlot.date}`,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── DELETE RDV ────────────────────────────────────────────────────────────────

export const deleteRdv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdv = await RendezVous.findByIdAndDelete(req.params.id);
    if (!rdv) { res.status(404).json({ message: 'RDV introuvable' }); return; }
    res.json({ message: 'Rendez-vous supprime' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET cancelled slots (freed by cancellations) ──────────────────────────────

export const getCancelledSlots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as any;
    const filter: any = { status: 'ANNULE' };

    if (from || to) {
      filter.dateTime = {};
      if (from) filter.dateTime.$gte = new Date(from);
      if (to)   filter.dateTime.$lte = new Date(to);
    }

    const cancelled = await RendezVous.find(filter)
      .populate('patient', 'firstName lastName phone')
      .populate('medecin', 'firstName lastName specialite')
      .sort({ cancelledAt: -1 })
      .limit(20);

    const slots = await Promise.all(cancelled.map(async rdv => {
      const dt    = new Date(rdv.dateTime);
      const date  = normalizeDate(dt);
      const sched = await OnCallSchedule.findOne({ date });
      const entry = sched?.entries.find((e: any) => String(e.doctorId) === String(rdv.medecin));
      const dur   = (entry as any)?.slotDurationMinutes || 30;

      const endDt = new Date(dt);
      endDt.setMinutes(endDt.getMinutes() + dur);

      const pad  = (n: number) => String(n).padStart(2, '0');
      const from = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      const to   = `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`;

      return {
        rdvId:           rdv._id,
        date:            date.toLocaleDateString('fr-FR'),
        from,
        to,
        medecin:         rdv.medecin,
        patient:         rdv.patient,
        motif:           rdv.motif,
        cancelledAt:     (rdv as any).cancelledAt,
        isSlotAvailable: true,
      };
    }));

    res.json({ cancelledSlots: slots });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET reschedule suggestions for an RDV ─────────────────────────────────────

export const getRescheduleSuggestions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rdv = await RendezVous.findById(req.params.id);
    if (!rdv) { res.status(404).json({ message: 'RDV introuvable' }); return; }

    const { suggestions } = await findAffectedAppointments(
      new Date(rdv.dateTime),
      { doctorId: String(rdv.medecin), startTime: '00:00', endTime: '23:59' },
      null,
    );

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
