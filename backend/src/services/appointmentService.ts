/**
 * appointmentService.ts
 * Logique metier intelligente pour le systeme de rendez-vous
 */

import RendezVous from '../models/RendezVous';
import { OnCallSchedule, DoctorAvailability } from '../models/OnCallSchedule';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  start: string;
  end: string;
  startDate: Date;
  endDate: Date;
  doctorId: string;
  doctorName: string;
  available: boolean;
  conflictReason?: string;
}

export interface AvailabilityResult {
  date: string;
  doctorId: string;
  doctorName: string;
  totalSlots: number;
  availableSlots: TimeSlot[];
  bookedSlots: TimeSlot[];
}

export interface ConflictCheck {
  hasConflict: boolean;
  reason?: string;
}

export interface RescheduleOption {
  doctorId: string;
  doctorName: string;
  date: string;
  slot: TimeSlot;
  sameDoctor: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (m: number): string => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

export const normalizeDate = (d: Date): Date => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};

const buildDateTime = (date: Date, time: string): Date => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
};

// ── Core ──────────────────────────────────────────────────────────────────────

export const generateSlots = async (
  doctorId: string,
  date: Date,
  startTime: string,
  endTime: string,
  slotDuration: number,
): Promise<TimeSlot[]> => {
  const slots: TimeSlot[] = [];
  const avail = await DoctorAvailability.findOne({ doctorId });
  const constraints = avail?.constraints || [];
  const dayOfWeek = date.getDay();
  const startMin  = timeToMinutes(startTime);
  const endMin    = timeToMinutes(endTime);

  const activeConstraints = constraints.filter((c: any) => {
    if (c.recurring && c.dayOfWeek !== undefined) return c.dayOfWeek === dayOfWeek;
    if (!c.recurring && c.specificDate) {
      return normalizeDate(new Date(c.specificDate)).getTime() === normalizeDate(date).getTime();
    }
    return false;
  });

  for (let cur = startMin; cur + slotDuration <= endMin; cur += slotDuration) {
    const slotStart = minutesToTime(cur);
    const slotEnd   = minutesToTime(cur + slotDuration);
    let blocked = false;
    let conflictReason = '';

    for (const c of activeConstraints as any[]) {
      const cStart = timeToMinutes(c.startTime);
      const cEnd   = timeToMinutes(c.endTime);
      if (cur < cEnd && cur + slotDuration > cStart) {
        blocked = true;
        conflictReason = `Indisponible : ${c.label} (${c.startTime}-${c.endTime})`;
        break;
      }
    }

    slots.push({
      start:     slotStart,
      end:       slotEnd,
      startDate: buildDateTime(date, slotStart),
      endDate:   buildDateTime(date, slotEnd),
      doctorId,
      doctorName: '',
      available:  !blocked,
      conflictReason: blocked ? conflictReason : undefined,
    });
  }
  return slots;
};

export const getDoctorAvailability = async (
  doctorId: string,
  doctorName: string,
  date: Date,
): Promise<AvailabilityResult | null> => {
  const normalDate = normalizeDate(date);
  const schedule   = await OnCallSchedule.findOne({ date: normalDate });
  if (!schedule) return null;

  const entry = (schedule.entries as any[]).find((e: any) => e.doctorId === doctorId);
  if (!entry) return null;

  const allSlots = await generateSlots(
    doctorId, normalDate,
    entry.startTime, entry.endTime,
    entry.slotDurationMinutes,
  );

  const dayStart = new Date(normalDate);
  const dayEnd   = new Date(normalDate);
  dayEnd.setHours(23, 59, 59, 999);

  const existingRdv = await RendezVous.find({
    medecin:  doctorId,
    dateTime: { $gte: dayStart, $lte: dayEnd },
    status:   { $in: ['confirmed', 'pending', 'CONFIRME', 'PLANIFIE', 'EN_COURS'] },
  });

  const bookedMins = existingRdv.map((r: any) => {
    const dt = new Date(r.dateTime);
    return dt.getHours() * 60 + dt.getMinutes();
  });

  const availableSlots: TimeSlot[] = [];
  const bookedSlots:    TimeSlot[] = [];

  for (const slot of allSlots) {
    if (!slot.available) continue;
    const slotMin  = timeToMinutes(slot.start);
    const isBooked = bookedMins.some((b: number) => b === slotMin);
    if (isBooked) {
      bookedSlots.push({ ...slot, doctorName, available: false });
    } else {
      availableSlots.push({ ...slot, doctorName });
    }
  }

  return {
    date:           normalDate.toISOString().split('T')[0],
    doctorId,
    doctorName,
    totalSlots:     allSlots.length,
    availableSlots,
    bookedSlots,
  };
};

