import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { X, Loader2, User, Mail, Phone, Shield, Stethoscope, Building2, Key, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { userApi } from '../services/api';
import { Role, Grade } from '../types';
import { AxiosError } from 'axios';
import { CreatableOptionBox } from './CreatableOptionBox';

interface EditUserModalProps {
    userId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface EditUserForm {
    firstName: string;
    lastName: string;
    phone?: string;
    grade?: Grade;
    specialite?: string;
    numeroOrdre?: string;
    service?: string;
    codePoste?: string;
    matricule?: string;
    password?: string;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ userId, isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [apiError, setApiError] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [userData, setUserData] = useState<any>(null);

    const { register, handleSubmit, reset, control, formState: { errors } } = useForm<EditUserForm>();

    useEffect(() => {
        if (isOpen && userId) {
            setIsFetching(true);
            setApiError('');
            userApi.getById(userId)
                .then((res) => {
                    const u = res.data.user;
                    setUserData(u);
                    reset({
                        firstName: u.firstName || '',
                        lastName: u.lastName || '',
                        phone: u.phone || '',
                        grade: u.grade,
                        specialite: u.specialite || '',
                        numeroOrdre: u.numeroOrdre || '',
                        service: u.service || '',
                        codePoste: u.codePoste || '',
                        matricule: u.matricule || '',
                        password: '',
                    });
                })
                .catch(() => setApiError("Impossible de charger les informations de l'utilisateur."))
                .finally(() => setIsFetching(false));
        } else {
            setUserData(null);
            reset();
        }
    }, [isOpen, userId, reset]);

    const onSubmit = async (data: EditUserForm) => {
        if (!userId) return;
        setApiError('');
        setIsSubmitting(true);
        // Only send password if non-empty
        const payload: any = { ...data };
        if (!payload.password) delete payload.password;
        try {
            await userApi.update(userId, payload);
            onSuccess();
        } catch (err) {
            const error = err as AxiosError<{ message?: string }>;
            setApiError(error.response?.data?.message || t('common.error_occurred'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const role = userData?.role as Role | undefined;

    const RoleConfig: Record<string, { color: string; label: string }> = {
        [Role.ADMIN]: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Admin' },
        [Role.MEDECIN]: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Médecin' },
        [Role.SECRETAIRE]: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Secrétaire' },
        [Role.INFIRMIER]: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Infirmier' },
    };
    const roleDisplay = role ? RoleConfig[role] : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-700/50">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isFetching ? 'Chargement...' : `${userData?.firstName || ''} ${userData?.lastName || ''}`}
                            </h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                Modifier les informations du membre
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6 overflow-y-auto flex-1">
                    {isFetching ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                        </div>
                    ) : (
                        <>
                            {/* Read-only info pills */}
                            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-700/50">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Informations du compte</p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium">{userData?.email}</span>
                                    </span>
                                    {roleDisplay && (
                                        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${roleDisplay.color}`}>
                                            <Shield className="w-3 h-3" />
                                            {roleDisplay.label}
                                        </span>
                                    )}
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${userData?.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                        {userData?.isActive ? '✓ Actif' : '✗ Inactif'}
                                    </span>
                                </div>
                            </div>

                            {apiError && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 mb-5 text-red-700 dark:text-red-300 text-sm flex gap-3 items-center">
                                    <span className="font-bold shrink-0">!</span> {apiError}
                                </div>
                            )}

                            <form id="editUserForm" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                {/* Name row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">{t('common.first_name') || 'Prénom'}</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input {...register('firstName', { required: true })} className="input-field pl-9" placeholder="Ahmed" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">{t('common.last_name') || 'Nom'}</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input {...register('lastName', { required: true })} className="input-field pl-9" placeholder="Belkacem" />
                                        </div>
                                    </div>
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="label">{t('common.phone') || 'Téléphone'}</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input {...register('phone')} className="input-field pl-9" placeholder="+213 550 12 34 56" />
                                    </div>
                                </div>

                                {/* Role-specific fields */}
                                {role === Role.MEDECIN && (
                                    <div className="p-4 bg-blue-50/60 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30 space-y-4">
                                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Informations médicales</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="label">Grade</label>
                                                <select {...register('grade')} className="input-field">
                                                    <option value={Grade.JUNIOR}>Junior</option>
                                                    <option value={Grade.SENIOR}>Senior</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label">Spécialité</label>
                                                <Controller
                                                    name="specialite"
                                                    control={control}
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
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="label">N° Ordre</label>
                                                <input {...register('numeroOrdre')} className="input-field" placeholder="12345/16" />
                                            </div>
                                            <div>
                                                <label className="label">Service</label>
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
                                        </div>
                                    </div>
                                )}

                                {role === Role.SECRETAIRE && (
                                    <div className="p-4 bg-orange-50/60 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-800/30 space-y-4">
                                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Informations secrétariat</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="label">Code Poste</label>
                                                <input {...register('codePoste')} className="input-field" placeholder="SEC-001" />
                                            </div>
                                            <div>
                                                <label className="label">Service</label>
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
                                        </div>
                                    </div>
                                )}

                                {role === Role.INFIRMIER && (
                                    <div className="p-4 bg-green-50/60 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-800/30 space-y-4">
                                        <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Informations infirmier</p>
                                        <div>
                                            <label className="label">Matricule</label>
                                            <input {...register('matricule')} className="input-field" placeholder="INF-8822" />
                                        </div>
                                    </div>
                                )}

                                {/* Password change (optional) */}
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                    <label className="label flex items-center gap-2">
                                        <Key className="w-4 h-4 text-slate-400" />
                                        Changer le mot de passe <span className="text-slate-400 font-normal">(optionnel)</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            {...register('password', { minLength: { value: 6, message: 'Min. 6 caractères' } })}
                                            className="input-field pr-12"
                                            placeholder="Laisser vide pour ne pas modifier"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                                </div>
                            </form>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-3 sticky bottom-0">
                    <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
                        {t('common.cancel')}
                    </button>
                    <button
                        form="editUserForm"
                        type="submit"
                        className="btn-primary min-w-[130px] justify-center"
                        disabled={isSubmitting || isFetching}
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditUserModal;
