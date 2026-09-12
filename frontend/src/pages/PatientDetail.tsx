import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { patientApi, rdvApi, consultationApi, ordonnanceApi } from '../services/api';
import {
  Patient, RendezVous, Consultation,
  RdvStatusLabels, RdvStatusColors,
  Ordonnance, CreateOrdonnanceDto, MedicalDocument,
} from '../types';
import PrescriptionModal from '../components/PrescriptionModal';
import HospitalizationList from '../components/HospitalizationList';
import PatientAIPanel from '../components/PatientAIPanel';
import {
  ClipboardList, Printer, Trash2, Loader2, Save, X, Edit2,
  ChevronLeft, Phone, Mail, MapPin, User, Calendar, Plus,
  FileText,
} from 'lucide-react';
import { format, differenceInYears, Locale } from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';

const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { canViewConsultations, isAdmin, isDoctor } = usePermissions();
  const [isEditing, setIsEditing] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [editingOrdonnance, setEditingOrdonnance] = useState<Ordonnance | null>(null);

  const locales: Record<string, Locale> = { fr, ar, en: enUS };
  const currentLocale = locales[i18n.language.substring(0, 2)] || enUS;

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: patientData, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientApi.getById(id!).then(r => r.data.patient as Patient),
    enabled: !!id,
  });

  const { data: rdvData } = useQuery({
    queryKey: ['patient-rdv', id],
    queryFn: () => rdvApi.getAll({ patient: id!, limit: 50 }).then(r => r.data.rdvs as RendezVous[]),
    enabled: !!id,
  });

  const { data: hospData } = useQuery({
    queryKey: ['hospitalizations', id],
    queryFn: async () => {
      const { hospitalizationApi } = await import('../services/api');
      const r = await hospitalizationApi.getByPatient(id!);
      return r.data.hospitalizations as any[];
    },
    enabled: !!id,
  });

  const { data: consultationData } = useQuery({
    queryKey: ['patient-consultations', id],
    queryFn: () => consultationApi.getByPatient(id!).then(r => r.data.consultations as Consultation[]),
    enabled: !!id && canViewConsultations(),
  });

  const { data: ordonnancesData } = useQuery({
    queryKey: ['patient-ordonnances', id],
    queryFn: () =>
      Promise.all(
        (consultationData || []).map(c =>
          ordonnanceApi.getByConsultation(c._id).then(r => r.data.ordonnances as Ordonnance[])
        )
      ).then(r => r.flat()),
    enabled: !!id && !!consultationData && consultationData.length > 0,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => patientApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      setIsEditing(false);
    },
  });

  const createOrdonnanceMutation = useMutation({
    mutationFn: (data: CreateOrdonnanceDto) => ordonnanceApi.create(data),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['patient-ordonnances', id] });
      setIsPrescriptionModalOpen(false);
      navigate(`/ordonnance/${res.data.ordonnance._id}/print`);
    },
  });

  const deleteOrdonnanceMutation = useMutation({
    mutationFn: (ordId: string) => ordonnanceApi.delete(ordId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient-ordonnances', id] }),
  });

  const updateOrdonnanceMutation = useMutation({
    mutationFn: ({ ordId, data }: { ordId: string; data: any }) => ordonnanceApi.update(ordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-ordonnances', id] });
      setEditingOrdonnance(null);
      setIsPrescriptionModalOpen(false);
    },
  });

  const deleteConsultationMutation = useMutation({
    mutationFn: (cId: string) => consultationApi.delete(cId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient-consultations', id] }),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<Patient>({ values: patientData });

  // ── Guards ────────────────────────────────────────────────────────────────
  if (patientLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }
  if (!patientData) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">{t('patients.no_patient_found')}</p>
        <button onClick={() => navigate('/patients')} className="btn-primary mt-4">
          {t('common.back_to_patients')}
        </button>
      </div>
    );
  }

  const p = patientData;
  const age = differenceInYears(new Date(), new Date(p.birthDate));

  const onSubmit = (data: Patient) => {
    updateMutation.mutate({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      birthDate: data.birthDate,
    });
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Retour */}
      <button onClick={() => navigate('/patients')} className="btn-ghost px-0 text-gray-500">
        <ChevronLeft className="w-4 h-4" /> {t('common.back_to_patients')}
      </button>

      {/* ── Banner patient ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-teal-500 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-bold">
              {p.firstName.charAt(0)}{p.lastName.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {p.firstName} {p.lastName}
                </h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-sm text-gray-500">{age} {t('patients.years')}</span>
                  <span className="text-gray-300">•</span>
                  <span className={`badge ${p.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                    {p.gender === 'M' ? t('patients.male') : t('patients.female')}
                  </span>
                  {p.bloodGroup && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="badge bg-red-100 text-red-700">
                        {t('patients.blood_group')} {p.bloodGroup}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg font-semibold">
                  {p.dossierNumber}
                </span>
                {!isEditing && (isDoctor || isAdmin) && (
                  <button onClick={() => setIsEditing(true)} className="btn-secondary text-sm py-2">
                    <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {p.phone}</span>
              {p.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {p.email}</span>}
              {p.address && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {p.address}</span>}
              {p.createdBy && typeof p.createdBy !== 'string' && (
                <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md text-xs font-medium border border-gray-100 dark:border-slate-600">
                  <User className="w-3 h-3 text-gray-400" />
                  {t('common.created_by', { defaultValue: 'Créé par' })}: <b>{p.createdBy.firstName} {p.createdBy.lastName}</b>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Formulaire d'édition patient ───────────────────────────────── */}
      {isEditing && (
        <div className="card border-2 border-primary-100 dark:border-primary-900/40">
          <h3 className="section-title mb-4">{t('profile.edit_profile')}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('common.first_name') || 'Prénom'}</label>
              <input className="input-field" {...register('firstName', { required: true })} />
            </div>
            <div>
              <label className="label">{t('common.last_name') || 'Nom'}</label>
              <input className="input-field" {...register('lastName', { required: true })} />
            </div>
            <div>
              <label className="label">{t('common.phone') || 'Téléphone'}</label>
              <input className="input-field" {...register('phone', { required: true })} />
            </div>
            <div>
              <label className="label">{t('common.email') || 'Email'}</label>
              <input type="email" className="input-field" {...register('email')} />
            </div>
            <div>
              <label className="label">{t('common.birth_date') || 'Date de naissance'}</label>
              <input
                type="date"
                className={`input-field ${errors.birthDate ? 'border-red-500' : ''}`}
                max={new Date().toISOString().split('T')[0]}
                {...register('birthDate', {
                  validate: v => {
                    if (!v) return true;
                    if (new Date(v) > new Date()) return t('patients.invalid_birth_date', { defaultValue: 'Date invalide' });
                    return true;
                  },
                })}
              />
              {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate.message}</p>}
            </div>
            <div>
              <label className="label">{t('common.address') || 'Adresse'}</label>
              <input className="input-field" {...register('address')} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                <X className="w-4 h-4" /> {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SECTION 1 : Infos + RDV (sidebar) + Consultations (main) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left sidebar : infos détaillées + RDV */}
        <div className="lg:col-span-1 space-y-6">

          {/* Infos détaillées */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-500" />
              {t('patients.info_title', { defaultValue: 'Informations Générales' })}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <Calendar className="w-4 h-4 text-primary-500" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{t('common.birth_date')}</p>
                  <p className="text-sm font-medium">
                    {p.birthDate ? format(new Date(p.birthDate), 'dd MMMM yyyy', { locale: currentLocale }) : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <MapPin className="w-4 h-4 text-teal-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{t('common.address')}</p>
                  <p className="text-sm font-medium truncate">{p.address || '-'}</p>
                </div>
              </div>

              {p.bloodGroup && (
                <div className="flex items-center gap-3 p-3 bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                    <span className="text-red-500 font-bold text-xs">{p.bloodGroup}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">{t('patients.blood_group')}</p>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">{p.bloodGroup}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rendez-vous */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-500" /> {t('nav.appointments')}
            </h3>
            {!rdvData || rdvData.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-400">{t('appointments.no_rdv_found')}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {rdvData.map(rdv => (
                  <div
                    key={rdv._id}
                    onClick={() => navigate(`/appointments/${rdv._id}`)}
                    className="p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-primary-200 hover:shadow-md cursor-pointer transition-all flex items-center gap-3 group"
                  >
                    <div className="text-center min-w-[3.5rem] py-1 px-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                      <p className="text-xs font-bold text-primary-600">{format(new Date(rdv.dateTime), 'HH:mm')}</p>
                      <p className="text-[10px] text-gray-400">{format(new Date(rdv.dateTime), 'dd/MM')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-xs truncate group-hover:text-primary-600 transition-colors">{rdv.motif}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${RdvStatusColors[rdv.status]}`}>
                      {RdvStatusLabels[rdv.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column : Consultations médicales */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card bg-medical-card dark:bg-slate-800 p-6 min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary-500" /> {t('consultations.title')}
                </h3>
                <p className="text-xs text-gray-500">
                  {t('consultations.history_subtitle', { defaultValue: 'Historique des consultations et examens médicaux' })}
                </p>
              </div>
              {(isDoctor || isAdmin) && (
                <button
                  onClick={() => navigate(`/consultations/new?patientId=${p._id}`)}
                  className="btn-primary py-2 px-4 shadow-lg hover:shadow-xl active:scale-95 transition-all text-sm"
                >
                  <Plus className="w-5 h-5" /> {t('consultations.new_title')}
                </button>
              )}
            </div>

            {!consultationData || consultationData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                  <FileText className="w-8 h-8 text-gray-200" />
                </div>
                <p className="text-gray-400 font-medium">
                  {t('consultations.no_consultations', { defaultValue: 'Aucune consultation pour le moment' })}
                </p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-slate-700">
                {consultationData.map(c => {
                  const consultationOrdonnances = (ordonnancesData || []).filter(o => o.consultation === c._id);
                  return (
                    <div key={c._id} className="relative pl-12 group">
                      <div className="absolute left-4.5 top-2 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 bg-primary-500 z-10 shadow-sm group-hover:scale-125 transition-transform" />
                      <div className="card overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow ring-1 ring-gray-100 dark:ring-slate-700/50">
                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50/80 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-700/50">
                          <p className="text-xs font-bold text-gray-500 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-primary-500" />
                            {format(new Date(c.createdAt), 'dd MMMM yyyy HH:mm', { locale: currentLocale })}
                          </p>
                          <div className="flex items-center gap-1">
                            {(isDoctor || isAdmin) && (
                              <>
                                <button
                                  onClick={() => navigate(`/consultations/${c._id}`)}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(t('common.confirm_delete', { defaultValue: 'Supprimer cette consultation ?' }))) {
                                      deleteConsultationMutation.mutate(c._id);
                                    }
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                  {deleteConsultationMutation.isPending && deleteConsultationMutation.variables === c._id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => { setSelectedConsultationId(c._id); setIsPrescriptionModalOpen(true); }}
                                  className="ml-2 py-1 px-3 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5"
                                >
                                  <Plus className="w-3 h-3" /> Prescription
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-1">Diagnostic</p>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.diagnosticPrincipal}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-teal-500 uppercase tracking-widest mb-1">Conclusion</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{c.conclusion}"</p>
                            </div>
                          </div>
                          {consultationOrdonnances.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t('ordonnance.title')}</p>
                              <div className="grid grid-cols-1 gap-2">
                                {consultationOrdonnances.map(ord => (
                                  <div key={ord._id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700/50 hover:border-primary-200 transition-all">
                                    <div className="flex items-center gap-3">
                                      <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                        <ClipboardList className="w-3.5 h-3.5 text-primary-500" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                                          {ord.medications.length} {t('ordonnance.medications_count', { count: ord.medications.length })}
                                        </p>
                                        <p className="text-[9px] text-gray-400">{format(new Date(ord.createdAt), 'HH:mm')}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => navigate(`/ordonnance/${ord._id}/print`)} className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors">
                                        <Printer className="w-3.5 h-3.5" />
                                      </button>
                                      {(isDoctor || isAdmin) && (
                                        <>
                                          <button
                                            onClick={() => { setEditingOrdonnance(ord); setSelectedConsultationId(c._id); setIsPrescriptionModalOpen(true); }}
                                            className="p-1.5 text-gray-400 hover:text-amber-500 transition-colors"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            disabled={deleteOrdonnanceMutation.isPending}
                                            onClick={() => { if (confirm(t('common.confirm_delete'))) deleteOrdonnanceMutation.mutate(ord._id); }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                          >
                                            {deleteOrdonnanceMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2 : Hospitalisations — pleine largeur EN BAS ──────────── */}
      {/* Les images médicales (RX, Echo, Scanner, IRM) sont dans l'onglet     */}
      {/* "Imagerie" du formulaire d'hospitalisation — pas de doublon ici.      */}
      <div className="card">
        <HospitalizationList
          patientId={p._id}
          patientData={{
            firstName: p.firstName,
            lastName: p.lastName,
            dossierNumber: p.dossierNumber,
            bloodGroup: p.bloodGroup,
            gender: p.gender,
            birthDate: p.birthDate,
            phone: p.phone,
            address: p.address,
          }}
          canEdit={isDoctor || isAdmin}
        />
      </div>


      {/* ── Assistant IA patient ── */}
      <PatientAIPanel
        patientId={p._id}
        patientName={`${p.firstName} ${p.lastName}`}
        hospitalizations={hospData || []}
      />

      
      {/* Modal ordonnance */}
      {isPrescriptionModalOpen && selectedConsultationId && p && (
        <PrescriptionModal
          isOpen={isPrescriptionModalOpen}
          onClose={() => { setIsPrescriptionModalOpen(false); setEditingOrdonnance(null); }}
          onSubmit={data => {
            if (editingOrdonnance) {
              updateOrdonnanceMutation.mutate({ ordId: editingOrdonnance._id, data });
            } else {
              createOrdonnanceMutation.mutate(data);
            }
          }}
          isSubmitting={createOrdonnanceMutation.isPending || updateOrdonnanceMutation.isPending}
          patientId={p._id}
          consultationId={selectedConsultationId}
          patientName={`${p.firstName} ${p.lastName}`}
          initialMedications={editingOrdonnance?.medications}
          initialNotes={editingOrdonnance?.notes}
          isEdit={!!editingOrdonnance}
        />
      )}
    </div>
  );
};

export default PatientDetailPage;
