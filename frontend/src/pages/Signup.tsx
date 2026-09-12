import React, { useState } from 'react';
import {
  Stethoscope, Loader2, ArrowLeft, CheckCircle2,
  User, Mail, Lock, Phone, Briefcase, Hash,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import axios, { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { CreatableOptionBox } from '../components/CreatableOptionBox';
import { Role, Grade } from '../types';

interface SignupForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  grade?: Grade;
  specialite?: string;
  numeroOrdre?: string;
  service?: string;
  codePoste?: string;
  matricule?: string;
}

const ROLES = [
  { value: Role.MEDECIN,    label: 'Médecin',    desc: 'Consultation & prescriptions', color: 'border-primary-300 bg-primary-50 text-primary-700' },
  { value: Role.SECRETAIRE, label: 'Secrétaire', desc: 'Gestion des RDV',               color: 'border-amber-300 bg-amber-50 text-amber-700' },
  { value: Role.INFIRMIER,  label: 'Infirmier',  desc: 'Soins aux patients',            color: 'border-cyan-300 bg-cyan-50 text-cyan-700' },
];

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [apiError,     setApiError]     = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess,    setIsSuccess]    = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({ defaultValues: { role: Role.MEDECIN, grade: Grade.JUNIOR } });

  const selectedRole = watch('role');

  const onSubmit = async (data: SignupForm) => {
    setApiError('');
    setIsSubmitting(true);
    try {
      await axios.post('/api/auth/signup', data);
      setIsSuccess(true);
      setTimeout(() => navigate('/login'), 5000);
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      setApiError(error.response?.data?.message || t('common.error_occurred', 'Une erreur est survenue'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Success state ── */
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-medical-bg dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-modal border border-slate-200/70 dark:border-slate-800 p-10 max-w-md w-full text-center animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-success-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
            {t('signup.success_title', 'Demande envoyée !')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
            {t('signup.success_message', 'Votre demande de compte a été soumise. Un administrateur examinera votre profil et vous donnera accès dès validation.')}
          </p>
          <Link to="/login" className="btn-primary w-full justify-center">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-medical-bg dark:bg-slate-950 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-modal border border-slate-200/70 dark:border-slate-800 overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-primary-600 to-cyan-600 px-8 py-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-lg leading-tight">MediCare Pro</p>
              <p className="text-white/60 text-xs tracking-widest uppercase">Demande d'accès</p>
            </div>
          </div>
          <Link to="/login" className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>

        {/* ── Form ── */}
        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {t('signup.title', 'Créer votre compte')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t('signup.subtitle', 'Remplissez vos informations professionnelles pour demander un accès.')}
            </p>
          </div>

          {apiError && (
            <div className="alert alert-error mb-5 animate-slide-up">
              <span className="font-bold">!</span>
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">
                  <User className="w-3 h-3 inline mr-1" />
                  {t('common.first_name', 'Prénom')}
                </label>
                <input
                  className={`input-field ${errors.firstName ? 'input-error' : ''}`}
                  placeholder="Mohamed"
                  {...register('firstName', { required: 'Requis' })}
                />
                {errors.firstName && <p className="text-xs text-danger-500 mt-1">{errors.firstName.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">{t('common.last_name', 'Nom')}</label>
                <input
                  className={`input-field ${errors.lastName ? 'input-error' : ''}`}
                  placeholder="Brahimi"
                  {...register('lastName', { required: 'Requis' })}
                />
                {errors.lastName && <p className="text-xs text-danger-500 mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="label">
                <Mail className="w-3 h-3 inline mr-1" />
                {t('common.email', 'Adresse e-mail')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  placeholder="m.brahimi@hospital.dz"
                  className={`input-field pl-10 ${errors.email ? 'input-error' : ''}`}
                  {...register('email', {
                    required: 'Requis',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail invalide' },
                  })}
                />
              </div>
              {errors.email && <p className="text-xs text-danger-500 mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="label">
                <Lock className="w-3 h-3 inline mr-1" />
                {t('common.password', 'Mot de passe')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="password"
                  placeholder="Minimum 8 caractères"
                  className={`input-field pl-10 ${errors.password ? 'input-error' : ''}`}
                  {...register('password', {
                    required: 'Requis',
                    minLength: { value: 8, message: 'Minimum 8 caractères' },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
                      message: 'Doit contenir majuscule, minuscule et chiffre',
                    },
                  })}
                />
              </div>
              {errors.password
                ? <p className="text-xs text-danger-500 mt-1">{errors.password.message}</p>
                : <p className="text-xs text-slate-400 mt-1">Ex: Password123!</p>
              }
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="label">
                <Phone className="w-3 h-3 inline mr-1" />
                {t('patients.phone', 'Téléphone')} <span className="text-slate-400 normal-case font-normal">(optionnel)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="tel"
                  placeholder="+213 5XX XX XX XX"
                  className="input-field pl-10"
                  {...register('phone')}
                />
              </div>
            </div>

            {/* Role selector */}
            <div className="form-group">
              <label className="label">
                <Briefcase className="w-3 h-3 inline mr-1" />
                {t('signup.choose_role', 'Rôle professionnel')}
              </label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex flex-col gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                      selectedRole === r.value
                        ? `${r.color} border-current ring-2 ring-current/20`
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input type="radio" className="hidden" value={r.value} {...register('role')} />
                    <span className={`text-sm font-bold ${selectedRole === r.value ? '' : 'text-slate-700 dark:text-slate-200'}`}>{r.label}</span>
                    <span className={`text-[10px] ${selectedRole === r.value ? 'opacity-80' : 'text-slate-400'}`}>{r.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Role-specific fields */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4 animate-fade-in">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Informations spécifiques — {ROLES.find((r) => r.value === selectedRole)?.label}
              </p>

              {selectedRole === Role.MEDECIN && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">{t('common.grade', 'Grade')}</label>
                      <select className="select-field" {...register('grade')}>
                        <option value={Grade.JUNIOR}>Junior</option>
                        <option value={Grade.SENIOR}>Senior</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">{t('common.specialite', 'Spécialité')}</label>
                      <Controller
                        name="specialite"
                        control={control}
                        rules={{ required: 'Requis' }}
                        render={({ field }) => (
                          <CreatableOptionBox
                            category="SPECIALITE"
                            value={field.value || ''}
                            onChange={field.onChange}
                            error={errors.specialite?.message}
                          />
                        )}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">
                      <Hash className="w-3 h-3 inline mr-1" />
                      {t('common.order_number', "Numéro d'ordre")}
                    </label>
                    <input
                      className="input-field"
                      placeholder="12345/16"
                      {...register('numeroOrdre', { required: 'Requis' })}
                    />
                  </div>
                </>
              )}

              {selectedRole === Role.SECRETAIRE && (
                <div className="form-group">
                  <label className="label">{t('common.code_poste', 'Code Poste')}</label>
                  <input
                    className="input-field"
                    placeholder="SEC-001"
                    {...register('codePoste', { required: 'Requis' })}
                  />
                </div>
              )}

              {selectedRole === Role.INFIRMIER && (
                <div className="form-group">
                  <label className="label">{t('common.matricule', 'Matricule')}</label>
                  <input
                    className="input-field"
                    placeholder="INF-8822"
                    {...register('matricule', { required: 'Requis' })}
                  />
                </div>
              )}

              {(selectedRole === Role.MEDECIN || selectedRole === Role.SECRETAIRE) && (
                <div className="form-group">
                  <label className="label">{t('common.service', 'Service')} <span className="text-slate-400 normal-case font-normal">(optionnel)</span></label>
                  <Controller
                    name="service"
                    control={control}
                    render={({ field }) => (
                      <CreatableOptionBox
                        category="SERVICE"
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={errors.service?.message}
                      />
                    )}
                  />
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary btn-lg w-full mt-2"
            >
              {isSubmitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Traitement…</>
                : t('signup.submit', 'Soumettre ma demande')
              }
            </button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-primary-600 dark:text-primary-400 font-bold hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
