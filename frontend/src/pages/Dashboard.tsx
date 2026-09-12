import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Users,
  TrendingUp,
  ChevronRight,
  Activity,
  FileText,
  Plus,
  ArrowUpRight,
  Stethoscope,
} from 'lucide-react';
import { rdvApi, userApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { RendezVous, RdvStatusColors, Patient, User } from '../types';
import { format } from 'date-fns';
import { fr, enUS, arSA } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const dateLocales: Record<string, any> = { fr, en: enUS, ar: arSA };

/* ── Skeleton loader ── */
const SkeletonCard: React.FC = () => (
  <div className="stat-card">
    <div className="skeleton w-12 h-12 rounded-2xl flex-shrink-0" />
    <div className="space-y-2 flex-1">
      <div className="skeleton h-3 w-24 rounded" />
      <div className="skeleton h-6 w-12 rounded" />
      <div className="skeleton h-2.5 w-20 rounded" />
    </div>
  </div>
);

/* ── Stat card ── */
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  subtitle?: string;
  delta?: string;
  onClick?: () => void;
  highlight?: boolean;
}
const StatCard: React.FC<StatCardProps> = ({
  title, value, icon, iconBg, subtitle, delta, onClick, highlight
}) => (
  <div
    className={`stat-card group ${onClick ? 'cursor-pointer' : ''} ${
      highlight
        ? 'border-warning-300 bg-warning-50 dark:bg-warning-900/10 dark:border-warning-700/50 hover:border-warning-400'
        : 'hover:border-slate-300 dark:hover:border-slate-700'
    }`}
    onClick={onClick}
  >
    <div className={`stat-icon ${iconBg}`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
        {title}
      </p>
      <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 leading-none">
        {value}
      </p>
      {subtitle && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">{subtitle}</p>
      )}
    </div>
    {delta && (
      <span className="badge badge-green text-[10px] flex-shrink-0">
        <TrendingUp className="w-2.5 h-2.5" />
        {delta}
      </span>
    )}
    {onClick && (
      <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
    )}
  </div>
);

/* ── Status badge mapping ── */
const STATUS_BADGE: Record<string, string> = {
  PLANIFIE: 'badge badge-blue',
  CONFIRME: 'badge badge-cyan',
  EN_COURS: 'badge badge-amber',
  TERMINE:  'badge badge-green',
  ANNULE:   'badge badge-red',
  ABSENT:   'badge badge-slate',
};
const STATUS_LABEL: Record<string, string> = {
  PLANIFIE: 'Planifié',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  TERMINE:  'Terminé',
  ANNULE:   'Annulé',
  ABSENT:   'Absent',
};

/* ── Quick action ── */
const QuickAction: React.FC<{
  label: string;
  icon: React.ReactNode;
  gradient: string;
  onClick: () => void;
}> = ({ label, icon, gradient, onClick }) => (
  <button
    onClick={onClick}
    className={`quick-action w-full ${gradient}`}
  >
    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <span className="text-left leading-tight">{label}</span>
  </button>
);

