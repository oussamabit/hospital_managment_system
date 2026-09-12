import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { X, Loader2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { userApi } from '../services/api';
import { Role, Grade } from '../types';
import { CreatableOptionBox } from './CreatableOptionBox';
import { AxiosError } from 'axios';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface CreateUserForm {
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

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [apiError, setApiError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm<CreateUserForm>({
        defaultValues: {
            role: Role.MEDECIN,
            grade: Grade.JUNIOR,
        }
    });

    const selectedRole = watch('role');

    const onSubmit = async (data: CreateUserForm) => {
        setApiError('');
        setIsSubmitting(true);
        try {
            await userApi.create(data);
            reset();
            onSuccess();
        } catch (err) {
            const error = err as AxiosError<{ message?: string; errors?: any[] }>;
            setApiError(error.response?.data?.message || t('common.error_occurred'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {t('user_management.create_user') || 'Créer un utilisateur'}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                {t('user_management.add_user') || 'Ajouter un nouvel utilisateur au système'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="px-6 py-6 overflow-y-auto custom-scrollbar">
                    {apiError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-3">
                            <span className="flex-shrink-0 text-lg">⚠</span>
                            {apiError}
                        </div>
                    )}

                    <form id="createUserForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">{t('common.first_name') || 'Prénom'}</label>
                                <input
                                    {...register('firstName', { required: true })}
                                    className={`input-field ${errors.firstName ? 'border-red-500 dark:border-red-500' : ''}`}
                                    placeholder="Ahmed"
                                />
                            </div>
                            <div>
                                <label className="label">{t('common.last_name') || 'Nom'}</label>
                                <input
                                    {...register('lastName', { required: true })}
                                    className={`input-field ${errors.lastName ? 'border-red-500 dark:border-red-500' : ''}`}
                                    placeholder="Belkacem"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label">{t('common.email') || 'Email'}</label>
                            <input
                                type="email"
                                {...register('email', { required: true })}
                                className={`input-field ${errors.email ? 'border-red-500 dark:border-red-500' : ''}`}
                                placeholder="ahmed.belkacem@hospital.dz"
                            />
                        </div>

                        <div>
                            <label className="label">{t('common.password') || 'Mot de passe'}</label>
                            <input
                                type="password"
                                {...register('password', { required: true, minLength: 6 })}
                                className={`input-field ${errors.password ? 'border-red-500 dark:border-red-500' : ''}`}
                                placeholder="••••••••"
                            />
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Min. 6 caractères</p>
                        </div>

                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
                            <label className="label text-primary-700 dark:text-primary-400 font-semibold">{t('signup.choose_role') || 'Role'}</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                                {[Role.ADMIN, Role.MEDECIN, Role.SECRETAIRE, Role.INFIRMIER].map((role) => (
                                    <label key={role} className={`
                                        flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all
                                        ${selectedRole === role
                                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-2 ring-primary-100 dark:ring-primary-900/50'
                                            : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300'}
                                    `}>
                                        <input type="radio" {...register('role')} value={role} className="hidden" />
                                        <span className="text-sm font-medium">{t(`roles.${role.toLowerCase()}`)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Role Specific Fields */}
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {selectedRole === Role.MEDECIN && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">{t('common.grade') || 'Grade'}</label>
                                            <select {...register('grade')} className="input-field">
                                                <option value={Grade.JUNIOR}>Junior</option>
                                                <option value={Grade.SENIOR}>Senior</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">{t('common.specialite') || 'Spécialité'}</label>
                                            <Controller
                                                name="specialite"
                                                control={control}
                                                rules={{ required: selectedRole === Role.MEDECIN ? (t('common.required', { defaultValue: 'Obligatoire' }) as string) : false }}
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
                                    <div>
                                        <label className="label">{t('common.order_number') || 'Numéro d\'ordre'}</label>
                                        <input {...register('numeroOrdre', { required: selectedRole === Role.MEDECIN })} className="input-field" placeholder="12345/67" />
                                    </div>
                                </>
                            )}

                            {selectedRole === Role.SECRETAIRE && (
                                <div>
                                    <label className="label">{t('common.code_poste') || 'Code Poste'}</label>
                                    <input {...register('codePoste', { required: selectedRole === Role.SECRETAIRE })} className="input-field" placeholder="SEC-001" />
                                </div>
                            )}

                            {selectedRole === Role.INFIRMIER && (
                                <div>
                                    <label className="label">{t('common.matricule') || 'Matricule'}</label>
                                    <input {...register('matricule', { required: selectedRole === Role.INFIRMIER })} className="input-field" placeholder="INF-8822" />
                                </div>
                            )}

                            {(selectedRole === Role.MEDECIN || selectedRole === Role.SECRETAIRE) && (
                                <div>
                                    <label className="label">{t('common.service') || 'Service (Optionnel)'}</label>
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
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-3 sticky bottom-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-secondary"
                        disabled={isSubmitting}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        form="createUserForm"
                        type="submit"
                        className="btn-primary min-w-[120px] justify-center"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (t('common.save') || 'Sauvegarder')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateUserModal;
