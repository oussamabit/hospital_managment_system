import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    type = 'warning',
    isLoading = false
}) => {
    if (!isOpen) return null;

    const colorClasses = {
        danger: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
        warning: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
        info: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
    };

    const btnClasses = {
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 dark:shadow-none',
        warning: 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200 dark:shadow-none',
        info: 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-200 dark:shadow-none'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onCancel}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="p-8">
                    <div className="flex items-start justify-between mb-6">
                        <div className={`p-3 rounded-2xl ${colorClasses[type]}`}>
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-6 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${btnClasses[type]}`}
                    >
                        {isLoading && (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
