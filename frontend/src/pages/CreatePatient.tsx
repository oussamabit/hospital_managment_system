import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { patientApi } from '../services/api';
import { CreatePatientDto } from '../types';
import { AxiosError } from 'axios';

const CreatePatientPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: CreatePatientDto) => patientApi.create(data as unknown as Record<string, unknown>),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate(`/patients/${response.data.patient._id}`);
    },
    onError: (err: AxiosError<{ message: string }>) => {
      setError(err.response?.data?.message || 'Erreur lors de la création du patient');
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<CreatePatientDto>();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={() => navigate('/patients')} className="btn-ghost px-0 text-gray-500">
        <ChevronLeft className="w-4 h-4" /> {t('common.back_to_patients')}
      </button>

      <div className="card">
        <h2 className="section-title mb-6">{t('patients.new_patient_title')}</h2>

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('patients.first_name')} *</label>
              <input
                className={`input-field ${errors.firstName ? 'input-error' : ''}`}
                placeholder="Mohamed"
                {...register('firstName', { required: t('profile.first_name_req'), minLength: { value: 2, message: t('profile.min_chars', { count: 2 }) } })}
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">{t('patients.last_name')} *</label>
              <input
                className={`input-field ${errors.lastName ? 'input-error' : ''}`}
                placeholder="Amrani"
                {...register('lastName', { required: t('profile.last_name_req'), minLength: { value: 2, message: t('profile.min_chars', { count: 2 }) } })}
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('patients.birth_date')} *</label>
              <input
                type="date"
                className={`input-field ${errors.birthDate ? 'input-error' : ''}`}
                max={new Date().toISOString().split('T')[0]}
                {...register('birthDate', { 
                  required: t('patients.birth_date'),
                  validate: (v) => {
                    if (!v) return true;
                    const date = new Date(v);
                    if (date > new Date()) return t('patients.invalid_birth_date', { defaultValue: 'La date de naissance ne peut pas être dans le futur' });
                    const minDate = new Date();
                    minDate.setFullYear(minDate.getFullYear() - 120);
                    if (date < minDate) return t('patients.too_old', { defaultValue: 'Âge non réaliste' });
                    return true;
                  }
                })}
              />
              {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate.message}</p>}
            </div>
            <div>
              <label className="label">{t('patients.gender')} *</label>
              <select
                className={`input-field ${errors.gender ? 'input-error' : ''}`}
                {...register('gender', { required: t('patients.gender') })}
              >
                <option value="">{t('common.select')}</option>
                <option value="M">{t('patients.male')}</option>
                <option value="F">{t('patients.female')}</option>
              </select>
              {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('patients.phone')} *</label>
              <input
                type="tel"
                className={`input-field ${errors.phone ? 'input-error' : ''}`}
                placeholder="0550 12 34 56"
                {...register('phone', { 
                  required: t('patients.phone'),
                  pattern: {
                    value: /^(00213|\+213|0)(5|6|7)[0-9]{8}$/,
                    message: t('patients.invalid_phone', { defaultValue: 'Numéro de téléphone invalide' })
                  }
                })}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">{t('patients.blood_group')}</label>
              <select className="input-field" {...register('bloodGroup')}>
                <option value="">{t('patients.not_filled')}</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">{t('patients.email')}</label>
            <input
              type="email"
              className={`input-field ${errors.email ? 'input-error' : ''}`}
              placeholder="patient@email.dz"
              {...register('email', { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('common.invalid_email') } })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">{t('patients.address')}</label>
            <input
              className="input-field"
              placeholder="Cité des 500 logements, Alger"
              {...register('address')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/patients')} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('patients.new_patient_title')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePatientPage;