export const checkConflict = async (
  doctorId: string,
  dateTime: Date,
  excludeRdvId?: string,
): Promise<ConflictCheck> => {
  const date    = normalizeDate(dateTime);
  const slotMin = dateTime.getHours() * 60 + dateTime.getMinutes();
  const timeStr = minutesToTime(slotMin);

  // 1. Planning de garde
  const schedule = await OnCallSchedule.findOne({ date });
  if (!schedule) {
    return { hasConflict: true, reason: `Aucun planning de garde pour le ${date.toLocaleDateString('fr-FR')}` };
  }

  const entry = (schedule.entries as any[]).find((e: any) => e.doctorId === doctorId);
  if (!entry) {
    return { hasConflict: true, reason: 'Ce medecin n\'est pas de garde a cette date' };
  }

  const guardStart = timeToMinutes(entry.startTime);
  const guardEnd   = timeToMinutes(entry.endTime);
  if (slotMin < guardStart || slotMin >= guardEnd) {
    return { hasConflict: true, reason: `Hors plage de garde du medecin (${entry.startTime}-${entry.endTime})` };
  }

  // 2. Contraintes medecin
  const avail      = await DoctorAvailability.findOne({ doctorId });
  const dayOfWeek  = dateTime.getDay();

  if (avail) {
    for (const c of avail.constraints as any[]) {
      const active =
        (c.recurring && c.dayOfWeek === dayOfWeek) ||
        (!c.recurring && c.specificDate &&
          normalizeDate(new Date(c.specificDate)).getTime() === date.getTime());

      if (active) {
        const cStart = timeToMinutes(c.startTime);
        const cEnd   = timeToMinutes(c.endTime);
        if (slotMin >= cStart && slotMin < cEnd) {
          return { hasConflict: true, reason: `Medecin indisponible : ${c.label} (${c.startTime}-${c.endTime})` };
        }
      }
    }
  }

  // 3. Doublon medecin
  const slotEnd = new Date(dateTime);
  slotEnd.setMinutes(slotEnd.getMinutes() + entry.slotDurationMinutes);

  const conflictQuery: any = {
    medecin:  doctorId,
    dateTime: { $gte: dateTime, $lt: slotEnd },
    status:   { $in: ['confirmed', 'pending', 'CONFIRME', 'PLANIFIE'] },
  };
  if (excludeRdvId) conflictQuery._id = { $ne: excludeRdvId };

  const existing = await RendezVous.findOne(conflictQuery);
  if (existing) {
    return { hasConflict: true, reason: `Le medecin a deja un rendez-vous a ${timeStr}` };
  }

  return { hasConflict: false };
};

export const getFreedSlotInfo = async (rdvId: string) => {
  const rdv = await RendezVous.findById(rdvId)
    .populate('medecin', 'firstName lastName')
    .populate('patient', 'firstName lastName');
  if (!rdv) return null;

  const dt      = new Date((rdv as any).dateTime);
  const doctor  = (rdv as any).medecin;
  const patient = (rdv as any).patient;
  const date    = normalizeDate(dt);
  const sched   = await OnCallSchedule.findOne({ date });
  const entry   = (sched?.entries as any[])?.find((e: any) => e.doctorId === String(doctor._id));
  const slotDur = entry?.slotDurationMinutes || 30;
  const endDt   = new Date(dt);
  endDt.setMinutes(endDt.getMinutes() + slotDur);

  return {
    doctorId:    String(doctor._id),
    doctorName:  `Dr. ${doctor.firstName} ${doctor.lastName}`,
    date:        date.toLocaleDateString('fr-FR'),
    from:        minutesToTime(dt.getHours() * 60 + dt.getMinutes()),
    to:          minutesToTime(endDt.getHours() * 60 + endDt.getMinutes()),
    patientName: `${patient.firstName} ${patient.lastName}`,
  };
};

export const findAffectedAppointments = async (
  date: Date,
  oldEntry: { doctorId: string; startTime: string; endTime: string } | null,
  newEntry: { doctorId: string; startTime: string; endTime: string } | null,
) => {
  const normalDate = normalizeDate(date);
  const dayStart   = new Date(normalDate);
  const dayEnd     = new Date(normalDate);
  dayEnd.setHours(23, 59, 59, 999);

  const query: any = {
    dateTime: { $gte: dayStart, $lte: dayEnd },
    status:   { $in: ['confirmed', 'pending', 'CONFIRME', 'PLANIFIE'] },
  };
  if (oldEntry) query.medecin = oldEntry.doctorId;

  const affected = await RendezVous.find(query)
    .populate('patient', 'firstName lastName phone')
    .populate('medecin', 'firstName lastName');

  const outOfRange = affected.filter((rdv: any) => {
    if (!newEntry) return true;
    const rdvMin   = new Date(rdv.dateTime).getHours() * 60 + new Date(rdv.dateTime).getMinutes();
    const newStart = timeToMinutes(newEntry.startTime);
    const newEnd   = timeToMinutes(newEntry.endTime);
    return rdvMin < newStart || rdvMin >= newEnd;
  });

  if (outOfRange.length === 0) return { affected: [], suggestions: [] };

  // Suggestions sur 7 jours
  const suggestions: RescheduleOption[] = [];
  const today = new Date();

  for (let i = 1; i <= 7 && suggestions.length < 10; i++) {
    const d  = new Date(today);
    d.setDate(today.getDate() + i);
    const nd = normalizeDate(d);

    const sched = await OnCallSchedule.findOne({ date: nd, isPublished: true });
    if (!sched) continue;

    for (const entry of sched.entries as any[]) {
      const avail = await getDoctorAvailability(entry.doctorId, entry.doctorName || '', nd);
      if (!avail) continue;
      for (const slot of avail.availableSlots.slice(0, 3)) {
        suggestions.push({
          doctorId:   entry.doctorId,
          doctorName: entry.doctorName || '',
          date:       nd.toISOString().split('T')[0],
          slot,
          sameDoctor: entry.doctorId === oldEntry?.doctorId,
        });
        if (suggestions.length >= 10) break;
      }
      if (suggestions.length >= 10) break;
    }
  }

  suggestions.sort((a, b) => (b.sameDoctor ? 1 : 0) - (a.sameDoctor ? 1 : 0));
  return { affected: outOfRange, suggestions };
};
