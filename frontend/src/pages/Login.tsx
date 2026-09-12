import React, { useState } from 'react';
import {
  Eye, EyeOff, Loader2, Mail, Lock, Stethoscope, ArrowRight,
  ShieldCheck, Activity, Users,
} from 'lucide-react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  { role: 'Administrateur', email: 'admin@hospital.dz',      color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30' },
  { role: 'Médecin Senior', email: 'senior@hospital.dz',     color: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800 dark:hover:bg-primary-900/30' },
  { role: 'Médecin Junior', email: 'junior@hospital.dz',     color: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800 dark:hover:bg-cyan-900/30' },
  { role: 'Secrétaire',     email: 'secretaire@hospital.dz', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/30' },
];

const FEATURES = [
  { icon: Users,       title: 'Gestion des patients',       desc: 'Dossiers médicaux centralisés et sécurisés' },
  { icon: Activity,    title: 'Suivi en temps réel',        desc: 'Tableaux de bord et statistiques instantanées' },
  { icon: ShieldCheck, title: 'Sécurité des données',       desc: 'Conformité RGPD et chiffrement de bout en bout' },
];

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError,     setApiError]     = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>();

  if (isAuthenticated && !isLoading) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (data: LoginForm) => {
    setApiError('');
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      setApiError(error.response?.data?.message || t('login.invalid_credentials', 'Identifiants invalides'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-medical-bg dark:bg-slate-950 flex items-center justify-center p-4">

      {/* Card container */}
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-4xl shadow-modal overflow-hidden flex border border-slate-200/70 dark:border-slate-800">

        {/* ── LEFT PANEL ── */}
        <div className="hidden md:flex md:w-5/12 lg:w-[45%] relative flex-col justify-between p-8 lg:p-10 overflow-hidden">

          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-600 to-cyan-600" />

          {/* Decorative circles */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/3" />

          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Content */}
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-lg tracking-tight leading-tight">MediCare Pro</p>
                <p className="text-white/50 text-xs tracking-widest uppercase">HMS v2.0</p>
              </div>
            </div>
          </div>

          {/* Middle text */}
          <div className="relative z-10 space-y-4">
            <h2 className="text-3xl font-black text-white leading-tight tracking-tight">
              Gérez votre clinique<br/>
              <span className="text-cyan-200">intelligemment</span>
            </h2>
            <p className="text-white/70 text-[15px] leading-relaxed max-w-sm">
              Plateforme unifiée de gestion hospitalière — patients, rendez-vous, consultations.
            </p>

            {/* Feature list */}
            <div className="space-y-3 pt-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <f.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{f.title}</p>
                    <p className="text-white/55 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10">
            <p className="text-white/40 text-xs">© 2026 CHU — Système de Gestion Intégré</p>
          </div>
        </div>

        {/* ── RIGHT PANEL (Form) ── */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-8 md:px-10 lg:px-12 py-12">
          <div className="w-full max-w-md mx-auto">

            {/* Mobile logo */}
            <div className="md:hidden flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-gradient-medical flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">MediCare Pro</p>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {t('login.title', 'Bon retour !')} 
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
                {t('login.subtitle', 'Connectez-vous pour accéder à votre espace de travail')}
              </p>
            </div>

            {/* Error alert */}
            {apiError && (
              <div className="alert alert-error mb-5 animate-slide-up">
                <div className="w-6 h-6 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-danger-600 text-xs font-bold">!</span>
                </div>
                <p>{apiError}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Email */}
              <div className="form-group">
                <label className="label" htmlFor="email">
                  {t('login.email_label', 'Adresse e-mail')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="votre@email.dz"
                    className={`input-field pl-10 ${errors.email ? 'input-error' : ''}`}
                    {...register('email', {
                      required: 'E-mail requis',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail invalide' },
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-danger-500 font-medium mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="form-group">
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="password">
                    {t('login.password_label', 'Mot de passe')}
                  </label>
                  <a href="#" className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                    Mot de passe oublié ?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={`input-field pl-10 pr-11 ${errors.password ? 'input-error' : ''}`}
                    {...register('password', { required: 'Mot de passe requis' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon w-7 h-7 rounded-lg"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4 text-slate-400" />
                      : <Eye className="w-4 h-4 text-slate-400" />
                    }
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-danger-500 font-medium mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary btn-lg w-full mt-2"
              >
                {isSubmitting
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : (
                    <>
                      {t('login.login_button', 'Se connecter')}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )
                }
              </button>
            </form>

            {/* Signup link */}
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
              {t('login.no_account', 'Nouveau personnel ?')}{' '}
              <Link
                to="/signup"
                className="text-primary-600 dark:text-primary-400 font-bold hover:underline"
              >
                {t('login.create_account', 'Demander un accès')}
              </Link>
            </p>

            {/* Demo accounts */}
            <div className="mt-7 pt-6 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 text-center mb-3 uppercase tracking-widest">
                Accès démo rapide
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => { setValue('email', demo.email); setValue('password', 'Password123!'); }}
                    className={`chip text-[11px] border ${demo.color}`}
                  >
                    {demo.role}
                  </button>
                ))}
              </div>
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-3">
                Mot de passe :{' '}
                <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg font-mono text-slate-600 dark:text-slate-300">
                  Password123!
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
