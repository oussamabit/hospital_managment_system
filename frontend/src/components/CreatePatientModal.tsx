import React, { useState } from 'react';
import { Save, Loader2, AlertCircle, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { patientApi, serviceApi } from '../services/api';
import { CreatePatientDto, Service } from '../types';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';

interface Props {
  onClose: () => void;
  onSuccess: (patientId: string) => void;
}

export const CreatePatientModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => serviceApi.getAll().then((r) => r.data.services as Service[]),
  });

  const mutation = useMutation({
    mutationFn: (data: CreatePatientDto) => patientApi.create(data as unknown as Record<string, unknown>),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['patients-list'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onSuccess(response.data.patient._id);
    },
    onError: (err: AxiosError<{ message: string }>) => {
      setError(err.response?.data?.message || 'Erreur lors de la création du patient');
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<CreatePatientDto>();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="section-title">{t('patients.new_patient_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit((data) => { setError(''); mutation.mutate(data); })} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('patients.first_name')} *</label>
              <input className={`input-field ${errors.firstName ? 'input-error' : ''}`} placeholder="Mohamed" {...register('firstName', { required: t('patients.first_name'), minLength: 2 })} />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">{t('patients.last_name')} *</label>
              <input className={`input-field ${errors.lastName ? 'input-error' : ''}`} placeholder="Amrani" {...register('lastName', { required: t('patients.last_name'), minLength: 2 })} />
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
              <select className={`input-field ${errors.gender ? 'input-error' : ''}`} {...register('gender', { required: t('patients.gender') })}>
                <option value="">{t('common.select', { defaultValue: 'Select...' })}</option>
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
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t('patients.email')}</label>
            <input type="email" className={`input-field ${errors.email ? 'input-error' : ''}`} placeholder="patient@email.dz" {...register('email', { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('common.invalid_email', { defaultValue: 'Invalid email' }) } })} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">{t('patients.address')}</label>
            <input className="input-field" placeholder="Cité des 500 logements, Alger" {...register('address')} />
          </div>
          <div>
            <label className="label">{t('common.service')} <span className="text-gray-400 text-xs">(optionnel)</span></label>
            <select className="input-field" {...register('service')}>
              <option value="">{t('appointments.select_service')}</option>
              {servicesData?.map((s: Service) => (
                <option key={s._id} value={s._id}>{s.nomService}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-4 border-t mt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
