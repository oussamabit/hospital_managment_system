/**
 * SmartRdvModal.tsx
 *
 * Assistant de creation de rendez-vous intelligent :
 *   1. Choisir une date
 *   2. Voir les medecins de garde ce jour (depuis le planning publie)
 *   3. Voir les creneaux disponibles pour le medecin choisi
 *      (respect des contraintes + anti-doublon automatique)
 *   4. Choisir un patient
 *   5. Confirmer → POST /api/rdv-smart avec validation serveur
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  X, Loader2, Calendar, User, Clock, Check,
  ChevronRight, AlertTriangle, Search, Stethoscope,
} from 'lucide-react';
import { onCallApi, rdvSmartApi, patientApi } from '../services/api';
import { TimeSlot } from '../types/schedule';

interface Props {
  onClose: () => void;
  prefillDate?: string;
}

type Step = 'date' | 'doctor' | 'slot' | 'patient' | 'confirm';

const SmartRdvModal: React.FC<Props> = ({ onClose, prefillDate }) => {
  const qc = useQueryClient();

  const [step,         setStep]         = useState<Step>('date');
  const [selectedDate, setSelectedDate] = useState(prefillDate || new Date().toISOString().split('T')[0]);
  const [selectedDoc,  setSelectedDoc]  = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedPat,  setSelectedPat]  = useState<any>(null);
  const [motif,        setMotif]        = useState('');
  const [notes,        setNotes]        = useState('');
  const [patSearch,    setPatSearch]    = useState('');
  const [error,        setError]        = useState('');

  // ── Medecins de garde ─────────────────────────────────────────────────────

  const { data: doctorsOnCall, isLoading: docLoading } = useQuery({
    queryKey: ['doctors-on-call', selectedDate],
    queryFn:  () => onCallApi.getDoctorsOnCall(selectedDate).then(r => r.data.doctors),
    enabled:  !!selectedDate && step === 'doctor',
  });

  // ── Creneaux disponibles ──────────────────────────────────────────────────

  const { data: availData, isLoading: slotsLoading } = useQuery({
    queryKey: ['available-slots', selectedDoc?.doctorId, selectedDate],
    queryFn:  () =>
      onCallApi.getAvailableSlots(selectedDoc.doctorId, selectedDate).then(r => r.data.availability),
    enabled:  !!selectedDoc && step === 'slot',
  });

  // ── Patients ──────────────────────────────────────────────────────────────

  const { data: patientsData, isLoading: patLoading } = useQuery({
    queryKey: ['patients-search', patSearch],
    queryFn:  () => patientApi.getAll({ search: patSearch, limit: 20 }).then(r => r.data.patients),
    enabled:  step === 'patient',
  });

  // ── Mutation creation RDV ─────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => rdvSmartApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rdv'] });
      qc.invalidateQueries({ queryKey: ['cancelled-slots'] });
      setStep('confirm');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Erreur lors de la creation du rendez-vous');
    },
  });

  const handleCreate = () => {
    if (!selectedPat || !selectedDoc || !selectedSlot || !motif) return;
    setError('');
    createMutation.mutate({
      patient:  selectedPat._id,
      medecin:  selectedDoc.doctorId,
      dateTime: selectedSlot.startDate,
      motif,
      notes,
      status:   'pending',
    });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const doctors: any[]   = doctorsOnCall || [];
  const avail            = availData;
  const patients: any[]  = patientsData || [];
  const availableSlots: TimeSlot[] = avail?.availableSlots || [];
  const bookedSlots: TimeSlot[]    = avail?.bookedSlots    || [];

  const StepIndicator = () => {
    const steps: { id: Step; label: string }[] = [
      { id: 'date',    label: 'Date'    },
      { id: 'doctor',  label: 'Medecin' },
      { id: 'slot',    label: 'Creneau' },
      { id: 'patient', label: 'Patient' },
      { id: 'confirm', label: 'Confirme'},
    ];
    const idx = steps.findIndex(s => s.id === step);
    return (
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i < idx  ? 'bg-teal-500 border-teal-500 text-white'
                : i === idx ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-gray-200 dark:border-slate-600 text-gray-400'
              }`}>
                {i < idx ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${i === idx ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded transition-all ${i < idx ? 'bg-teal-400' : 'bg-gray-200 dark:bg-slate-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition';

  // ── STEPS CONTENT ─────────────────────────────────────────────────────────

  const renderDate = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Choisissez la date du rendez-vous. Seules les dates avec un planning publie ont des medecins disponibles.</p>
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Date</label>
        <input type="date" className={inputCls} value={selectedDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={e => setSelectedDate(e.target.value)} />
        <p className="text-xs text-gray-400 mt-1">
          {selectedDate && format(new Date(selectedDate + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </div>
      <button onClick={() => setStep('doctor')} disabled={!selectedDate}
        className="btn-primary w-full py-2.5 disabled:opacity-40">
        Voir les medecins de garde <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  const renderDoctor = () => (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Medecins de garde le <strong>{format(new Date(selectedDate + 'T12:00:00'), 'EEEE d MMM', { locale: fr })}</strong> :
      </p>
      {docLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>}
      {!docLoading && doctors.length === 0 && (
        <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-dashed border-amber-200">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-700">Aucun planning publie pour cette date</p>
          <p className="text-xs text-amber-500 mt-1">Contactez l'administrateur pour publier le planning de garde</p>
          <button onClick={() => setStep('date')} className="btn-secondary mt-3 text-sm py-1.5 px-4">Changer de date</button>
        </div>
      )}
      {doctors.map((doc: any) => (
        <button key={doc.doctorId} onClick={() => { setSelectedDoc(doc); setStep('slot'); }}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left hover:border-primary-400 hover:shadow-md ${
            selectedDoc?.doctorId === doc.doctorId ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-slate-700'
          }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{doc.doctorName || `Dr. ${doc.doctorId}`}</p>
              <p className="text-xs text-gray-400">{doc.startTime} – {doc.endTime} • {doc.slotDurationMinutes} min par creneau</p>
              <p className="text-xs text-teal-600 font-semibold">{doc.maxAppointments} creneaux max</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      ))}
    </div>
  );

  const renderSlots = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Creneaux de <strong>{selectedDoc?.doctorName}</strong> le {format(new Date(selectedDate + 'T12:00:00'), 'd MMM', { locale: fr })} :
      </p>
      {slotsLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>}

      {!slotsLoading && avail && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total',      val: avail.totalSlots,           color: 'bg-gray-100 dark:bg-slate-800' },
              { label: 'Disponibles',val: availableSlots.length,      color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700' },
              { label: 'Pris',       val: bookedSlots.length,         color: 'bg-red-100 dark:bg-red-900/30 text-red-600' },
            ].map(({ label, val, color }) => (
              <div key={label} className={`${color} rounded-xl p-2.5 text-center`}>
                <p className="text-lg font-black">{val}</p>
                <p className="text-[10px] font-bold text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Grille des creneaux */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
            {/* Disponibles */}
            {availableSlots.map((s, i) => (
              <button key={i} onClick={() => { setSelectedSlot(s); setStep('patient'); }}
                className={`py-2.5 rounded-xl text-sm font-bold text-center transition-all border-2 ${
                  selectedSlot?.start === s.start
                    ? 'bg-teal-500 border-teal-500 text-white shadow-md'
                    : 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 hover:bg-teal-500 hover:text-white hover:border-teal-500'
                }`}>
                {s.start}
              </button>
            ))}
            {/* Pris — grises */}
            {bookedSlots.map((s, i) => (
              <div key={i} className="py-2.5 rounded-xl text-sm font-bold text-center bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-800/30 text-red-300 dark:text-red-700 cursor-not-allowed"
                title="Creneau deja pris">
                {s.start}
              </div>
            ))}
          </div>

          {availableSlots.length === 0 && (
            <div className="text-center py-6 bg-gray-50 dark:bg-slate-800/30 rounded-xl">
              <p className="text-sm text-gray-400">Aucun creneau disponible pour ce medecin ce jour</p>
              <button onClick={() => setStep('doctor')} className="btn-secondary mt-3 text-sm py-1.5 px-4">Choisir un autre medecin</button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderPatient = () => (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Creneau selectionne : <strong className="text-teal-600">{selectedSlot?.start} – {selectedSlot?.end}</strong>
        {' '}avec {selectedDoc?.doctorName}
      </p>

      {/* Motif obligatoire */}
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Motif de consultation *</label>
        <input className={inputCls} placeholder="Ex: Consultation generale, suivi post-op..."
          value={motif} onChange={e => setMotif(e.target.value)} />
      </div>

      {/* Recherche patient */}
      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Patient *</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input className={inputCls + ' pl-9'} placeholder="Rechercher un patient..."
            value={patSearch} onChange={e => setPatSearch(e.target.value)} />
        </div>
      </div>

      {patLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary-400" /></div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {patients.map((p: any) => (
            <button key={p._id} onClick={() => setSelectedPat(p)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border-2 transition-all ${
                selectedPat?._id === p._id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                  : 'border-gray-100 dark:border-slate-700 hover:border-primary-300'
              }`}>
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-teal-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{p.firstName[0]}{p.lastName[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.firstName} {p.lastName}</p>
                <p className="text-[10px] text-gray-400">{p.phone} — {p.dossierNumber}</p>
              </div>
              {selectedPat?._id === p._id && <Check className="w-4 h-4 text-primary-500 ml-auto flex-shrink-0" />}
            </button>
          ))}
          {patients.length === 0 && patSearch && (
            <p className="text-center text-sm text-gray-400 py-4">Aucun patient trouve</p>
          )}
        </div>
      )}

      <div>
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Notes (optionnel)</label>
        <textarea rows={2} className={inputCls + ' resize-none'} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informations complementaires..." />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <button onClick={handleCreate}
        disabled={!selectedPat || !motif || createMutation.isPending}
        className="btn-primary w-full py-2.5 disabled:opacity-40">
        {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creation...</> : <>Confirmer le RDV <Check className="w-4 h-4" /></>}
      </button>
    </div>
  );

  const renderConfirm = () => (
    <div className="text-center space-y-4 py-4">
      <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-8 h-8 text-teal-600" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">RDV confirme</h3>
        <p className="text-sm text-gray-500 mt-1">
          {selectedPat?.firstName} {selectedPat?.lastName} — {selectedSlot?.start} avec {selectedDoc?.doctorName}
        </p>
        <p className="text-xs text-gray-400">
          {format(new Date(selectedDate + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </div>
      <button onClick={onClose} className="btn-primary w-full py-2.5">Fermer</button>
    </div>
  );

  const stepContent: Record<Step, React.ReactNode> = {
    date:    renderDate(),
    doctor:  renderDoctor(),
    slot:    renderSlots(),
    patient: renderPatient(),
    confirm: renderConfirm(),
  };

  const canGoBack = step !== 'date' && step !== 'confirm';
  const backStep: Record<Step, Step> = {
    date: 'date', doctor: 'date', slot: 'doctor', patient: 'slot', confirm: 'confirm',
  };

  // ── MODAL ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-600 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold">Nouveau RDV — Assistant intelligent</h2>
              <p className="text-xs opacity-70">Creneaux valides automatiquement selon le planning et les contraintes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <StepIndicator />
          {stepContent[step]}
        </div>

        {/* Footer navigation */}
        {canGoBack && (
          <div className="px-6 pb-5">
            <button onClick={() => setStep(backStep[step])} className="btn-ghost text-sm w-full py-2 text-gray-500">
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartRdvModal;
