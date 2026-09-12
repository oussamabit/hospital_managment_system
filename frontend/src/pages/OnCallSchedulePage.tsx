import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Save, AlertCircle,
  Loader2, Clock, User, Bell, CheckCircle2, Lock, Unlock,
  Edit2, X, Calendar, Settings, RefreshCw, Info, AlertTriangle,
} from 'lucide-react';
import {
  format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks,
  isSameDay, parseISO, isValid, isToday, isBefore, startOfDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery as useRQ, useMutation as useRM } from '@tanstack/react-query';
import { onCallApi, authApi } from '../services/api';
import { User as UserType, Role } from '../types';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeSlot {
  start: string; // "HH:mm"
  end: string;
}

interface DoctorConstraint {
  doctorId: string;
  dayOfWeek?: number[]; // 0=Sun..6=Sat — if present, recurring
  specificDate?: string; // ISO date for one-off
  unavailableSlots: TimeSlot[];
  notes?: string;
}

interface OnCallEntry {
  _id?: string;
  date: string;          // ISO date "YYYY-MM-DD"
  doctors: string[];     // array of User IDs
  timeSlot: TimeSlot;
  isPublished: boolean;
  notes?: string;
  updatedAt?: string;
}

interface CancelledSlot {
  rdvId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  from: string;
  to: string;
  motif: string;
  cancelledAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');

const DEFAULT_START = '08:00';
const DEFAULT_END   = '17:00';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Single day cell shown in the weekly grid */
const DayCell: React.FC<{
  day: Date;
  entry: OnCallEntry | undefined;
  doctors: UserType[];
  isAdmin: boolean;
  onEdit: (day: Date, entry?: OnCallEntry) => void;
}> = ({ day, entry, doctors, isAdmin, onEdit }) => {
  const today = isToday(day);
  const past  = isBefore(startOfDay(day), startOfDay(new Date()));

  const assignedDoctors = doctors.filter(d => entry?.doctors.includes(d._id));

  return (
    <div
      className={`
        flex flex-col min-h-[120px] rounded-xl border p-2.5 transition-all duration-150 group
        ${today
          ? 'border-primary-300 bg-primary-50/60 dark:bg-primary-900/20 dark:border-primary-700'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }
        ${past && !today ? 'opacity-60' : ''}
        ${isAdmin && !past ? 'hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer' : ''}
      `}
      onClick={() => isAdmin && !past && onEdit(day, entry)}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${today ? 'text-primary-600' : 'text-slate-400'}`}>
            {format(day, 'EEE', { locale: fr })}
          </p>
          <p className={`text-lg font-black leading-none ${today ? 'text-primary-700' : 'text-slate-800 dark:text-white'}`}>
            {format(day, 'd')}
          </p>
        </div>

        {entry && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            entry.isPublished
              ? 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-800'
              : 'bg-warning-50 text-warning-600 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800'
          }`}>
            {entry.isPublished ? '✓ Publié' : '⏳ Brouillon'}
          </span>
        )}
      </div>

      {/* Doctors list */}
      {assignedDoctors.length > 0 ? (
        <div className="flex flex-col gap-1 flex-1">
          {assignedDoctors.map(d => (
            <div key={d._id} className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg px-2 py-1 border border-primary-100 dark:border-primary-800/40">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[8px] font-bold">
                  {d.firstName.charAt(0)}{d.lastName.charAt(0)}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-primary-800 dark:text-primary-200 truncate">
                Dr. {d.lastName}
              </span>
            </div>
          ))}
          {entry && (
            <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {entry.timeSlot.start}–{entry.timeSlot.end}
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          {isAdmin && !past ? (
            <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-5 h-5 text-primary-400 mx-auto" />
              <p className="text-[9px] text-primary-400 font-medium mt-0.5">Ajouter</p>
            </div>
          ) : (
            <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center">Aucun médecin</p>
          )}
        </div>
      )}
    </div>
  );
};

