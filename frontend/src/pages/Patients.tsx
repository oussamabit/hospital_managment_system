import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, User, Users,
  Loader2, ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import { patientApi } from '../services/api';
import { Patient } from '../types';
import { differenceInYears } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';

const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canDeletePatient } = usePermissions();
  const { t } = useTranslation();
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search, page],
    queryFn: () =>
      patientApi.getAll({ ...(search && { search }), page, limit: 20 }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setDeleteId(null);
    },
  });

  const patients: Patient[] = data?.patients || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('patients.title', 'Patients')}</h1>
          <p className="page-subtitle">
            {pagination
              ? `${pagination.total} patient${pagination.total > 1 ? 's' : ''} enregistré${pagination.total > 1 ? 's' : ''}`
              : 'Gestion des dossiers patients'
            }
          </p>
        </div>
        <button
          onClick={() => navigate('/patients/new')}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {t('patients.add_patient', 'Nouveau patient')}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('patients.search_placeholder', 'Rechercher un patient…')}
            className="input-field pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="card-flat overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <span className="section-title">
              {t('patients.title', 'Patients')}
              {pagination && (
                <span className="ml-2 badge badge-slate font-mono text-[10px]">
                  {pagination.total}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-sm text-slate-400">Chargement…</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <User className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {t('patients.no_patient_found', 'Aucun patient trouvé')}
            </p>
            {search && (
              <p className="text-xs text-slate-400 mt-1">
                Essayez un autre terme de recherche
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('patients.dossier_number', 'N° Dossier')}</th>
                    <th>{t('common.patient', 'Patient')}</th>
                    <th>{t('patients.age', 'Âge')}</th>
                    <th>{t('patients.phone', 'Téléphone')}</th>
                    <th>{t('patients.gender', 'Sexe')}</th>
                    <th>{t('patients.blood_group', 'Groupe')}</th>
                    <th>{t('common.created_by', 'Créé par')}</th>
                    <th className="text-right">{t('common.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => {
                    const age = differenceInYears(new Date(), new Date(patient.birthDate));
                    const initials = `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`;
                    const creator = typeof patient.createdBy !== 'string' ? patient.createdBy : null;

                    return (
                      <tr
                        key={patient._id}
                        className="group cursor-pointer"
                        onClick={() => navigate(`/patients/${patient._id}`)}
                      >
                        {/* Dossier number */}
                        <td>
                          <span className="data-pill">{patient.dossierNumber}</span>
                        </td>

                        {/* Name + email */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar avatar-sm">{initials}</div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {patient.firstName} {patient.lastName}
                              </p>
                              {patient.email && (
                                <p className="text-xs text-slate-400">{patient.email}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Age */}
                        <td>
                          <span className="text-sm font-medium">{age} {t('patients.years', 'ans')}</span>
                        </td>

                        {/* Phone */}
                        <td>
                          <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                            {patient.phone}
                          </span>
                        </td>

                        {/* Gender */}
                        <td>
                          <span className={`badge ${patient.gender === 'M' ? 'badge-blue' : 'badge-purple'}`}>
                            {patient.gender === 'M'
                              ? t('patients.male', 'M')
                              : t('patients.female', 'F')
                            }
                          </span>
                        </td>

                        {/* Blood group */}
                        <td>
                          {patient.bloodGroup
                            ? <span className="badge badge-red font-mono">{patient.bloodGroup}</span>
                            : <span className="text-slate-300 dark:text-slate-600">—</span>
                          }
                        </td>

                        {/* Creator */}
                        <td>
                          {creator ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <User className="w-3 h-3" />
                              {creator.firstName} {creator.lastName}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => navigate(`/patients/${patient._id}`)}
                              className="btn-icon w-8 h-8 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                              title={t('common.edit', 'Modifier')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {canDeletePatient() && (
                              <button
                                onClick={() => setDeleteId(patient._id)}
                                className="btn-icon w-8 h-8 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/30"
                                title={t('common.delete', 'Supprimer')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Page <span className="font-semibold">{pagination.page}</span> sur{' '}
                  <span className="font-semibold">{pagination.pages}</span> —{' '}
                  <span className="font-semibold">{pagination.total}</span> patients
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary btn-sm gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {t('patients.prev', 'Précédent')}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="btn-secondary btn-sm gap-1"
                  >
                    {t('patients.next', 'Suivant')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box max-w-sm">
            <div className="modal-header">
              <div className="w-11 h-11 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-danger-600" />
              </div>
              <button
                onClick={() => setDeleteId(null)}
                className="btn-icon w-8 h-8 rounded-lg"
              >
                <span className="sr-only">Fermer</span>
                ✕
              </button>
            </div>
            <div className="modal-body text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {t('patients.delete_title', 'Supprimer ce patient ?')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('patients.delete_msg', 'Cette action est irréversible. Toutes les données associées seront supprimées.')}
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="btn-danger flex-1"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.delete', 'Supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
