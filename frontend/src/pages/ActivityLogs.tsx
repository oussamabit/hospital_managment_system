import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    Search,
    Filter as FilterIcon,
    RotateCcw,
    User as UserIcon,
    Calendar,
    ChevronDown,
    ChevronUp,
    Info,
    AlertCircle,
    CheckCircle2,
    Loader2,
    ArrowRight,
    LogIn,
    LogOut,
    Plus,
    Edit2,
    Trash2,
    X,
    Clock
} from 'lucide-react';
import { auditApi, userApi } from '../services/api';
import { format, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface AuditLog {
    _id: string;
    action: string;
    resourceType: string;
    resourceId: string;
    performedBy: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
    };
    description: string;
    previousState?: any;
    newState?: any;
    timestamp: string;
}

const ActivityLogs: React.FC = () => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [undoingLog, setUndoingLog] = useState<string | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Filters state
    const [filters, setFilters] = useState({
        resourceType: '',
        action: '',
        performedBy: '',
        startDate: '',
        endDate: ''
    });

    const [users, setUsers] = useState<any[]>([]);

    const fetchUsers = async () => {
        try {
            const res = await userApi.getAll();
            setUsers(res.data.users);
        } catch (err) {
            console.error('Failed to fetch users for filters');
        }
    };

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params: any = { ...filters };
            if (params.startDate) params.startDate = startOfDay(new Date(params.startDate)).toISOString();
            if (params.endDate) params.endDate = endOfDay(new Date(params.endDate)).toISOString();

            const res = await auditApi.getLogs(params);
            setLogs(res.data.logs);
            setError('');
        } catch (err) {
            setError(t('common.error_occurred') || 'Erreur lors du chargement des logs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchUsers();
    }, []);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({
            resourceType: '',
            action: '',
            performedBy: '',
            startDate: '',
            endDate: ''
        });
    };

    const handleApplyFilters = () => {
        fetchLogs();
    };

    const handleUndoClick = (logId: string) => {
        setSelectedLogId(logId);
        setIsConfirmOpen(true);
    };

    const handleConfirmUndo = async () => {
        if (!selectedLogId) return;

        setUndoingLog(selectedLogId);
        setIsConfirmOpen(false);
        try {
            await auditApi.undo(selectedLogId);
            await fetchLogs();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erreur lors de l\'annulation');
        } finally {
            setUndoingLog(null);
            setSelectedLogId(null);
        }
    };

    const getActionInfo = (action: string) => {
        switch (action) {
            case 'CREATE': return { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Plus };
            case 'UPDATE': return { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Edit2 };
            case 'DELETE': return { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Trash2 };
            case 'RESTORE': return { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: RotateCcw };
            case 'STATUS_CHANGE': return { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Activity };
            case 'LOGIN': return { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: LogIn };
            case 'LOGOUT': return { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400', icon: LogOut };
            default: return { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: Info };
        }
    };

    const fieldLabels: Record<string, string> = {
        dateTime: 'Date & Heure',
        duration: 'Durée (min)',
        status: 'Statut',
        motif: 'Motif',
        firstName: 'Prénom',
        lastName: 'Nom',
        email: 'Email',
        phone: 'Téléphone',
        role: 'Rôle',
        specialite: 'Spécialité',
        service: 'Service',
        grade: 'Grade',
        numeroOrdre: 'N° Ordre',
        dossierNumber: 'N° Dossier',
        birthDate: 'Date de Naissance',
        medecin: 'Médecin',
        patient: 'Patient',
        createdBy: 'Créé par',
        isActive: 'Compte Actif',
        description: 'Description',
        type: 'Type',
        date: 'Date'
    };

    const valueTranslations: Record<string, string> = {
        PLANIFIE: 'Planifié',
        CONFIRME: 'Confirmé',
        ANNULE: 'Annulé',
        VALIDE: 'Validé',
        EN_ATTENTE: 'En attente',
        COMPLETED: 'Terminé',
        ADMIN: 'Administrateur',
        MEDECIN: 'Médecin',
        SECRETAIRE: 'Secrétaire',
        INFIRMIER: 'Infirmier',
    };

    // Build ID to Name map from logs and fetched users
    const idToNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        logs.forEach(log => {
            if (log.performedBy) {
                map[log.performedBy._id] = `${log.performedBy.firstName} ${log.performedBy.lastName}`;
            }
        });
        users.forEach(user => {
            map[user._id] = `${user.firstName} ${user.lastName}`;
        });
        return map;
    }, [logs, users]);

    const formatValue = (val: any, fieldKey?: string): string => {
        if (val === null || val === undefined) return '—';
        if (typeof val === 'boolean') return val ? 'Oui' : 'Non';

        // Handle ID resolution for specific fields
        const idFields = ['performedBy', 'createdBy', 'medecin', 'patient', 'resourceId'];
        if (typeof val === 'string' && (idFields.includes(fieldKey || '') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))) {
            if (idToNameMap[val]) return idToNameMap[val];
        }

        // Handle ISO Dates
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            try {
                return format(new Date(val), 'dd/MM/yyyy HH:mm', { locale: fr });
            } catch {
                return val;
            }
        }

        if (typeof val === 'string' && valueTranslations[val]) {
            return valueTranslations[val];
        }

        if (typeof val === 'object') {
            if (val._id) return idToNameMap[val._id] || val._id;
            return JSON.stringify(val);
        }
        return String(val);
    };

    const ignoredFields = ['_id', '__v', 'createdAt', 'updatedAt', 'password', 'tokens'];

    const renderStateDiff = (prev: any, next: any) => {
        if (!prev && !next) return null;

        if (!prev && next) {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(Object.entries(next) as [string, any][]).map(([key, value]) => (
                        value && !ignoredFields.includes(key) && typeof value !== 'object' && (
                            <div key={key} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all">
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">
                                    {fieldLabels[key] || key}
                                </span>
                                <span className="text-base text-slate-700 dark:text-slate-200 font-bold truncate block decoration-primary-500/30 decoration-2 underline-offset-4">
                                    {formatValue(value, key)}
                                </span>
                            </div>
                        )
                    ))}
                </div>
            );
        }

        const allKeys = Array.from(new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]));
        const diffs = allKeys.filter(key => {
            if (ignoredFields.includes(key)) return false;
            const v1 = prev?.[key];
            const v2 = next?.[key];
            if (typeof v1 === 'object' || typeof v2 === 'object') return false;
            return String(v1) !== String(v2);
        });

        if (diffs.length === 0) return <p className="text-sm text-slate-400 italic">Aucun changement détecté dans les champs principaux</p>;

        return (
            <div className="grid grid-cols-1 gap-4">
                {diffs.map(key => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm gap-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <div className="min-w-[140px]">
                            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1 sm:mb-0">
                                {fieldLabels[key] || key}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex-1 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium line-through decoration-red-400/50">
                                {formatValue(prev?.[key], key)}
                            </div>
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full shadow-inner">
                                <ArrowRight className="w-4 h-4 text-primary-500" />
                            </div>
                            <div className="flex-1 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm font-black ring-2 ring-green-100 dark:ring-green-900/30 shadow-sm shadow-green-100/50">
                                {formatValue(next?.[key], key)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Confirmer l'annulation"
                message="Êtes-vous sûr de vouloir annuler cette action ? Cela restaurera les données à leur état précédent."
                type="warning"
                onConfirm={handleConfirmUndo}
                onCancel={() => setIsConfirmOpen(false)}
                confirmText="Oui, annuler"
                cancelText="Non, garder"
            />

            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white flex items-center gap-4 tracking-tight">
                        <div className="p-3 bg-primary-500 rounded-3xl shadow-lg shadow-primary-200 dark:shadow-none">
                            <Activity className="w-8 h-8 text-white" />
                        </div>
                        Journal d'activité
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg">
                        Surveillance en temps réel des actions et de la sécurité du système.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-4 rounded-2xl shadow-sm transition-all flex items-center gap-3 font-bold active:scale-95 ${showFilters ? 'bg-primary-500 text-white shadow-primary-200' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:bg-slate-50'}`}
                    >
                        <FilterIcon className="w-5 h-5" />
                        Filtres {Object.values(filters).filter(Boolean).length > 0 && `(${Object.values(filters).filter(Boolean).length})`}
                    </button>
                    <button
                        onClick={fetchLogs}
                        className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-3 font-bold text-slate-700 dark:text-white group active:scale-95"
                        disabled={isLoading}
                    >
                        <RotateCcw className={`w-5 h-5 group-hover:rotate-180 transition-transform duration-500 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            {showFilters && (
                <div className="mb-8 p-8 bg-white dark:bg-slate-800 rounded-[40px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700/50 animate-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Ressource</label>
                            <select
                                name="resourceType"
                                value={filters.resourceType}
                                onChange={handleFilterChange}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-bold text-slate-700 dark:text-white"
                            >
                                <option value="">Toutes</option>
                                <option value="User">Utilisateur</option>
                                <option value="Patient">Patient</option>
                                <option value="RendezVous">Rendez-vous</option>
                                <option value="Consultation">Consultation</option>
                                <option value="Service">Service</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Action</label>
                            <select
                                name="action"
                                value={filters.action}
                                onChange={handleFilterChange}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-bold text-slate-700 dark:text-white"
                            >
                                <option value="">Toutes</option>
                                <option value="CREATE">Création</option>
                                <option value="UPDATE">Modification</option>
                                <option value="DELETE">Suppression</option>
                                <option value="RESTORE">Restauration</option>
                                <option value="LOGIN">Connexion</option>
                                <option value="LOGOUT">Déconnexion</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Utilisateur</label>
                            <select
                                name="performedBy"
                                value={filters.performedBy}
                                onChange={handleFilterChange}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-bold text-slate-700 dark:text-white"
                            >
                                <option value="">Tous les membres</option>
                                {users.map(u => (
                                    <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Du</label>
                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleFilterChange}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-bold text-slate-700 dark:text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Au</label>
                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleFilterChange}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 font-bold text-slate-700 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50">
                        <button
                            onClick={resetFilters}
                            className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                        >
                            Réinitialiser
                        </button>
                        <button
                            onClick={handleApplyFilters}
                            className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-95"
                        >
                            Appliquer les filtres
                        </button>
                    </div>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-[32px] text-red-700 dark:text-red-400 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                    <AlertCircle className="w-6 h-6 shrink-0" />
                    <p className="font-medium">{error}</p>
                    <button onClick={() => setError('')} className="ml-auto"><X className="w-5 h-5" /></button>
                </div>
            )}

            {/* Logs List */}
            <div className="bg-white dark:bg-slate-800 rounded-[40px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                {isLoading && logs.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center">
                        <div className="relative mb-8">
                            <div className="w-20 h-20 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
                            <Activity className="w-8 h-8 text-primary-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-slate-400 dark:text-slate-500 text-xl font-medium">Recherche d'activité...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center px-4">
                        <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900/40 rounded-[32px] flex items-center justify-center mb-8 rotate-12 transition-transform duration-500">
                            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Aucun résultat</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm text-lg">
                            Nous n'avons trouvé aucun événement correspondant à vos critères de recherche.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {logs.map((log) => {
                            const { color, icon: Icon } = getActionInfo(log.action);
                            return (
                                <div key={log._id} className={`transition-all duration-300 ${expandedLog === log._id ? 'bg-primary-50/30 dark:bg-primary-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/10'}`}>
                                    <div
                                        className="p-6 md:p-8 cursor-pointer group"
                                        onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                                    >
                                        <div className="flex items-start gap-6">
                                            <div className={`p-4 rounded-3xl shrink-0 shadow-sm transition-transform group-hover:scale-110 duration-300 ${color.split(' ')[0]}`}>
                                                <Icon className={`w-6 h-6 ${color.split(' ')[1]}`} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-xl ${color}`}>
                                                            {log.action}
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{log.resourceType}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/40 px-3 py-1 rounded-xl">
                                                        <Calendar className="w-4 h-4 text-primary-500" />
                                                        {format(new Date(log.timestamp), 'dd MMMM HH:mm', { locale: fr })}
                                                    </div>
                                                </div>

                                                <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                                                    {log.description}
                                                </h4>

                                                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                                                        <UserIcon className="w-4 h-4 text-primary-500" />
                                                        {log.performedBy ? `${log.performedBy.firstName} ${log.performedBy.lastName}` : 'Système'}
                                                    </div>
                                                    <div className="text-xs font-mono bg-slate-50 dark:bg-slate-900/40 px-2 py-1 rounded-lg">
                                                        ID: {log.resourceId.split('-')[0]}...
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {log.action !== 'RESTORE' && log.action !== 'LOGIN' && log.action !== 'LOGOUT' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUndoClick(log._id);
                                                        }}
                                                        disabled={undoingLog === log._id}
                                                        className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary-600 hover:border-primary-200 dark:hover:border-primary-900/50 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-90"
                                                        title="Annuler cette action"
                                                    >
                                                        {undoingLog === log._id ? (
                                                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                                        ) : (
                                                            <RotateCcw className="w-6 h-6" />
                                                        )}
                                                    </button>
                                                )}
                                                <div className={`transition-transform duration-300 ${expandedLog === log._id ? 'rotate-180 text-primary-600' : 'text-slate-300'}`}>
                                                    <ChevronDown className="w-8 h-8" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded details */}
                                    {expandedLog === log._id && (
                                        <div className="px-8 pb-10 pt-4 animate-in slide-in-from-top-4 duration-500">
                                            <div className="bg-slate-50/50 dark:bg-slate-900/40 p-8 rounded-[32px] border border-slate-100 dark:border-slate-700/50">
                                                <h5 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3 uppercase tracking-wider">
                                                    <Info className="w-6 h-6 text-primary-500" />
                                                    Détails des changements
                                                </h5>

                                                <div className="max-w-4xl">
                                                    {log.action === 'LOGIN' || log.action === 'LOGOUT' ? (
                                                        <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                                                            <p className="font-medium">Cet événement de sécurité a été enregistré avec succès pour l'utilisateur.</p>
                                                        </div>
                                                    ) : (
                                                        renderStateDiff(log.previousState, log.newState)
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLogs;