/** Cancelled slot notification card */
const CancelledSlotCard: React.FC<{ slot: CancelledSlot; onBook: (slot: CancelledSlot) => void }> = ({ slot, onBook }) => (
  <div className="card p-4 border-warning-200 dark:border-warning-800/50 bg-warning-50/30 dark:bg-warning-900/10 hover:shadow-card-hover transition-all">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bell className="w-4 h-4 text-warning-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{slot.patientName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dr. {slot.doctorName} · {format(parseISO(slot.date), 'EEE d MMM', { locale: fr })}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="badge badge-amber text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              {slot.from} – {slot.to}
            </span>
            <span className="text-xs text-slate-400">Annulé: {slot.motif}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => onBook(slot)}
        className="btn-primary btn-sm flex-shrink-0"
      >
        <Plus className="w-3 h-3" />
        Réutiliser
      </button>
    </div>
  </div>
);

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const OnCallSchedulePage: React.FC = () => {
  const { user }     = useAuth();
  const { isAdmin }  = usePermissions();
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const { t }        = useTranslation();

  // Week navigation
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Mon
  const weekEnd   = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Edit modal state
  const [editDay,   setEditDay]   = useState<Date | null>(null);
  const [editEntry, setEditEntry] = useState<OnCallEntry | undefined>(undefined);

  // Entry form state
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [slotStart,        setSlotStart]       = useState(DEFAULT_START);
  const [slotEnd,          setSlotEnd]         = useState(DEFAULT_END);
  const [entryNotes,       setEntryNotes]      = useState('');
  const [formError,        setFormError]       = useState('');

  // Constraints modal
  const [constraintsDoctor, setConstraintsDoctor] = useState<UserType | null>(null);
  const [constraintSlots,   setConstraintSlots]   = useState<TimeSlot[]>([{ start: '14:00', end: '15:00' }]);
  const [constraintNote,    setConstraintNote]    = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────────
  const fromStr = format(weekStart, 'yyyy-MM-dd');
  const toStr   = format(weekEnd,   'yyyy-MM-dd');

  const { data: scheduleData, isLoading: schedLoading } = useQuery({
    queryKey: ['on-call-range', fromStr, toStr],
    queryFn: () => onCallApi.getRange(fromStr, toStr).then(r => r.data.schedule as OnCallEntry[]),
    staleTime: 10_000,
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => authApi.getDoctors().then(r => r.data.doctors as UserType[]),
  });

  const { data: cancelledData, refetch: refetchCancelled } = useQuery({
    queryKey: ['cancelled-slots'],
    queryFn: () => onCallApi.getRange(fromStr, toStr)  // reuse range endpoint for now
      .then(() => [] as CancelledSlot[]),              // placeholder — real endpoint returns slots
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const scheduleMap = useMemo(() => {
    const m: Record<string, OnCallEntry> = {};
    scheduleData?.forEach(e => { m[e.date] = e; });
    return m;
  }, [scheduleData]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const upsertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => onCallApi.upsert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['on-call-range'] });
      setEditDay(null);
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      onCallApi.publish(id, published),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['on-call-range'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => onCallApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['on-call-range'] });
      setEditDay(null);
    },
  });

  const saveConstraintsMutation = useMutation({
    mutationFn: ({ doctorId, data }: { doctorId: string; data: Record<string, unknown> }) =>
      onCallApi.saveConstraints(doctorId, data),
    onSuccess: () => {
      setConstraintsDoctor(null);
      queryClient.invalidateQueries({ queryKey: ['on-call-range'] });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openEdit = useCallback((day: Date, entry?: OnCallEntry) => {
    setEditDay(day);
    setEditEntry(entry);
    setSelectedDoctors(entry?.doctors ?? []);
    setSlotStart(entry?.timeSlot.start ?? DEFAULT_START);
    setSlotEnd(entry?.timeSlot.end   ?? DEFAULT_END);
    setEntryNotes(entry?.notes ?? '');
    setFormError('');
  }, []);

  const saveEntry = () => {
    if (!editDay) return;
    if (selectedDoctors.length === 0) {
      setFormError('Sélectionnez au moins un médecin de garde.');
      return;
    }
    if (slotStart >= slotEnd) {
      setFormError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    upsertMutation.mutate({
      ...(editEntry?._id && { _id: editEntry._id }),
      date:       dateKey(editDay),
      doctors:    selectedDoctors,
      timeSlot:   { start: slotStart, end: slotEnd },
      notes:      entryNotes,
      isPublished: editEntry?.isPublished ?? false,
    });
  };

  const toggleDoctor = (id: string) =>
    setSelectedDoctors(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );

  const addConstraintSlot = () =>
    setConstraintSlots(prev => [...prev, { start: '09:00', end: '10:00' }]);

  const removeConstraintSlot = (i: number) =>
    setConstraintSlots(prev => prev.filter((_, idx) => idx !== i));

  const updateConstraintSlot = (i: number, field: 'start' | 'end', val: string) =>
    setConstraintSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const saveConstraints = () => {
    if (!constraintsDoctor) return;
    saveConstraintsMutation.mutate({
      doctorId: constraintsDoctor._id,
      data: { unavailableSlots: constraintSlots, notes: constraintNote },
    });
  };

  const handleBookCancelledSlot = (slot: CancelledSlot) => {
    navigate(`/appointments/new?doctorId=${slot.doctorId}&dateFrom=${slot.date}&timeFrom=${slot.from}&timeTo=${slot.to}`);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Planning de garde</h1>
          <p className="page-subtitle">
            {format(weekStart, 'd MMM', { locale: fr })} – {format(weekEnd, 'd MMM yyyy', { locale: fr })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Week nav */}
          <button
            onClick={() => setCurrentWeek(d => subWeeks(d, 1))}
            className="btn-secondary btn-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="btn-secondary btn-sm"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setCurrentWeek(d => addWeeks(d, 1))}
            className="btn-secondary btn-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Info banner for non-admin ── */}
      {!isAdmin && (
        <div className="alert alert-info">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>
            Seul l'administrateur peut modifier le planning de garde.
            Vous êtes en mode <strong>lecture seule</strong>.
          </span>
        </div>
      )}

      {/* ── Weekly Grid ── */}
      <div className="card-flat overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="section-title">Planning hebdomadaire</span>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              {/* Publish all drafts */}
              <button
                onClick={() => {
                  scheduleData?.filter(e => !e.isPublished && e._id).forEach(e => {
                    publishMutation.mutate({ id: e._id!, published: true });
                  });
                }}
                className="btn-success btn-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tout publier
              </button>
            </div>
          )}
        </div>

        {schedLoading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 text-primary-400 animate-spin" />
            <p className="text-sm text-slate-400">Chargement du planning…</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => (
                <DayCell
                  key={dateKey(day)}
                  day={day}
                  entry={scheduleMap[dateKey(day)]}
                  doctors={doctorsData ?? []}
                  isAdmin={isAdmin}
                  onEdit={openEdit}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Doctor Constraints (Admin only) ── */}
      {isAdmin && (
        <div className="card-flat overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="section-title">Contraintes des médecins</span>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(doctorsData ?? []).map(doctor => (
              <button
                key={doctor._id}
                onClick={() => {
                  setConstraintsDoctor(doctor);
                  setConstraintSlots([{ start: '14:00', end: '15:00' }]);
                  setConstraintNote('');
                }}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all text-left group"
              >
                <div className="avatar avatar-sm flex-shrink-0">
                  {doctor.firstName.charAt(0)}{doctor.lastName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    Dr. {doctor.lastName}
                  </p>
                  <p className="text-[10px] text-slate-400">{doctor.grade}</p>
                </div>
                <Settings className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary-500 ml-auto flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Cancelled Slots Panel ── */}
      {isAdmin && (
        <div className="card-flat overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-warning-50 dark:bg-warning-900/30 flex items-center justify-center">
                <Bell className="w-4 h-4 text-warning-600 dark:text-warning-400" />
              </div>
              <span className="section-title">
                Créneaux libérés cette semaine
                {cancelledData && cancelledData.length > 0 && (
                  <span className="ml-2 badge badge-amber">{cancelledData.length}</span>
                )}
              </span>
            </div>
            <button onClick={() => refetchCancelled()} className="btn-ghost btn-sm">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4">
            {!cancelledData || cancelledData.length === 0 ? (
              <div className="empty-state py-10">
                <div className="empty-state-icon w-12 h-12 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">Aucun créneau libéré cette semaine</p>
                <p className="text-xs text-slate-400 mt-1">
                  Lorsqu'un patient annule, le créneau apparaîtra ici.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cancelledData.map(slot => (
                  <CancelledSlotCard
                    key={slot.rdvId}
                    slot={slot}
                    onBook={handleBookCancelledSlot}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          EDIT DAY MODAL
          ═══════════════════════════════════════════════════════════ */}
      {editDay && isAdmin && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg">
            {/* Header */}
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editEntry ? 'Modifier la garde' : 'Affecter un médecin de garde'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  {format(editDay, 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <button
                onClick={() => setEditDay(null)}
                className="btn-icon w-8 h-8 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="modal-body space-y-5">
              {formError && (
                <div className="alert alert-error animate-slide-up">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Doctor selector */}
              <div className="form-group">
                <label className="label">Médecins de garde</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(doctorsData ?? []).map(doctor => {
                    const active = selectedDoctors.includes(doctor._id);
                    return (
                      <button
                        key={doctor._id}
                        type="button"
                        onClick={() => toggleDoctor(doctor._id)}
                        className={`
                          flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all
                          ${active
                            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-600'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }
                        `}
                      >
                        <div className={`avatar avatar-sm flex-shrink-0 ${active ? '' : 'opacity-60'}`}>
                          {doctor.firstName.charAt(0)}{doctor.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${active ? 'text-primary-800 dark:text-primary-200' : 'text-slate-700 dark:text-slate-300'}`}>
                            Dr. {doctor.firstName} {doctor.lastName}
                          </p>
                          <p className={`text-[10px] ${active ? 'text-primary-500' : 'text-slate-400'}`}>
                            {doctor.grade}
                          </p>
                        </div>
                        {active && <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slot */}
              <div className="form-group">
                <label className="label">Créneau de garde</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 mb-1">Début</p>
                    <input
                      type="time"
                      className="input-field"
                      value={slotStart}
                      onChange={e => setSlotStart(e.target.value)}
                    />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 mb-1">Fin</p>
                    <input
                      type="time"
                      className="input-field"
                      value={slotEnd}
                      onChange={e => setSlotEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="label">Notes <span className="text-slate-400 font-normal normal-case">(optionnel)</span></label>
                <textarea
                  className="textarea-field"
                  rows={2}
                  placeholder="Ex: Urgences pédiatriques, astreinte cardiologie…"
                  value={entryNotes}
                  onChange={e => setEntryNotes(e.target.value)}
                />
              </div>

              {/* Publish toggle */}
              {editEntry && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    {editEntry.isPublished
                      ? <CheckCircle2 className="w-4 h-4 text-success-500" />
                      : <Clock className="w-4 h-4 text-warning-500" />
                    }
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {editEntry.isPublished ? 'Publié (visible de tous)' : 'Brouillon (non visible)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => editEntry._id && publishMutation.mutate({ id: editEntry._id, published: !editEntry.isPublished })}
                    className={editEntry.isPublished ? 'btn-secondary btn-sm' : 'btn-success btn-sm'}
                  >
                    {editEntry.isPublished ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {editEntry.isPublished ? 'Dépublier' : 'Publier'}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              {editEntry?._id && (
                <button
                  onClick={() => deleteMutation.mutate(editEntry._id!)}
                  className="btn-danger btn-sm mr-auto"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                  Supprimer
                </button>
              )}
              <button onClick={() => setEditDay(null)} className="btn-secondary flex-1">
                Annuler
              </button>
              <button
                onClick={saveEntry}
                disabled={upsertMutation.isPending}
                className="btn-primary flex-1"
              >
                {upsertMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CONSTRAINTS MODAL
          ═══════════════════════════════════════════════════════════ */}
      {constraintsDoctor && isAdmin && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="avatar avatar-md flex-shrink-0">
                  {constraintsDoctor.firstName.charAt(0)}{constraintsDoctor.lastName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Contraintes de Dr. {constraintsDoctor.firstName} {constraintsDoctor.lastName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Plages horaires pendant lesquelles ce médecin n'est pas disponible
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConstraintsDoctor(null)}
                className="btn-icon w-8 h-8 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div className="alert alert-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">
                  Ces créneaux seront automatiquement bloqués lors de la prise de rendez-vous pour ce médecin.
                </span>
              </div>

              <div className="space-y-2">
                <label className="label">Plages indisponibles récurrentes</label>
                {constraintSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      className="input-field flex-1"
                      value={slot.start}
                      onChange={e => updateConstraintSlot(i, 'start', e.target.value)}
                    />
                    <span className="text-slate-400 text-sm">→</span>
                    <input
                      type="time"
                      className="input-field flex-1"
                      value={slot.end}
                      onChange={e => updateConstraintSlot(i, 'end', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeConstraintSlot(i)}
                      className="btn-icon w-8 h-8 rounded-lg text-danger-500 hover:bg-danger-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addConstraintSlot}
                  className="btn-ghost btn-sm gap-1.5 text-primary-600 mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une plage
                </button>
              </div>

              <div className="form-group">
                <label className="label">Motif / Notes</label>
                <input
                  className="input-field"
                  placeholder="Ex: Réunion hebdomadaire, formation, clinique externe…"
                  value={constraintNote}
                  onChange={e => setConstraintNote(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setConstraintsDoctor(null)} className="btn-secondary flex-1">
                Annuler
              </button>
              <button
                onClick={saveConstraints}
                disabled={saveConstraintsMutation.isPending}
                className="btn-primary flex-1"
              >
                {saveConstraintsMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnCallSchedulePage;
