import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    Users,
    UserCheck,
    UserX,
    ShieldCheck,
    RefreshCw,
    Check,
    X,
    MoreVertical,
    Search,
    Filter,
    UserPlus,
    Pencil,
    Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { userApi } from '../services/api';
import CreateUserModal from '../components/CreateUserModal';
import EditUserModal from '../components/EditUserModal';
import { User, Role, RoleColors } from '../types';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';

const dateLocales: Record<string, any> = { fr, en: enUS, ar: arSA };

const UserManagementPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<Role | 'ALL'>('ALL');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editUserId, setEditUserId] = useState<string | null>(null);

    // Fetch users
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const response = await userApi.getAll();
            return response.data.users as User[];
        },
    });

    // Approve User Mutation
    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            await userApi.approve(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            alert(t('user_management.messages.approved_success'));
        },
        onError: () => alert(t('user_management.messages.approved_error')),
    });

    // Terminate User Mutation
    const terminateMutation = useMutation({
        mutationFn: async (id: string) => {
            await userApi.terminate(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            alert(t('user_management.messages.terminated_success'));
        },
        onError: () => alert(t('user_management.messages.terminated_error')),
    });

    // Change Role Mutation
    const changeRoleMutation = useMutation({
        mutationFn: async ({ id, role }: { id: string, role: Role }) => {
            await userApi.updateRole(id, role);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            alert(t('user_management.messages.role_updated_success'));
        },
        onError: () => alert(t('user_management.messages.role_updated_error')),
    });

    const handleExport = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch('/api/admin/export-data', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Export failed');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hospital_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error(err);
            alert(t('common.error_occurred'));
        }
    };

    const filteredUsers = data?.filter(u => {
        const matchesSearch = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'ALL' || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const pendingCount = data?.filter(u => !u.isActive).length || 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-primary-600" />
                        {t('user_management.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 mt-1">{t('user_management.description')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn-primary"
                    >
                        <UserPlus className="w-5 h-5 mr-2" />
                        <span className="hidden sm:inline">{t('user_management.add_user') || 'Ajouter'}</span>
                        <span className="sm:hidden">{t('common.add') || 'Ajouter'}</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="btn-secondary flex items-center gap-2"
                        title={t('admin.export_data', { defaultValue: 'Exporter toutes les données' })}
                    >
                        <Download className="w-5 h-5" />
                        <span className="hidden lg:inline">{t('admin.export_data', { defaultValue: 'Exporter JSON' })}</span>
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-gray-200 bg-white shadow-sm"
                        title={t('common.refresh') || 'Rafraîchir'}
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card bg-white border-l-4 border-l-amber-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('user_management.pending_validation')}</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{pendingCount}</h3>
                        </div>
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                            <UserCheck className="w-6 h-6" />
                        </div>
                    </div>
                </div>
                <div className="card bg-white border-l-4 border-l-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">{t('user_management.total_staff')}</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{data?.length || 0}</h3>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {isError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 flex flex-col items-center gap-3">
                    <AlertCircle className="w-12 h-12" />
                    <p className="font-semibold">{t('user_management.error_loading_users')}</p>
                    <p className="text-sm opacity-80">{(error as any)?.response?.data?.message || t('user_management.check_connection')}</p>
                    <button onClick={() => refetch()} className="btn-primary mt-2">{t('common.retry')}</button>
                </div>
            )}

            {/* Filters & Table */}
            <div className="card bg-white p-0 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between bg-gray-50/50">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                        <input
                            type="text"
                            placeholder={t('user_management.search_placeholder')}
                            className="input-field pl-10 h-10 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400 mr-1" />
                        <select
                            className="input-field h-10 py-0 text-sm w-40"
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value as any)}
                        >
                            <option value="ALL">{t('user_management.all_roles')}</option>
                            {Object.values(Role).map((val) => (
                                <option key={val} value={val}>{t(`roles.${val.toLowerCase()}`)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-slate-800/50 text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-100 dark:border-slate-700">
                                <th className="px-6 py-4">{t('user_management.table.user')}</th>
                                <th className="px-6 py-4">{t('user_management.table.role_grade')}</th>
                                <th className="px-6 py-4">{t('user_management.table.status')}</th>
                                <th className="px-6 py-4">{t('user_management.table.registration_date')}</th>
                                <th className="px-6 py-4 text-right">{t('user_management.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4" colSpan={5}>
                                            <div className="h-12 bg-gray-200/50 rounded-lg w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredUsers?.length === 0 ? (
                                <tr>
                                    <td className="px-6 py-12 text-center text-gray-500 dark:text-slate-400" colSpan={5}>
                                        {t('user_management.no_users_found')}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers?.map((user) => (
                                    <tr key={user._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                                                    {user.firstName[0]}{user.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                                                    <p className="text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold inline-block w-fit ${RoleColors[user.role]}`}>
                                                    {t(`roles.${user.role.toLowerCase()}`)}
                                                </span>
                                                {user.grade && (
                                                    <span className="text-[10px] text-gray-400 font-medium ml-1">
                                                        Grade: {t(`roles.${user.grade.toLowerCase()}`, { defaultValue: user.grade })}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.isActive ? (
                                                <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                                                    <Check className="w-3 h-3" /> {t('user_management.status.approved')}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold">
                                                    <X className="w-3 h-3" /> {t('user_management.status.pending')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                                            {format(new Date(user.createdAt), 'dd MMMM yyyy', { locale: dateLocales[i18n.language] || fr })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Edit info button */}
                                                <button
                                                    onClick={() => setEditUserId(user._id)}
                                                    className="p-1.5 cursor-pointer text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors border border-primary-100 dark:border-primary-800/50"
                                                    title="Modifier les informations"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {!user.isActive && (
                                                    <button
                                                        onClick={() => approveMutation.mutate(user._id)}
                                                        className="p-1.5 cursor-pointer text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors border border-green-100 dark:border-green-800/50"
                                                        title={t('user_management.action.approve')}
                                                    >
                                                        <Check className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {user.isActive && user.role !== 'ADMIN' && (
                                                    <button
                                                        onClick={() => terminateMutation.mutate(user._id)}
                                                        className="p-1.5 cursor-pointer text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-red-100 dark:border-red-800/50"
                                                        title={t('user_management.action.revoke_access')}
                                                    >
                                                        <UserX className="w-5 h-5" />
                                                    </button>
                                                )}

                                                <div className="relative group">
                                                    <button className="p-2.5 cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all border border-transparent hover:border-gray-200 dark:hover:border-slate-700">
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-20 invisible group-hover:visible animate-in fade-in slide-in-from-top-2">
                                                        <p className="px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-50 dark:border-slate-700">{t('user_management.change_role')}</p>
                                                        {Object.values(Role).map((role) => (
                                                            <button
                                                                key={role}
                                                                onClick={() => changeRoleMutation.mutate({ id: user._id, role: role as Role })}
                                                                className="w-full cursor-pointer text-left px-4 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400 transition-colors first:rounded-t-none last:rounded-b-none"
                                                            >
                                                                {t(`roles.${role.toLowerCase()}`)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    refetch();
                }}
            />
            <EditUserModal
                userId={editUserId}
                isOpen={!!editUserId}
                onClose={() => setEditUserId(null)}
                onSuccess={() => {
                    setEditUserId(null);
                    queryClient.invalidateQueries({ queryKey: ['users'] });
                }}
            />
        </div>
    );
};

export default UserManagementPage;
