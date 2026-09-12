import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Calendar, Clock, User, ChevronRight, X,
  Loader2, Filter, RefreshCw, AlertTriangle, Check,
  Bell, ChevronDown, ChevronUp, Stethoscope, Info,
} from 'lucide-react';
import { rdvApi, rdvSmartApi, onCallApi } from '../services/api';
import { RendezVous, RdvStatus, Patient, User as UserType } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import SmartRdvModal from '../components/SmartRdvModal';

const STATUS_OPTIONS = [
  { value: '',           label: 'Tous les statuts' },
  { value: 'PLANIFIE',   label: 'Planifie' },
  { value: 'CONFIRME',   label: 'Confirme' },
  { value: 'EN_COURS',   label: 'En cours' },
  { value: 'TERMINE',    label: 'Termine' },
  { value: 'ANNULE',     label: 'Annule' },
  { value: 'ABSENT',     label: 'Absent' },
];

const STATUS_BADGE: Record<string, string> = {
  PLANIFIE: 'badge badge-blue',
  CONFIRME: 'badge badge-cyan',
  EN_COURS: 'badge badge-amber',
  TERMINE:  'badge badge-green',
  ANNULE:   'badge badge-red',
  ABSENT:   'badge badge-slate',
};

const STATUS_DOT: Record<string, string> = {
  PLANIFIE: 'status-dot status-dot-blue',
  CONFIRME: 'status-dot status-dot-blue',
  EN_COURS: 'status-dot status-dot-amber',
  TERMINE:  'status-dot status-dot-green',
  ANNULE:   'status-dot status-dot-red',
  ABSENT:   'status-dot status-dot-slate',
};

