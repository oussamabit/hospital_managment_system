import { Response } from 'express';
import { z } from 'zod';
import { OnCallSchedule, DoctorAvailability } from '../models/OnCallSchedule';
import RendezVous from '../models/RendezVous';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  findAffectedAppointments,
  normalizeDate,
  getDoctorAvailability,
} from '../services/appointmentService';
import logger from '../config/logger';

// ── Validation ────────────────────────────────────────────────────────────────

const entrySchema = z.object({
  doctorId:            z.string().min(1),
  doctorName:          z.string().optional(),
  startTime:           z.string().regex(/^\d{2}:\d{2}$/),
  endTime:             z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().min(5).max(120).default(30),
  maxAppointments:     z.number().int().optional(),
});

const scheduleSchema = z.object({
  date:        z.string(),
  entries:     z.array(entrySchema).min(1),
  notes:       z.string().optional(),
  isPublished: z.boolean().default(false),
});

const constraintSchema = z.object({
  label:        z.string().min(1),
  dayOfWeek:    z.number().int().min(0).max(6).optional(),
  specificDate: z.string().optional(),
  startTime:    z.string().regex(/^\d{2}:\d{2}$/),
  endTime:      z.string().regex(/^\d{2}:\d{2}$/),
  recurring:    z.boolean(),
});

// ── GET planning by date ──────────────────────────────────────────────────────

export const getScheduleByDate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const date = normalizeDate(new Date(req.params.date));
    const schedule = await OnCallSchedule.findOne({ date })
      .populate('entries.doctorId', 'firstName lastName specialite');
    res.json({ schedule: schedule || null });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET planning range (for calendar) ────────────────────────────────────────

export const getScheduleRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as { from: string; to: string };
    const schedules = await OnCallSchedule.find({
      date: {
        $gte: normalizeDate(new Date(from)),
        $lte: normalizeDate(new Date(to)),
      },
    }).sort({ date: 1 });
    res.json({ schedules });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET available slots for a doctor on a date ────────────────────────────────

export const getAvailableSlots = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, date } = req.params;

    const schedule = await OnCallSchedule.findOne({
      date: normalizeDate(new Date(date)),
      isPublished: true,
    });

    if (!schedule) {
      res.status(404).json({ message: 'Aucun planning publie pour cette date' });
      return;
    }

    const entry = schedule.entries.find((e: any) => e.doctorId === doctorId);
    if (!entry) {
      res.status(404).json({ message: 'Medecin non trouve dans le planning de ce jour' });
      return;
    }

    const avail = await getDoctorAvailability(doctorId, entry.doctorName || '', new Date(date));
    res.json({ availability: avail });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── GET doctors on call for a date ───────────────────────────────────────────

export const getDoctorsOnCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const date = normalizeDate(new Date(req.params.date));
    const schedule = await OnCallSchedule.findOne({ date, isPublished: true });

    if (!schedule) {
      res.json({ doctors: [], message: 'Aucun planning publie pour cette date' });
      return;
    }

    res.json({ doctors: schedule.entries, scheduleId: schedule._id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── POST / PUT — upsert schedule (Admin only) ─────────────────────────────────

export const upsertSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if ((req.user as any)?.role !== 'admin') {
      res.status(403).json({ message: "Seul l'administrateur peut gerer le planning de garde" });
      return;
    }

    const result = scheduleSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const { date, entries, notes, isPublished } = result.data;
    const normalDate = normalizeDate(new Date(date));

    // Calculate maxAppointments per entry
    const processedEntries = entries.map(e => {
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      const totalMin = (eh * 60 + em) - (sh * 60 + sm);
      return {
        ...e,
        maxAppointments: e.maxAppointments ?? Math.floor(totalMin / e.slotDurationMinutes),
      };
    });

    // Detect changes to existing schedule
    const oldSchedule = await OnCallSchedule.findOne({ date: normalDate });

    const schedule = await OnCallSchedule.findOneAndUpdate(
      { date: normalDate },
      {
        $set: {
          entries:     processedEntries,
          notes,
          isPublished,
          updatedBy:   (req.user as any)._id,
        },
        $setOnInsert: { createdBy: (req.user as any)._id },
      },
      { upsert: true, new: true }
    );

    // Detect affected appointments
    let affectedInfo = null;
    if (oldSchedule) {
      for (const oldEntry of oldSchedule.entries as any[]) {
        const newEntry = processedEntries.find(e => e.doctorId === oldEntry.doctorId);
        if (!newEntry || oldEntry.startTime !== newEntry.startTime || oldEntry.endTime !== newEntry.endTime) {
          const { affected, suggestions } = await findAffectedAppointments(
            normalDate, oldEntry, newEntry || null,
          );
          if (affected.length > 0) {
            affectedInfo = { affected, suggestions };
          }
        }
      }
    }

    res.json({
      schedule,
      message: 'Planning de garde enregistre',
      affectedAppointments: affectedInfo,
    });

  } catch (error: any) {
    logger.error('upsertSchedule error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── PATCH — publish / unpublish ───────────────────────────────────────────────

export const publishSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if ((req.user as any)?.role !== 'admin') {
      res.status(403).json({ message: "Action reservee a l'administrateur" });
      return;
    }

    const schedule = await OnCallSchedule.findByIdAndUpdate(
      req.params.id,
      { $set: { isPublished: req.body.isPublished, updatedBy: (req.user as any)._id } },
      { new: true }
    );

    if (!schedule) { res.status(404).json({ message: 'Planning introuvable' }); return; }

    res.json({
      schedule,
      message: schedule.isPublished ? 'Planning publie' : 'Planning depublie',
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── DELETE schedule ───────────────────────────────────────────────────────────

export const deleteSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if ((req.user as any)?.role !== 'admin') {
      res.status(403).json({ message: "Action reservee a l'administrateur" });
      return;
    }

    const schedule = await OnCallSchedule.findById(req.params.id);
    if (!schedule) { res.status(404).json({ message: 'Planning introuvable' }); return; }

    const dayStart = new Date(schedule.date);
    const dayEnd   = new Date(schedule.date);
    dayEnd.setHours(23, 59, 59, 999);

    const rdvCount = await RendezVous.countDocuments({
      dateTime: { $gte: dayStart, $lte: dayEnd },
      status:   { $in: ['CONFIRME', 'PLANIFIE', 'EN_COURS'] },
    });

    if (rdvCount > 0) {
      res.status(409).json({
        message: `Impossible de supprimer : ${rdvCount} rendez-vous confirme(s) ce jour.`,
        rdvCount,
      });
      return;
    }

    await OnCallSchedule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Planning supprime' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ── Doctor constraints ────────────────────────────────────────────────────────

export const getDoctorConstraints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const avail = await DoctorAvailability.findOne({ doctorId: req.params.doctorId });
    res.json({
      availability: avail || {
        doctorId: req.params.doctorId,
        constraints: [],
        defaultSlotDuration: 30,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const upsertDoctorConstraints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if ((req.user as any)?.role !== 'admin') {
      res.status(403).json({ message: "Action reservee a l'administrateur" });
      return;
    }

    const { doctorId } = req.params;
    const { constraints, defaultSlotDuration } = req.body;

    const result = z.array(constraintSchema).safeParse(constraints);
    if (!result.success) {
      res.status(400).json({ message: result.error.errors[0].message });
      return;
    }

    const avail = await DoctorAvailability.findOneAndUpdate(
      { doctorId },
      { $set: { constraints: result.data, defaultSlotDuration: defaultSlotDuration || 30 } },
      { upsert: true, new: true }
    );

    res.json({ availability: avail, message: 'Contraintes enregistrees' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
