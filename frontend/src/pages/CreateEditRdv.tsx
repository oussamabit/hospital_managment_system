import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Save, Loader2, AlertCircle, Plus, X } from 'lucide-react';
import { rdvApi, patientApi, authApi, consultationApi, serviceApi } from '../services/api';
import { RendezVous, Patient, User, CreateRdvDto, CreateConsultationDto, Service, Consultation } from '../types';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { AxiosError } from 'axios';
import { CreatePatientModal } from '../components/CreatePatientModal';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

// ===== CREATE/EDIT RDV PAGE =====
export const CreateEditRdvPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isSenior, isSecretaire } = usePermissions();
  const [error, setError] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceChef, setNewServiceChef] = useState('');
  const { t } = useTranslation();
  const isEdit = !!id && id !== 'new';

  const { data: existingRdv, isLoading: rdvLoading } = useQuery({
    queryKey: ['rdv', id],
    queryFn: () => rdvApi.getById(id!).then((r) => r.data.rdv as RendezVous),
    enabled: isEdit,
  });

  const { data: patientsData } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => patientApi.getAll({ limit: 200 }).then((r) => r.data.patients as Patient[]),
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => authApi.getDoctors().then((r) => r.data.doctors as User[]),
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceApi.getAll().then((r) => r.data.services as Service[]),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateRdvDto) =>
      isEdit
        ? rdvApi.update(id!, data as unknown as Record<string, unknown>)
        : rdvApi.create(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rdv'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate('/appointments');
    },
    onError: (err: AxiosError<{ message: string }>) => {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    },
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CreateRdvDto>({
    defaultValues: {
      medecin: user?.role === 'MEDECIN' ? user._id : '',
      duration: 30,
    },
  });

  // Pre-populate form when editing existing RDV loads
  React.useEffect(() => {
    if (isEdit && existingRdv) {
      reset({
        patient: typeof existingRdv.patient === 'string' ? existingRdv.patient : (existingRdv.patient as Patient)._id,
        medecin: typeof existingRdv.medecin === 'string' ? existingRdv.medecin : (existingRdv.medecin as User)._id,
        service: typeof existingRdv.service === 'string' ? existingRdv.service : (existingRdv.service as Service)._id,
        dateTime: existingRdv.dateTime ? new Date(existingRdv.dateTime).toISOString().slice(0, 16) : '',
        duration: existingRdv.duration || 30,
        motif: existingRdv.motif,
        notes: existingRdv.notes,
        status: existingRdv.status,
      });
    }
  }, [existingRdv, isEdit, reset]);

  // Quick date helpers
  const setQuickDate = (option: 'now' | 'in_hour' | 'today' | 'tomorrow') => {
    const d = new Date();
    if (option === 'now') {
      // round to nearest 5 min
      d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    } else if (option === 'in_hour') {
      d.setHours(d.getHours() + 1, 0, 0, 0);
    } else if (option === 'today') {
      d.setHours(8, 0, 0, 0);
    } else if (option === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
    }
    // format to datetime-local string
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setValue('dateTime', formatted, { shouldValidate: true });
  };

  if (isEdit && rdvLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={() => navigate('/appointments')} className="btn-ghost px-0 text-gray-500">
        <ChevronLeft className="w-4 h-4" /> {t('common.back')}
      </button>

      <div className="card">
        <h2 className="section-title mb-6">
          {isEdit ? t('appointments.edit_rdv_title') : t('appointments.new_rdv_title')}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit((data) => {
            setError('');
            mutation.mutate(data);
          })}
          className="space-y-5"
        >
          {/* Patient */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="label mb-0">{t('common.patient')} *</label>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setShowPatientModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  + {t('dashboard.new_patient')}
                </button>
              )}
            </div>
            <select
              className={`input-field ${errors.patient ? 'input-error' : ''}`}
              {...register('patient', { required: t('appointments.select_patient') })}
            >
              <option value="">{t('appointments.select_patient')}</option>
              {patientsData?.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.firstName} {p.lastName} — {p.dossierNumber}
                </option>
              ))}
            </select>
            {errors.patient && <p className="text-red-500 text-xs mt-1">{errors.patient.message}</p>}
          </div>

          <div>
            <label className="label">{t('common.doctor')} *</label>
            <select
              className={`input-field ${errors.medecin ? 'input-error' : ''}`}
              {...register('medecin', { required: t('appointments.select_doctor') })}
            >
              <option value="">{t('appointments.select_doctor')}</option>
              {doctorsData?.map((d) => (
                <option key={d._id} value={d._id}>
                  Dr. {d.firstName} {d.lastName} — {d.grade === 'SENIOR' ? t('roles.senior') : t('roles.junior')}
                </option>
              ))}
            </select>
            {errors.medecin && <p className="text-red-500 text-xs mt-1">{errors.medecin.message}</p>}
          </div>

          {/* Service */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="label mb-0">{t('common.service')} *</label>
              {!isAddingService && (
                <button
                  type="button"
                  onClick={() => setIsAddingService(true)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> {t('common.add_new', { defaultValue: 'Nouveau service' })}
                </button>
              )}
            </div>

            {isAddingService ? (
              <div className="bg-primary-50 dark:bg-primary-900/10 p-3 rounded-xl border border-primary-100 dark:border-primary-900/20 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider">Nouveau Service</span>
                  <button type="button" onClick={() => setIsAddingService(false)} className="text-primary-400 hover:text-primary-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                <input
                  className="input-field py-1.5 text-sm"
                  placeholder="Nom du service (ex: Ophtalmologie)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                />
                <select
                  className="input-field py-1.5 text-sm"
                  value={newServiceChef}
                  onChange={(e) => setNewServiceChef(e.target.value)}
                >
                  <option value="">Chef de service (Senior)</option>
                  {doctorsData?.filter(d => d.grade === 'SENIOR').map(d => (
                    <option key={d._id} value={d._id}>Dr. {d.firstName} {d.lastName}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!newServiceName || !newServiceChef}
                  onClick={async () => {
                    try {
                      const res = await serviceApi.create({ nomService: newServiceName, chefDeServiceId: newServiceChef });
                      queryClient.invalidateQueries({ queryKey: ['services'] });
                      setValue('service', res.data.service._id);
                      setIsAddingService(false);
                      setNewServiceName('');
                    } catch (err: any) {
                      alert(err.response?.data?.message || 'Erreur lors de la création du service');
                    }
                  }}
                  className="btn-primary w-full py-1.5 text-xs"
                >
                  Ajouter le service
                </button>
              </div>
            ) : (
              <select
                className={`input-field ${errors.service ? 'input-error' : ''}`}
                {...register('service', { required: t('appointments.select_service') })}
              >
                <option value="">{t('appointments.select_service')}</option>
                {servicesData?.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.nomService}
                  </option>
                ))}
              </select>
            )}
            {errors.service && <p className="text-red-500 text-xs mt-1">{errors.service.message}</p>}
          </div>

          {/* Date Time + Duration */}
          <div>
            <label className="label">{t('appointments.date_time')} *</label>
            {/* Quick date buttons */}
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                { key: 'now', label: ' Maintenant' },
                { key: 'in_hour', label: ' Dans 1h' },
                { key: 'today', label: ' Aujourd\'hui' },
                { key: 'tomorrow', label: ' Demain' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setQuickDate(key as any)}
                  className="text-xs px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg transition-colors font-medium"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="datetime-local"
                  className={`input-field ${errors.dateTime ? 'input-error' : ''}`}
                  min={new Date().toISOString().slice(0, 16)}
                  {...register('dateTime', {
                    required: t('appointments.date_time'),
                    validate: (v) => {
                      if (!v) return true;
                      const date = new Date(v);
                      if (isNaN(date.getTime())) return t('common.invalid_date', { defaultValue: 'Date invalide' });
                      if (!isEdit && date < new Date()) {
                        return t('appointments.future_date_req', { defaultValue: 'Le rendez-vous doit être dans le futur' });
                      }
                      return true;
                    }
                  })}
                />
                {errors.dateTime && <p className="text-red-500 text-xs mt-1">{errors.dateTime.message}</p>}
              </div>
              <div>
                <label className="label text-xs">{t('common.duration')} ({t('common.minutes')})</label>
                <select className="input-field" {...register('duration', { valueAsNumber: true })}>
                  {[15, 20, 30, 45, 60, 90, 120].map((d) => (
                    <option key={d} value={d}>{d} {t('common.minutes')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Status (Only in Edit Mode) */}
          {isEdit && (
            <div>
              <label className="label">{t('common.status', { defaultValue: 'Statut' })}</label>
              <select className={`input-field ${errors.status ? 'input-error' : ''}`} {...register('status')}>
                <option value="PLANIFIE">{t('appointments.planifie', { defaultValue: 'Planifié' })}</option>
                <option value="CONFIRME">{t('appointments.confirme', { defaultValue: 'Confirmé' })}</option>
                <option value="EN_COURS">{t('appointments.en_cours', { defaultValue: 'En cours' })}</option>
                <option value="TERMINE">{t('appointments.termine', { defaultValue: 'Terminé' })}</option>
                <option value="ANNULE">{t('appointments.annule', { defaultValue: 'Annulé' })}</option>
              </select>
            </div>
          )}

          {/* Motif */}
          <div>
            <label className="label">{t('common.motif')} *</label>
            <input
              className={`input-field ${errors.motif ? 'input-error' : ''}`}
              placeholder={t('appointments.motif_placeholder')}
              {...register('motif', {
                required: 'Le motif est requis',
                minLength: { value: 3, message: 'Minimum 3 caractères' }
              })}
            />
            {errors.motif && <p className="text-red-500 text-xs mt-1">{errors.motif.message}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="label">{t('common.notes')} <span className="text-gray-400 text-xs">({t('common.optional', { defaultValue: 'optionnel' })})</span></label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder={t('appointments.notes_placeholder')}
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/appointments')} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? t('common.save') : t('dashboard.new_rdv')}
            </button>
          </div>
        </form>
      </div>

      {showPatientModal && (
        <CreatePatientModal
          onClose={() => setShowPatientModal(false)}
          onSuccess={(newPatientId) => {
            setShowPatientModal(false);
            setValue('patient', newPatientId, { shouldValidate: true });
          }}
        />
      )}
    </div>
  );
};

// ===== CREATE CONSULTATION PAGE =====
export const ConsultationCreatePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreateConsultations } = usePermissions();
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const patientId = queryParams.get('patientId');
  const rdvIdFromUrl = queryParams.get('rdvId'); // Pre-select rdv from appointments list
  const isEdit = !!id && id !== 'new';

  const { data: existingConsultation, isLoading: consultLoading } = useQuery({
    queryKey: ['consultation', id],
    queryFn: () => consultationApi.getById(id!).then((r) => r.data.consultation as Consultation),
    enabled: isEdit,
  });

  // Always fetch ALL rdvs so user can switch — filter by patientId only when given
  const { data: rdvsData, isLoading: rdvsLoading } = useQuery({
    queryKey: ['rdv-for-consultation'],
    queryFn: () =>
      rdvApi.getAll({ 
        limit: 200,
        status: 'EN_COURS,CONFIRME,PLANIFIE,TERMINE'
      }).then((r) => r.data.rdvs as RendezVous[]),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateConsultationDto) =>
      isEdit 
        ? consultationApi.update(id!, data as unknown as Record<string, unknown>)
        : consultationApi.create(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rdv'] });
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['patient-consultations'] });
      navigate('/appointments');
    },
    onError: (err: AxiosError<{ message: string }>) => {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde de la consultation');
    },
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CreateConsultationDto>({
    defaultValues: {
      // Pre-select the rdv from the URL immediately as default value
      rendezvous: rdvIdFromUrl || '',
    },
    values: existingConsultation ? {
      rendezvous: typeof existingConsultation.rendezvous === 'string' ? existingConsultation.rendezvous : (existingConsultation.rendezvous as any)._id,
      diagnosticPrincipal: existingConsultation.diagnosticPrincipal,
      examenClinique: existingConsultation.examenClinique,
      conclusion: existingConsultation.conclusion,
      traitementPrescrit: existingConsultation.traitementPrescrit,
      recommendations: existingConsultation.recommendations,
    } : undefined
  });

  // Ensure pre-selection once rdvsData arrives (for controlled select)
  React.useEffect(() => {
    if (rdvIdFromUrl && !isEdit && rdvsData) {
      setValue('rendezvous', rdvIdFromUrl);
    }
  }, [rdvIdFromUrl, isEdit, rdvsData, setValue]);

  if (!canCreateConsultations()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="card text-center max-w-sm">
          <p className="text-gray-500">{t('consultations.doctors_only')}</p>
        </div>
      </div>
    );
  }

  if (isEdit && consultLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={() => navigate('/appointments')} className="btn-ghost px-0 text-gray-500">
        <ChevronLeft className="w-4 h-4" /> {t('common.back')}
      </button>

      <div className="card">
        <h2 className="section-title mb-6">
          {isEdit ? t('common.edit', { defaultValue: 'Modifier la consultation' }) : t('consultations.new_title')}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit((data) => { setError(''); mutation.mutate(data); })}
          className="space-y-5"
        >
          {/* RDV selection */}
          <div>
            <label className="label">{t('common.rdv', { defaultValue: 'Appointment' })} *</label>
            <select
              className={`input-field ${errors.rendezvous ? 'input-error' : ''}`}
              {...register('rendezvous', { required: t('consultations.select_rdv') })}
              disabled={rdvsLoading}
            >
              <option value="">{t('consultations.select_rdv')}</option>
              {rdvsData?.map((rdv) => {
                const p = rdv.patient as Patient;
                return (
                  <option key={rdv._id} value={rdv._id}>
                    {p?.firstName} {p?.lastName} — {rdv.motif} ({format(new Date(rdv.dateTime), 'dd/MM HH:mm')})
                  </option>
                );
              })}
            </select>
            {rdvsData?.length === 0 && !rdvsLoading && (
              <p className="text-amber-600 text-xs mt-1 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                {patientId 
                  ? (
                    <span>
                      {t('consultations.no_rdv_for_patient', { defaultValue: "Aucun rendez-vous actif trouvé pour ce patient. Le patient doit avoir un rendez-vous 'En cours' ou 'Confirmé'." })}
                      {' '}<button type="button" onClick={() => navigate(`/appointments/new?patientId=${patientId}`)} className="underline font-bold hover:text-amber-800">{t('dashboard.new_rdv')}</button>
                    </span>
                  )
                  : (
                    <span>
                      {t('consultations.no_active_rdv', { defaultValue: "Aucun rendez-vous actif trouvé." })}
                      {' '}<button type="button" onClick={() => navigate('/appointments/new')} className="underline font-bold hover:text-amber-800">{t('dashboard.new_rdv')}</button>
                    </span>
                  )
                }
              </p>
            )}
            {errors.rendezvous && <p className="text-red-500 text-xs mt-1">{errors.rendezvous.message}</p>}
          </div>

          {/* Diagnostic */}
          <div>
            <label className="label">{t('consultations.diagnostic')} *</label>
            <input
              className={`input-field ${errors.diagnosticPrincipal ? 'input-error' : ''}`}
              placeholder={t('consultations.diagnostic')}
              {...register('diagnosticPrincipal', { required: t('consultations.diagnostic'), minLength: { value: 3, message: t('consultations.diagnostic') } })}
            />
            {errors.diagnosticPrincipal && <p className="text-red-500 text-xs mt-1">{errors.diagnosticPrincipal.message}</p>}
          </div>

          {/* Examen clinique */}
          <div>
            <label className="label">{t('consultations.clinical_exam')} *</label>
            <textarea
              className={`input-field resize-none ${errors.examenClinique ? 'input-error' : ''}`}
              rows={4}
              placeholder={t('consultations.exam_placeholder')}
              {...register('examenClinique', { required: t('consultations.clinical_exam') })}
            />
            {errors.examenClinique && <p className="text-red-500 text-xs mt-1">{errors.examenClinique.message}</p>}
          </div>

          {/* Conclusion */}
          <div>
            <label className="label">{t('consultations.conclusion')} *</label>
            <textarea
              className={`input-field resize-none ${errors.conclusion ? 'input-error' : ''}`}
              rows={3}
              placeholder={t('consultations.conclusion_placeholder')}
              {...register('conclusion', { required: t('consultations.conclusion') })}
            />
            {errors.conclusion && <p className="text-red-500 text-xs mt-1">{errors.conclusion.message}</p>}
          </div>

          {/* Traitement */}
          <div>
            <label className="label">{t('consultations.treatment')}</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder={t('consultations.treatment_placeholder')}
              {...register('traitementPrescrit')}
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="label">{t('consultations.recommendations')}</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder={t('consultations.rec_placeholder')}
              {...register('recommendations')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/appointments')} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('consultations.save_consult')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
