import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
    Search, 
    Filter, 
    FileText, 
    User, 
    Printer, 
    Trash2, 
    Edit2, 
    Loader2, 
    Calendar,
    ClipboardList,
    Plus,
    Clock
} from 'lucide-react';
import { ordonnanceApi } from '../services/api';
import { Ordonnance, Patient, User as UserType } from '../types';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import PrescriptionModal from '../components/PrescriptionModal';

const dateLocales: Record<string, any> = { fr, en: enUS, ar: arSA };

const PrescriptionsPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t, i18n } = useTranslation();
    const { isDoctor, isAdmin } = usePermissions();
    const currentLocale = dateLocales[i18n.language.substring(0, 2)] || fr;

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrdonnance, setEditingOrdonnance] = useState<Ordonnance | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['ordonnances-global'],
        queryFn: () => ordonnanceApi.getAll().then(r => r.data.ordonnances as Ordonnance[]),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => ordonnanceApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ordonnances-global'] });
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => ordonnanceApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ordonnances-global'] });
            setIsModalOpen(false);
            setEditingOrdonnance(null);
        }
    });

    const prescriptions = data || [];

    const filteredPrescriptions = prescriptions.filter(p => {
        const patient = p.patient as unknown as Patient;
        const patientName = `${patient?.firstName} ${patient?.lastName}`.toLowerCase();
        const medNames = p.medications.map(m => m.name.toLowerCase()).join(' ');
        return patientName.includes(searchTerm.toLowerCase()) || medNames.includes(searchTerm.toLowerCase());
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="page-title">{t('ordonnance.title', { defaultValue: 'Ordonnances' })}</h1>
                    <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
                        {t('ordonnance.subtitle', { count: filteredPrescriptions.length, defaultValue: `Gestion des prescriptions médicales (${filteredPrescriptions.length})` })}
                    </p>
                </div>
                {(isDoctor || isAdmin) && (
                    <button 
                        onClick={() => navigate('/consultations')} 
                        className="btn-primary"
                    >
                        <Plus className="w-4 h-4" /> {t('ordonnance.add', { defaultValue: 'Nouvelle Prescription' })}
                    </button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 dark:text-slate-500" />
                    <input
                        type="text"
                        className="input-field pl-11 py-3"
                        placeholder={t('ordonnance.search_placeholder', { defaultValue: 'Rechercher par patient ou médicament...' })}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="card p-0 overflow-hidden border-none shadow-premium bg-medical-card dark:bg-slate-800">
                {filteredPrescriptions.length === 0 ? (
                    <div className="text-center py-24 bg-white/50 dark:bg-slate-800/50">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-slate-700/50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-slate-700">
                            <ClipboardList className="w-10 h-10 text-gray-200 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('ordonnance.no_prescriptions_found', { defaultValue: 'Aucune ordonnance trouvée' })}</h3>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                        {filteredPrescriptions.map((p) => {
                            const patient = p.patient as unknown as Patient;
                            const medecin = p.medecin as unknown as UserType;
                            
                            return (
                                <div key={p._id} className="bg-white dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all group border-l-4 border-l-primary-500">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                                                <User className="w-5 h-5 text-primary-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors truncate max-w-[150px]">
                                                    {patient?.firstName} {patient?.lastName}
                                                </h4>
                                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{patient?.dossierNumber}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button 
                                                onClick={() => navigate(`/ordonnance/${p._id}/print`)}
                                                className="p-1.5 text-gray-400 hover:text-primary-500"
                                                title={t('common.print')}
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                            {(isDoctor || isAdmin) && (
                                                <>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingOrdonnance(p);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-amber-500"
                                                        title={t('common.edit')}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if (window.confirm(t('common.confirm_delete'))) {
                                                                deleteMutation.mutate(p._id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-red-500"
                                                        title={t('common.delete')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                            <span className="text-gray-500 font-medium flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(new Date(p.createdAt), 'dd/MM/yyyy')}
                                            </span>
                                            <span className="text-gray-500 font-medium flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {format(new Date(p.createdAt), 'HH:mm')}
                                            </span>
                                        </div>

                                        <div className="py-2">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <ClipboardList className="w-3 h-3" />
                                                {p.medications.length} {t('ordonnance.medications', { defaultValue: 'Médicaments' })}
                                            </p>
                                            <div className="space-y-1.5">
                                                {p.medications.slice(0, 3).map((m, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                                                        <span className="w-1 h-1 bg-primary-400 rounded-full"></span>
                                                        <span className="font-semibold">{m.name}</span>
                                                        <span className="text-gray-400 text-[10px]">({m.dosage})</span>
                                                    </div>
                                                ))}
                                                {p.medications.length > 3 && (
                                                    <p className="text-[10px] text-gray-400 italic pl-3">+ {p.medications.length - 3} {t('common.more', { defaultValue: 'de plus' })}...</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                                                <User className="w-3 h-3 text-teal-600" />
                                            </div>
                                            <p className="text-[10px] font-medium text-gray-500">Dr. {medecin?.firstName} {medecin?.lastName}</p>
                                        </div>
                                        <button 
                                            onClick={() => navigate(`/ordonnance/${p._id}/print`)}
                                            className="text-[10px] font-bold text-primary-600 hover:underline"
                                        >
                                            {t('common.view_details', { defaultValue: 'Voir détails' })}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {isModalOpen && editingOrdonnance && (
                <PrescriptionModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingOrdonnance(null);
                    }}
                    onSubmit={(data) => {
                        updateMutation.mutate({ id: editingOrdonnance._id, data });
                    }}
                    isSubmitting={updateMutation.isPending}
                    patientId={(editingOrdonnance.patient as any)?._id || (editingOrdonnance.patient as any)}
                    consultationId={(editingOrdonnance.consultation as any)?._id || (editingOrdonnance.consultation as any)}
                    patientName={`${(editingOrdonnance.patient as any)?.firstName} ${(editingOrdonnance.patient as any)?.lastName}`}
                    initialMedications={editingOrdonnance.medications}
                    initialNotes={editingOrdonnance.notes}
                    isEdit={true}
                />
            )}
        </div>
    );
};

export default PrescriptionsPage;
