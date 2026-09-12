import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Loader2, Trash2 } from 'lucide-react';
import { optionApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { OptionType } from '../types';

interface CreatableOptionBoxProps {
    category: 'SPECIALITE' | 'SERVICE';
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
}

export const CreatableOptionBox: React.FC<CreatableOptionBoxProps> = ({
    category,
    value,
    onChange,
    error,
    placeholder
}) => {
    const { isAdmin, isSenior } = usePermissions();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [newValue, setNewValue] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['options', category],
        queryFn: () => optionApi.getAll(category).then((r: any) => r.data.options as OptionType[]),
    });

    const createMutation = useMutation({
        mutationFn: (val: string) => optionApi.create({ category, value: val }),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['options', category] });
            onChange(res.data.option.value);
            setIsCreating(false);
            setNewValue('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => optionApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['options', category] });
        },
    });

    const options = data || [];

    const handleCreate = () => {
        if (!newValue.trim()) return;
        createMutation.mutate(newValue.trim());
    };

    return (
        <div className="relative">
            {!isCreating ? (
                <div className="flex items-center gap-2">
                    <select
                        value={value}
                        onChange={(e) => {
                            if (e.target.value === '__CREATE__') {
                                setIsCreating(true);
                            } else {
                                onChange(e.target.value);
                            }
                        }}
                        className={`input-field flex-1 ${error ? 'input-error' : ''}`}
                    >
                        <option value="">{placeholder || t('common.select', { defaultValue: 'Sélectionner...' })}</option>
                        {options.map((opt) => (
                            <option key={opt._id} value={opt.value}>
                                {opt.value}
                            </option>
                        ))}
                        {(isAdmin || isSenior) && (
                            <option value="__CREATE__" className="font-bold text-primary-600">
                                ➕ {t('common.add_new', { defaultValue: 'Ajouter une nouvelle option...' })}
                            </option>
                        )}
                    </select>

                    {/* Delete button for selected option if admin */}
                    {(isAdmin || isSenior) && value && options.find((o: OptionType) => o.value === value) && (
                        <button
                            type="button"
                            onClick={() => {
                                const opt = options.find((o: OptionType) => o.value === value);
                                if (opt && window.confirm(t('common.confirm_delete', { defaultValue: 'Êtes-vous sûr ?' }))) {
                                    deleteMutation.mutate(opt._id);
                                    onChange('');
                                }
                            }}
                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0 border border-gray-100 dark:border-slate-700"
                            title={t('common.delete', { defaultValue: 'Supprimer' })}
                        >
                            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={t('common.enter_value', { defaultValue: 'Nouvelle valeur...' })}
                        className="input-field flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreate();
                            } else if (e.key === 'Escape') {
                                setIsCreating(false);
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={createMutation.isPending || !newValue.trim()}
                        className="btn-primary p-2.5 shrink-0"
                    >
                        {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="btn-secondary p-2.5 shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
};
