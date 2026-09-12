import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordonnanceApi } from '../services/api';
import { Ordonnance, Patient, User } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, ChevronLeft, Loader2, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PrescriptionPrint: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const { data: ordonnance, isLoading, error } = useQuery({
        queryKey: ['ordonnance', id],
        queryFn: () => ordonnanceApi.getById(id!).then(r => r.data.ordonnance as Ordonnance),
        enabled: !!id,
    });

    useEffect(() => {
        if (ordonnance) {
            // Document title for printing
            document.title = `Ordonnance_${(ordonnance.patient as Patient).lastName}_${format(new Date(ordonnance.date), 'ddMMyyyy')}`;
        }
    }, [ordonnance]);

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">{t('common.loading')}</p>
            </div>
        );
    }

    if (error || !ordonnance) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('ordonnance.not_found', { defaultValue: 'Ordonnance introuvable' })}</h2>
                <p className="text-gray-500 mb-8 max-w-md">{t('ordonnance.not_found_desc', { defaultValue: "L'ordonnance que vous recherchez n'existe pas ou vous n'avez pas l'autorisation de la consulter." })}</p>
                <button onClick={() => navigate(-1)} className="btn-primary">
                    {t('common.back')}
                </button>
            </div>
        );
    }

    const patient = ordonnance.patient as Patient;
    const medecin = ordonnance.medecin as User;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 sm:p-8">
            {/* Toolbar - Hidden when printing */}
            <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between print:hidden">
                <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> {t('common.back')}
                </button>
                <button onClick={handlePrint} className="btn-primary flex items-center gap-2 shadow-lg">
                    <Printer className="w-4 h-4" /> {t('common.print', { defaultValue: 'Imprimer' })}
                </button>
            </div>

            {/* A4 Page Container */}
            <div className="max-w-4xl mx-auto bg-white shadow-2xl overflow-hidden print:shadow-none print:m-0 print:w-full">
                {/* Header Decoration */}
                <div className="h-2 bg-gradient-to-r from-primary-500 via-teal-500 to-primary-500"></div>

                <div className="p-12 sm:p-16 space-y-12">
                    {/* Header: Dr Info & Hospital Branding */}
                    <div className="flex flex-col md:flex-row justify-between gap-8 border-b-2 border-gray-100 pb-12">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                Dr. {medecin.firstName} {medecin.lastName}
                            </h1>
                            <p className="text-primary-600 font-bold uppercase tracking-wider text-sm">
                                {medecin.specialite || 'Médecin Généraliste'}
                            </p>
                            <div className="text-gray-500 text-xs space-y-1 font-medium">
                                <p>N° Ordre: {medecin.numeroOrdre || '---'}</p>
                                <p>Hôpital Universitaire d'Oran</p>
                            </div>
                        </div>

                        <div className="md:text-right space-y-2">
                            <div className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                <FileText className="w-4 h-4 text-primary-500" />
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ordonnance Médicale</span>
                            </div>
                            <p className="text-gray-900 font-bold text-sm mt-4">
                                {format(new Date(ordonnance.date), 'dd MMMM yyyy', { locale: fr })}
                            </p>
                        </div>
                    </div>

                    {/* Patient Info Section */}
                    <div className="bg-gray-50/50 rounded-3xl p-8 border border-gray-100/50 flex flex-col md:flex-row justify-between gap-6">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Patient</p>
                            <h2 className="text-xl font-bold text-gray-900">
                                {patient.firstName} {patient.lastName}
                            </h2>
                        </div>
                        <div className="md:text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Dossier N°</p>
                            <p className="font-mono font-bold text-teal-600 text-lg">{patient.dossierNumber}</p>
                        </div>
                    </div>

                    {/* Medications Section */}
                    <div className="space-y-8 py-4 min-h-[400px]">
                        <div className="flex items-center gap-4">
                            <div className="h-[2px] flex-1 bg-gray-100"></div>
                            <span className="text-4xl font-serif italic text-gray-300">Rp.</span>
                            <div className="h-[2px] flex-1 bg-gray-100"></div>
                        </div>

                        <div className="space-y-10">
                            {ordonnance.medications.map((med, index) => (
                                <div key={index} className="relative pl-8">
                                    <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-primary-500"></div>
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                            {med.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-gray-600">
                                            <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
                                                {med.dosage}
                                            </span>
                                            <span className="text-gray-300">|</span>
                                            <span>Pendant: <span className="text-gray-900 font-bold">{med.duration}</span></span>
                                        </div>
                                        {med.instructions && (
                                            <p className="text-sm text-gray-500 italic mt-1 font-serif">
                                                Observation: {med.instructions}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer: Signature & Notes */}
                    <div className="mt-auto pt-12 border-t-2 border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                            {ordonnance.notes && (
                                <>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes / Conseils</p>
                                    <p className="text-sm text-gray-600 leading-relaxed font-serif whitespace-pre-wrap">
                                        {ordonnance.notes}
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col items-center justify-center space-y-6 pt-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cachet & Signature</p>
                            <div className="w-48 h-24 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center italic text-gray-300 text-xs">
                                Espace réservé
                            </div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">Dr. {medecin.lastName}</p>
                        </div>
                    </div>
                </div>

                {/* Print Footer */}
                <div className="bg-gray-50 p-6 text-center text-[10px] text-gray-400 uppercase tracking-[0.3em] font-medium print:block">
                    Système de Gestion Hospitalière - Hôpital Universitaire d'Oran
                </div>
            </div>

            <style>{`
                @media print {
                    body {
                        background-color: white !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .print-hidden {
                        display: none !important;
                    }
                    @page {
                        size: A4;
                        margin: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default PrescriptionPrint;
