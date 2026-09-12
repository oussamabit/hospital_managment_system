import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, FileText, User, ChevronRight, X, Loader2,
  Calendar, Stethoscope, Edit2, Plus, Clock, RefreshCw,
} from 'lucide-react';
import { consultationApi } from '../services/api';
import { Consultation, Patient, User as UserType } from '../types';
import { format, parseISO } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';

const dateLocales: Record<string, any> = { fr, en: enUS, ar: arSA };

const ConsultationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isSecretaire, isDoctor, isAdmin } = usePermissions();
  const locale = dateLocales[i18n.language.substring(0, 2)] || fr;

  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [searchTerm,  setSearchTerm]  = useState('');

  const hasFilters = !!(dateFrom || dateTo || searchTerm);

  const { data, isLoading } = useQuery({
    queryKey: ['consultations', dateFrom, dateTo],
    queryFn: () =>
      consultationApi
        .getAll({ ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }), limit: 100 })
        .then((r) => r.data.consultations as Consultation[]),
    enabled: !isSecretaire,
  });

  const consultations = data || [];

  const filtered = consultations.filter((c) => {
    const patient = c.patient as Patient;
    if (!patient?._id) return false;
    const name = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  /* Access denied */
  if (isSecretaire) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger-50 dark:bg-danger-900/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-danger-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {t('common.access_denied', 'Accès refusé')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
          {t('consultations.doctors_only', 'Cette section est réservée aux médecins et administrateurs.')}
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-6">
          {t('common.back_to_dashboard', 'Retour au tableau de bord')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('consultations.title', 'Consultations')}</h1>
          <p className="page-subtitle">
            {filtered.length} consultation{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ' (filtré)' : ''}
          </p>
        </div>
        {(isDoctor || isAdmin) && (
          <button onClick={() => navigate('/consultations/new')} className="btn-primary">
            <Plus className="w-4 h-4" />
            {t('nav.new_consultation', 'Nouvelle consultation')}
          </button>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="card p-4 flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="input-field pl-10"
            placeholder={t('patients.search_placeholder', 'Rechercher un patient…')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            className="input-field w-36 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            className="input-field w-36 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); }}
            className="btn-ghost btn-sm gap-1.5 flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Consultations List ── */}
      <div className="card-flat overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="section-title">
              {t('consultations.title', 'Consultations')}
              <span className="ml-2 badge badge-slate font-mono text-[10px]">{filtered.length}</span>
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-sm text-slate-400">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Stethoscope className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {t('consultations.no_consultations_found', 'Aucune consultation trouvée')}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); }}
                className="btn-ghost btn-sm mt-3"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((c) => {
              const patient = c.patient as Patient;
              const medecin = c.medecin as UserType;
              const date    = parseISO(c.createdAt || new Date().toISOString());

              return (
                <div
                  key={c._id}
                  className="px-6 py-5 flex items-start gap-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  onClick={() => patient?._id && navigate(`/patients/${patient._id}?tab=consultations`)}
                >
                  {/* Date block */}
                  <div className="flex-shrink-0 text-center w-12">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {format(date, 'MMM', { locale })}
                    </p>
                    <p className="text-2xl font-black text-primary-600 dark:text-primary-400 leading-none">
                      {format(date, 'dd')}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{format(date, 'yyyy')}</p>
                  </div>

                  {/* Vertical divider */}
                  <div className="w-px self-stretch bg-slate-100 dark:bg-slate-800 flex-shrink-0" />

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {patient?.firstName} {patient?.lastName}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                          {patient?.dossierNumber && (
                            <span className="data-pill">{patient.dossierNumber}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Dr. {medecin?.firstName} {medecin?.lastName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(date, 'HH:mm')}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {(isDoctor || isAdmin) && (
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/consultations/${c._id}`); }}
                            className="btn-icon w-8 h-8 rounded-lg text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20"
                            title="Modifier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); patient?._id && navigate(`/patients/${patient._id}`); }}
                            className="btn-icon w-8 h-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                            title="Ordonnance"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Diagnostic + Conclusion cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-1">
                          Diagnostic
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium line-clamp-2">
                          {c.diagnosticPrincipal}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-1">
                          Conclusion
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 italic">
                          {c.conclusion}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultationsPage;
