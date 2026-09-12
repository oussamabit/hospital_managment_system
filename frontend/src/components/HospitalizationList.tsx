import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hospitalizationApi } from '../services/api';
import { Hospitalization, User } from '../types';
import {
  Plus, Loader2, Trash2, Edit2, ChevronDown, ChevronUp,
  Calendar, FileText, Image as ImageIcon, FlaskConical,
  Heart, Eye, Bed,
} from 'lucide-react';
import HospitalizationForm from './HospitalizationForm';
import HospitalizationDetail from './HospitalizationDetail';

interface Props {
  patientId: string;
  patientData: {
    firstName: string;
    lastName: string;
    dossierNumber: string;
    bloodGroup?: string;
    gender?: string;
    birthDate?: string;
    phone?: string;
    address?: string;
  };
  canEdit?: boolean;
}

const HospitalizationList: React.FC<Props> = ({ patientId, patientData, canEdit = false }) => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editHosp, setEditHosp] = useState<Hospitalization | null>(null);
  const [viewHosp, setViewHosp] = useState<Hospitalization | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // On charge toujours les données fraîches (pas de staleTime élevé ici)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hospitalizations', patientId],
    queryFn: () =>
      hospitalizationApi.getByPatient(patientId).then(r => r.data.hospitalizations as Hospitalization[]),
    enabled: !!patientId,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hospitalizationApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hospitalizations', patientId] }),
  });

  const hospitalizations = data || [];

  const getDoctorName = (hosp: Hospitalization) => {
    if (hosp.chirurgienTraitantNom) return hosp.chirurgienTraitantNom;
    if (hosp.chirurgienTraitantId && typeof hosp.chirurgienTraitantId === 'object') {
      const d = hosp.chirurgienTraitantId as User;
      return `Dr. ${d.firstName} ${d.lastName}`;
    }
    return '—';
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const countImagingFiles = (hosp: Hospitalization) => {
    const bm = hosp.bilanMorphologique;
    if (!bm) return 0;
    return (
      (bm.radiographie?.length || 0) +
      (bm.echographie?.length || 0) +
      (bm.scanner?.length || 0) +
      (bm.irm?.length || 0)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
      </div>
    );
  }

  // Quand le formulaire se ferme, on force un refetch
  const handleFormClose = () => {
    setShowForm(false);
    setEditHosp(null);
    refetch();
  };

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bed className="w-5 h-5 text-primary-500" />
            Hospitalisations
            {hospitalizations.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-primary-100 text-primary-700 rounded-full">
                {hospitalizations.length}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Dossiers médicaux d'hospitalisation — un dossier par séjour
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditHosp(null); setShowForm(true); }}
            className="btn-primary py-2 px-4 text-sm shadow-md"
          >
            <Plus className="w-4 h-4" /> Nouvelle hospitalisation
          </button>
        )}
      </div>

      {/* Empty state */}
      {hospitalizations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Bed className="w-8 h-8 text-gray-200" />
          </div>
          <p className="text-gray-400 font-medium text-sm">Aucune hospitalisation enregistrée</p>
          {canEdit && (
            <button
              onClick={() => { setEditHosp(null); setShowForm(true); }}
              className="mt-4 btn-primary py-2 px-5 text-sm"
            >
              <Plus className="w-4 h-4" /> Créer un dossier
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-100 dark:before:bg-slate-700/50">
        {hospitalizations.map((hosp, idx) => {
          const isExpanded = expandedId === hosp._id;
          const imgCount = countImagingFiles(hosp);
          const followupCount = hosp.dailyFollowups?.length || 0;

          return (
            <div key={hosp._id} className="relative pl-14 group">
              {/* Timeline dot */}
              <div className="absolute left-3.5 top-5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-primary-500 z-10 shadow-sm group-hover:scale-125 transition-transform" />
              {idx === 0 && (
                <span className="absolute left-0 top-4 text-[9px] font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded-md border border-primary-100 dark:border-primary-800">
                  Récent
                </span>
              )}

              <div className="card overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-800/50 border-b border-gray-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                      <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        Entrée : {formatDate(hosp.dateEntree)}
                        {hosp.dateSortie && (
                          <span className="text-gray-400 font-normal ml-2">→ Sortie : {formatDate(hosp.dateSortie)}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        Créé le {formatDate(hosp.createdAt)}
                        {hosp.dossierN && <span className="ml-2 font-mono text-teal-600">#{hosp.dossierN}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {imgCount > 0 && (
                      <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                        <ImageIcon className="w-2.5 h-2.5" /> {imgCount}
                      </span>
                    )}
                    {followupCount > 0 && (
                      <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold rounded-full">
                        <Calendar className="w-2.5 h-2.5" /> {followupCount}j
                      </span>
                    )}

                    <button
                      onClick={() => setViewHosp(hosp)}
                      className="p-1.5 text-gray-400 hover:text-primary-500 transition rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20"
                      title="Voir le dossier complet"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => { setEditHosp(hosp); setShowForm(true); }}
                          className="p-1.5 text-gray-400 hover:text-amber-500 transition rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Supprimer cette hospitalisation et toutes ses données ?')) {
                              deleteMutation.mutate(hosp._id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Supprimer"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === hosp._id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : hosp._id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 transition rounded-lg"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Summary (always visible) */}
                <div className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Chirurgien</p>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mt-0.5">{getDoctorName(hosp)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Motif admission</p>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-1">{hosp.motifAdmission || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Diagnostic</p>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-1">{hosp.diagnostic || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Lit / Salle</p>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-0.5">
                      {hosp.noLit ? `Lit ${hosp.noLit}` : '—'}
                      {hosp.noBilletSalle ? ` / Salle ${hosp.noBilletSalle}` : ''}
                    </p>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 px-5 py-4 space-y-4 bg-gray-50/50 dark:bg-slate-900/20">
                    <div className="flex flex-wrap gap-2">
                      {hosp.bilanBiologique?.fns && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-xl">
                          <FlaskConical className="w-3.5 h-3.5" /> Bilan biologique
                        </span>
                      )}
                      {imgCount > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-semibold rounded-xl">
                          <ImageIcon className="w-3.5 h-3.5" /> {imgCount} image(s)
                        </span>
                      )}
                      {followupCount > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-semibold rounded-xl">
                          <Calendar className="w-3.5 h-3.5" /> {followupCount} suivi(s)
                        </span>
                      )}
                      {hosp.examenClinique?.etatGeneral && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold rounded-xl">
                          <Heart className="w-3.5 h-3.5" /> Examen clinique
                        </span>
                      )}
                    </div>

                    {hosp.histoireMaladie && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Histoire de la maladie</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{hosp.histoireMaladie}</p>
                      </div>
                    )}

                    {hosp.bilanBiologique?.fns && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">FNS</p>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(hosp.bilanBiologique.fns)
                            .filter(([, v]) => v !== undefined)
                            .map(([k, v]) => (
                              <span key={k} className="text-xs text-blue-700 dark:text-blue-300">
                                <span className="font-bold uppercase">{k}</span>: {v}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setViewHosp(hosp)}
                      className="btn-secondary py-1.5 px-4 text-xs w-full sm:w-auto"
                    >
                      <Eye className="w-3.5 h-3.5" /> Voir le dossier complet
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {showForm && (
        <HospitalizationForm
          patientId={patientId}
          patientData={patientData}
          hospitalization={editHosp || undefined}
          onClose={handleFormClose}
        />
      )}

      {viewHosp && (
        <HospitalizationDetail
          hospitalization={viewHosp}
          patientData={patientData}
          onClose={() => setViewHosp(null)}
          onEdit={canEdit ? () => { setEditHosp(viewHosp); setViewHosp(null); setShowForm(true); } : undefined}
        />
      )}
    </>
  );
};

export default HospitalizationList;
