import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { User, Lock, CheckCircle, Loader2, Eye, EyeOff, AlertCircle, Edit2, X, Save } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { authApi } from '../services/api';
import { RoleLabels, RoleColors } from '../types';
import { AxiosError } from 'axios';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();

  // Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password State
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwError, setPwError] = useState('');

  const { register: registerProfile, handleSubmit: handleSubmitProfile, reset: resetProfile, formState: { errors: profileErrors } } = useForm<ProfileForm>({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
    }
  });

  const { register: registerPw, handleSubmit: handlePwSubmit, watch: watchPw, reset: resetPw, formState: { errors: pwErrors } } = useForm<PasswordForm>();
  const newPw = watchPw('newPassword', '');

  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data as unknown as Record<string, string>),
    onSuccess: (response) => {
      updateUser(response.data.user);
      setProfileSuccess(true);
      setProfileError('');
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(false), 4000);
    },
    onError: (err: AxiosError<{ message: string }>) => {
      setProfileError(err.response?.data?.message || t('profile.update_error'));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordForm) =>
      authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setPwSuccess(true);
      setPwError('');
      resetPw();
      setShowPwForm(false);
      setTimeout(() => setPwSuccess(false), 4000);
    },
    onError: (err: AxiosError<{ message: string }>) => {
      setPwError(err.response?.data?.message || t('profile.pw_update_error'));
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile card */}
      <div className="card">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-teal-500 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-2xl font-bold">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.role !== 'SECRETAIRE' ? 'Dr.' : ''} {user.firstName} {user.lastName}
            </h2>
            <span className={`badge ${RoleColors[user.role as keyof typeof RoleColors]} mt-1`}>
              {t(`roles.${user.role.toLowerCase()}`)}
            </span>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
              <span>✉</span> {user.email}
            </p>
            {user.phone && (
              <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>📞</span> {user.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="card relative">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <h3 className="section-title">{t('profile.title')}</h3>
          </div>
          {!isEditingProfile && (
            <button onClick={() => {
              resetProfile({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' });
              setIsEditingProfile(true);
            }} className="btn-ghost text-primary-600 hover:bg-primary-50">
              <Edit2 className="w-4 h-4 mr-2" />
              {t('common.edit')}
            </button>
          )}
        </div>

        {profileSuccess && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-green-600 text-sm">{t('profile.profile_updated')}</p>
          </div>
        )}

        {isEditingProfile ? (
          <form onSubmit={handleSubmitProfile((data) => { setProfileError(''); profileMutation.mutate(data); })} className="space-y-4">
            {profileError && (
              <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm">{profileError}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('patients.first_name')}</label>
                <input
                  className={`input-field ${profileErrors.firstName ? 'input-error' : ''}`}
                  {...registerProfile('firstName', { required: t('profile.first_name_req'), minLength: { value: 2, message: t('profile.min_chars', { count: 2 }) } })}
                />
                {profileErrors.firstName && <p className="text-red-500 text-xs mt-1">{profileErrors.firstName.message}</p>}
              </div>
              <div>
                <label className="label">{t('patients.last_name')}</label>
                <input
                  className={`input-field ${profileErrors.lastName ? 'input-error' : ''}`}
                  {...registerProfile('lastName', { required: t('profile.last_name_req'), minLength: { value: 2, message: t('profile.min_chars', { count: 2 }) } })}
                />
                {profileErrors.lastName && <p className="text-red-500 text-xs mt-1">{profileErrors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <label className="label">{t('patients.phone')}</label>
              <input
                className="input-field"
                placeholder="+213 5XX XX XX XX"
                {...registerProfile('phone')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 opacity-60 pointer-events-none">
              <div>
                <label className="label">Email</label>
                <input className="input-field" value={user.email} disabled />
              </div>
              <div>
                <label className="label">{t('profile.status_label')}</label>
                <input className="input-field" value={t(`roles.${user.role.toLowerCase()}`)} disabled />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button type="button" onClick={() => setIsEditingProfile(false)} className="btn-secondary flex-1">
                <X className="w-4 h-4 mr-2" />
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: t('patients.first_name'), value: user.firstName },
              { label: t('patients.last_name'), value: user.lastName },
              { label: t('patients.email'), value: user.email },
              { label: t('common.rdv_management'), value: t(`roles.${user.role.toLowerCase()}`) },
              { label: t('patients.phone'), value: user.phone || '—' },
              { label: t('profile.status_label'), value: user.isActive ? t('profile.active') : t('profile.inactive') },
            ].map((field) => (
              <div key={field.label}>
                <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">{field.label}</p>
                <p className="text-gray-800 dark:text-slate-200 font-medium">{field.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password change */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary-600" />
            </div>
            <h3 className="section-title">{t('profile.security')}</h3>
          </div>
          {!showPwForm && (
            <button onClick={() => setShowPwForm(true)} className="btn-secondary text-sm">
              {t('profile.change_password')}
            </button>
          )}
        </div>

        {pwSuccess && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-green-600 text-sm">{t('profile.password_updated')}</p>
          </div>
        )}

        {showPwForm && (
          <form
            onSubmit={handlePwSubmit((data) => { setPwError(''); passwordMutation.mutate(data); })}
            className="space-y-4"
          >
            {pwError && (
              <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm">{pwError}</p>
              </div>
            )}

            <div>
              <label className="label">{t('profile.current_password')}</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className={`input-field pr-12 ${pwErrors.currentPassword ? 'input-error' : ''}`}
                  {...registerPw('currentPassword', { required: t('common.loading') })}
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwErrors.currentPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.currentPassword.message}</p>}
            </div>

            <div>
              <label className="label">{t('profile.new_password')}</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  className={`input-field pr-12 ${pwErrors.newPassword ? 'input-error' : ''}`}
                  {...registerPw('newPassword', {
                    required: t('common.loading'),
                    minLength: { value: 8, message: t('profile.pw_min_chars') },
                  })}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwErrors.newPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.newPassword.message}</p>}
            </div>

            <div>
              <label className="label">{t('profile.confirm_new_password')}</label>
              <input
                type="password"
                className={`input-field ${pwErrors.confirmPassword ? 'input-error' : ''}`}
                {...registerPw('confirmPassword', {
                  required: t('common.loading'),
                  validate: (v) => v === newPw || t('profile.pw_mismatch'),
                })}
              />
              {pwErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.confirmPassword.message}</p>}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowPwForm(false); resetPw(); setPwError(''); }} className="btn-secondary flex-1">
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {t('profile.change_password')}
              </button>
            </div>
          </form>
        )}

        {!showPwForm && (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('profile.security_desc')}
          </p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