/* ════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ════════════════════════════════════════════════════════════ */
const Dashboard: React.FC = () => {
  const { user }   = useAuth();
  const { isAdmin } = usePermissions();
  const navigate   = useNavigate();
  const { t, i18n } = useTranslation();
  const locale     = dateLocales[i18n.language.substring(0, 2)] || fr;

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => rdvApi.getStats().then((r) => r.data.stats),
    refetchInterval: 30_000,
  });

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['today-rdv'],
    queryFn: () => rdvApi.getToday().then((r) => r.data.rdvs),
    refetchInterval: 30_000,
  });

  const { data: pendingUsersData } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => userApi.getPending().then((r) => r.data.users),
    enabled: !!isAdmin,
    refetchInterval: 60_000,
  });

  const stats = statsData ?? {
    todayTotal: 0,
    todayInProgress: 0,
    todayCompleted: 0,
    todayPlanned: 0,
    totalPatients: 0,
  };
  const todayRdvs: RendezVous[] = todayData ?? [];
  const pendingCount = pendingUsersData?.length ?? 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-600 to-cyan-600 p-6 md:p-8 text-white shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-white/5" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm font-medium capitalize mb-1">{today}</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              {greeting()}, {user?.firstName} 
            </h2>
            <p className="text-white/70 mt-2 text-sm">
              {stats.todayTotal} rendez-vous aujourd'hui · {stats.todayCompleted} terminés
            </p>
          </div>

          <div className="hidden sm:flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl text-sm">
              <Activity className="w-4 h-4 text-cyan-200" />
              <span className="text-white font-medium">Système opérationnel</span>
            </div>
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-300" />
              <span className="text-white font-medium">{stats.todayCompleted} consultations</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title={t('dashboard.today_rdv', "RDV d'aujourd'hui")}
              value={stats.todayTotal}
              icon={<Calendar className="w-5 h-5 text-primary-600" />}
              iconBg="bg-primary-50 dark:bg-primary-900/30"
              subtitle="Total du jour"
            />
            <StatCard
              title={t('dashboard.in_progress', 'En cours')}
              value={stats.todayInProgress}
              icon={<Clock className="w-5 h-5 text-warning-600" />}
              iconBg="bg-warning-50 dark:bg-warning-900/30"
              subtitle="Consultations actives"
            />
            <StatCard
              title={t('dashboard.completed', 'Terminés')}
              value={stats.todayCompleted}
              icon={<CheckCircle2 className="w-5 h-5 text-success-600" />}
              iconBg="bg-success-50 dark:bg-success-900/30"
              subtitle="Consultations complètes"
            />
            <StatCard
              title={t('dashboard.total_patients', 'Total Patients')}
              value={stats.totalPatients}
              icon={<Users className="w-5 h-5 text-cyan-600" />}
              iconBg="bg-cyan-50 dark:bg-cyan-900/30"
              subtitle="Dans le système"
            />
            {isAdmin && pendingCount > 0 && (
              <StatCard
                title="Demandes en attente"
                value={pendingCount}
                icon={<Users className="w-5 h-5 text-warning-600" />}
                iconBg="bg-warning-100 dark:bg-warning-900/30"
                subtitle="Cliquez pour valider"
                onClick={() => navigate('/admin/users')}
                highlight
              />
            )}
          </>
        )}
      </div>

      {/* ── Main Grid (Appointments + Quick Actions) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's appointments */}
        <div className="lg:col-span-2 card-flat overflow-hidden">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="section-title">
                {t('dashboard.today_rdv_list', "Rendez-vous du jour")}
              </h3>
            </div>
            <button
              onClick={() => navigate('/appointments')}
              className="text-primary-600 dark:text-primary-400 text-xs font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List */}
          {todayLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="skeleton w-14 h-14 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-40 rounded" />
                    <div className="skeleton h-2.5 w-28 rounded" />
                  </div>
                  <div className="skeleton h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : todayRdvs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Calendar className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {t('dashboard.no_rdv_today', 'Aucun rendez-vous aujourd\'hui')}
              </p>
              <p className="text-xs text-slate-400 mt-1">Profitez de cette journée libre !</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {todayRdvs.slice(0, 8).map((rdv) => {
                const patient = rdv.patient as Patient;
                const medecin = rdv.medecin as User;
                return (
                  <div
                    key={rdv._id}
                    onClick={() => navigate(`/appointments/${rdv._id}`)}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    {/* Time */}
                    <div className="text-center w-14 flex-shrink-0">
                      <p className="text-base font-black text-primary-600 dark:text-primary-400 leading-none">
                        {format(new Date(rdv.dateTime), 'HH:mm')}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{rdv.duration}min</p>
                    </div>

                    {/* Vertical line */}
                    <div className="w-px h-10 bg-slate-100 dark:bg-slate-800 flex-shrink-0" />

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {patient?.firstName} {patient?.lastName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {rdv.motif}
                      </p>
                      {medecin && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Dr. {medecin.firstName} {medecin.lastName}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <span className={STATUS_BADGE[rdv.status] || 'badge badge-slate'}>
                      {STATUS_LABEL[rdv.status] || rdv.status}
                    </span>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick actions sidebar */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-4">Actions rapides</h3>
            <div className="space-y-2.5">
              <QuickAction
                label="Nouveau rendez-vous"
                icon={<Calendar className="w-5 h-5 text-white" />}
                gradient="bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600"
                onClick={() => navigate('/appointments/new')}
              />
              <QuickAction
                label="Nouveau patient"
                icon={<Users className="w-5 h-5 text-white" />}
                gradient="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600"
                onClick={() => navigate('/patients/new')}
              />
              <QuickAction
                label="Nouvelle consultation"
                icon={<Stethoscope className="w-5 h-5 text-white" />}
                gradient="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600"
                onClick={() => navigate('/consultations/new')}
              />
              <QuickAction
                label="Voir le calendrier"
                icon={<TrendingUp className="w-5 h-5 text-white" />}
                gradient="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600"
                onClick={() => navigate('/calendar')}
              />
            </div>
          </div>

          {/* Today's summary mini card */}
          <div className="card bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Résumé du jour
            </h4>
            <div className="space-y-2.5">
              {[
                { label: 'Planifiés',   val: stats.todayPlanned,    color: 'bg-primary-500' },
                { label: 'En cours',    val: stats.todayInProgress, color: 'bg-warning-500' },
                { label: 'Terminés',    val: stats.todayCompleted,  color: 'bg-success-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`status-dot ${item.color}`} />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