const AppointmentsPage: React.FC = () => {
  const navigate      = useNavigate();
  const qc            = useQueryClient();
  const { t }         = useTranslation();
  const { isAdmin }   = usePermissions();

  const [statusFilter,    setStatusFilter]    = useState<RdvStatus | ''>('');
  const [dateFrom,        setDateFrom]        = useState('');
  const [dateTo,          setDateTo]          = useState('');
  const [cancelId,        setCancelId]        = useState<string | null>(null);
  const [cancelReason,    setCancelReason]    = useState('');
  const [freedSlot,       setFreedSlot]       = useState<any>(null);
  const [showSmartModal,  setShowSmartModal]  = useState(false);
  const [showCancelled,   setShowCancelled]   = useState(false);

  const hasFilters = !!(statusFilter || dateFrom || dateTo);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: rdvData, isLoading } = useQuery({
    queryKey: ['rdv', statusFilter, dateFrom, dateTo],
    queryFn: () =>
      rdvApi.getAll({
        ...(statusFilter && { status: statusFilter }),
        ...(dateFrom     && { dateFrom }),
        ...(dateTo       && { dateTo }),
        limit: 100,
      }).then(r => r.data.rdvs as RendezVous[]),
  });

  // Créneaux libérés (annulations récentes 7 jours)
  const { data: cancelledData } = useQuery({
    queryKey: ['cancelled-slots'],
    queryFn: () => {
      const from = new Date().toISOString().split('T')[0];
      const to   = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      return rdvSmartApi.getCancelledSlots({ from, to }).then(r => r.data.cancelledSlots);
    },
    refetchInterval: 60_000,   // toutes les minutes
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rdvSmartApi.cancel(id, reason),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['rdv'] });
      qc.invalidateQueries({ queryKey: ['cancelled-slots'] });
      const slot = res.data.freedSlot;
      if (slot) setFreedSlot(slot);
      setCancelId(null);
      setCancelReason('');
    },
  });

  const rdvs:          RendezVous[] = rdvData      || [];
  const cancelledSlots: any[]       = cancelledData || [];

  const clearFilters = () => { setStatusFilter(''); setDateFrom(''); setDateTo(''); };

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('appointments.title', 'Rendez-vous')}</h1>
          <p className="page-subtitle">
            {rdvs.length} resultat{rdvs.length !== 1 ? 's' : ''}
            {hasFilters ? ' (filtre)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bouton RDV Intelligent (avec guide creneaux disponibles) */}
          <button
            onClick={() => setShowSmartModal(true)}
            className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
            title="Creer un RDV en choisissant parmi les creneaux disponibles"
          >
            <Stethoscope className="w-4 h-4 text-teal-500" />
            RDV Intelligent
          </button>
          <button onClick={() => navigate('/appointments/new')} className="btn-primary">
            <Plus className="w-4 h-4" /> Nouveau RDV
          </button>
        </div>
      </div>

      {/* ── Alerte creneaux liberes ────────────────────────────────────────── */}
      {cancelledSlots.length > 0 && (
        <div className="card border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                {cancelledSlots.length} creneau{cancelledSlots.length > 1 ? 'x liberes' : ' libere'} suite aux annulations recentes
              </p>
            </div>
            <button onClick={() => setShowCancelled(v => !v)}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-700 transition flex items-center gap-1 text-xs font-semibold">
              {showCancelled ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
              {showCancelled ? 'Masquer' : 'Voir les creneaux'}
            </button>
          </div>

          {showCancelled && (
            <div className="mt-3 space-y-2">
              {cancelledSlots.map((s: any, i: number) => {
                const doc = s.medecin;
                const pat = s.patient;
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-amber-800/30">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        <span className="text-amber-600 font-bold">{s.from} – {s.to}</span>
                        {' '}avec Dr. {doc?.firstName} {doc?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.date} — Annulation de {pat?.firstName} {pat?.lastName} ({s.motif})
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSmartModal(true)}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 flex-shrink-0">
                      <Plus className="w-3 h-3" /> Prendre ce creneau
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Filtres ────────────────────────────────────────────────────────── */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">
          <Filter className="w-3.5 h-3.5" /> Filtres
        </div>
        <select className="select-field flex-1 sm:flex-none sm:w-44 text-sm"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value as RdvStatus | '')}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2 flex-1">
          <input type="date" className="input-field text-sm flex-1 sm:flex-none sm:w-40"
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-slate-400 text-xs">—</span>
          <input type="date" className="input-field text-sm flex-1 sm:flex-none sm:w-40"
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost btn-sm gap-1.5 flex-shrink-0">
            <RefreshCw className="w-3 h-3" /> Reinitialiser
          </button>
        )}
      </div>

      {/* ── Liste principale ───────────────────────────────────────────────── */}
      <div className="card-flat overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="section-title">
              {t('appointments.title', 'Rendez-vous')}
              <span className="ml-2 badge badge-slate font-mono text-[10px]">{rdvs.length}</span>
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-sm text-slate-400">Chargement...</p>
          </div>
        ) : rdvs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Calendar className="w-7 h-7 text-slate-400" /></div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Aucun rendez-vous trouve
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-ghost btn-sm mt-3">Effacer les filtres</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rdvs.map((rdv) => {
              const patient = rdv.patient as Patient;
              const medecin = rdv.medecin as UserType;
              const isActive = ['PLANIFIE', 'CONFIRME'].includes(rdv.status);
              const rdvDate  = new Date(rdv.dateTime);

              return (
                <div key={rdv._id}
                  className="px-6 py-4 flex items-center gap-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">

                  {/* Bloc date */}
                  <div className="flex-shrink-0 text-center w-16">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      {format(rdvDate, 'MMM', { locale: fr })}
                    </p>
                    <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                      {format(rdvDate, 'dd')}
                    </p>
                    <p className="text-sm font-bold text-primary-600 dark:text-primary-400 mt-0.5">
                      {format(rdvDate, 'HH:mm')}
                    </p>
                  </div>

                  <div className="w-px h-14 bg-slate-100 dark:bg-slate-800 flex-shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={STATUS_DOT[rdv.status]} />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {patient?.firstName} {patient?.lastName}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rdv.motif}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Dr. {medecin?.firstName} {medecin?.lastName}
                      </span>
                      {(rdv as any).duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(rdv as any).duration} min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge statut */}
                  <span className={STATUS_BADGE[rdv.status] || 'badge badge-slate'}>
                    {STATUS_OPTIONS.find(o => o.value === rdv.status)?.label || rdv.status}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {['CONFIRME','EN_COURS','PLANIFIE','TERMINE'].includes(rdv.status) && (
                      <button onClick={e => { e.stopPropagation(); navigate(`/consultations/new?rdvId=${rdv._id}`); }}
                        className="btn-success btn-sm">
                        + Consultation
                      </button>
                    )}
                    {isActive && (
                      <button onClick={e => { e.stopPropagation(); setCancelId(rdv._id); }}
                        className="btn-ghost btn-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20">
                        Annuler
                      </button>
                    )}
                    <button onClick={() => navigate(`/appointments/${rdv._id}`)} className="btn-secondary btn-sm">
                      Modifier
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal annulation ───────────────────────────────────────────────── */}
      {cancelId && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Annuler le rendez-vous</h3>
              <button onClick={() => { setCancelId(null); setCancelReason(''); }} className="btn-icon w-8 h-8 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Apres annulation, le creneau libere sera signale a la secretaire pour etre reutilise.
              </p>
              <div className="form-group">
                <label className="label">Motif d'annulation</label>
                <textarea className="textarea-field" rows={3}
                  placeholder="Ex: Patient absent, urgence medicale..."
                  value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setCancelId(null); setCancelReason(''); }} className="btn-secondary flex-1">
                Retour
              </button>
              <button onClick={() => cancelMutation.mutate({ id: cancelId, reason: cancelReason })}
                disabled={cancelMutation.isPending} className="btn-danger flex-1">
                {cancelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification creneau libere ─────────────────────────────────────── */}
      {freedSlot && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-teal-200 dark:border-teal-800 p-4 animate-slide-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-xl flex-shrink-0">
              <Check className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Creneau libere</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {freedSlot.from} – {freedSlot.to} avec {freedSlot.doctorName}
              </p>
              <p className="text-xs text-gray-400">{freedSlot.date}</p>
              <button onClick={() => { setFreedSlot(null); setShowSmartModal(true); }}
                className="btn-primary py-1.5 px-3 text-xs mt-2 w-full">
                Assigner un nouveau patient
              </button>
            </div>
            <button onClick={() => setFreedSlot(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal RDV Intelligent ──────────────────────────────────────────── */}
      {showSmartModal && (
        <SmartRdvModal onClose={() => setShowSmartModal(false)} />
      )}
    </div>
  );
};

export default AppointmentsPage;
