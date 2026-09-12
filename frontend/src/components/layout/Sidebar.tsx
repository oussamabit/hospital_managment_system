import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Users,
  FileText,
  User,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Stethoscope,
  ShieldCheck,
  Activity,
  Pill,
  ChevronRight,
  CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { RoleLabels } from '../../types';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { user, logout } = useAuth();
  const { isDoctor, isSecretaire, isAdmin } = usePermissions();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
    setLoggingOut(false);
  };

  const navGroups = [
    {
      label: 'Main',
      items: [
        { to: '/dashboard',    icon: LayoutDashboard, label: t('nav.dashboard'), always: true },
        { to: '/calendar',     icon: Calendar,        label: t('nav.calendar'),  always: true },
      ],
    },
    {
      label: 'Clinical',
      items: [
        { to: '/appointments', icon: ClipboardList,  label: t('nav.appointments'),                                      always: true },
        { to: '/planning',     icon: CalendarClock,   label: 'Planning de Garde',                                        always: true },
        { to: '/patients',     icon: Users,         label: t('nav.patients'),                                        always: true },
        { to: '/consultations',icon: FileText,      label: t('nav.consultations', { defaultValue: 'Consultations' }), show: !isSecretaire },
        { to: '/prescriptions',icon: Pill,          label: t('ordonnance.title', { defaultValue: 'Ordonnances' }),   show: !isSecretaire },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: '/admin/users',  icon: ShieldCheck, label: t('nav.users'),                                             show: isAdmin },
        { to: '/admin/logs',   icon: Activity,    label: t('nav.activity_logs', { defaultValue: "Journal d'activité" }), show: isAdmin },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: '/profile', icon: User, label: t('nav.profile'), always: true },
      ],
    },
  ];

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : '?';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30
          flex flex-col
          transition-all duration-300 ease-in-out
          bg-gradient-to-b from-medical-sidebar to-medical-sidebarDeep
          border-r border-white/5
          shadow-sidebar
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* ── Logo ── */}
        <div
          className={`
            flex items-center h-16 px-4 border-b border-white/8
            flex-shrink-0
            ${collapsed ? 'justify-center' : 'justify-between'}
          `}
        >
          {/* Brand mark */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-glow-blue">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight tracking-wide truncate">
                  MediCare Pro
                </p>
                <p className="text-medical-sidebarText/60 text-[10px] font-medium tracking-widest uppercase truncate">
                  HMS v2.0
                </p>
              </div>
            )}
          </div>

          {/* Collapse button (desktop) */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden md:flex btn-icon w-7 h-7 rounded-lg text-medical-sidebarText/50 hover:text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden btn-icon w-7 h-7 rounded-lg text-medical-sidebarText/50 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Expand button when collapsed (desktop) ── */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="hidden md:flex w-full items-center justify-center py-3 text-medical-sidebarText/50 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* ── User chip ── */}
        {!collapsed && user && (
          <div className="px-3 py-3 mx-2 mt-3 rounded-xl bg-white/5 border border-white/8 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="avatar avatar-sm flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-medical-sidebarText/70 text-[11px] mt-0.5 truncate">
                  {RoleLabels[user.role as keyof typeof RoleLabels]}
                </p>
              </div>
            </div>
          </div>
        )}
        {collapsed && user && (
          <div className="flex justify-center py-2 mt-2 flex-shrink-0">
            <div className="avatar avatar-sm" title={`${user.firstName} ${user.lastName}`}>
              {initials}
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => item.always || item.show
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                {/* Group label */}
                {!collapsed && (
                  <p className="px-3 mb-1 text-[10px] font-bold text-medical-sidebarText/40 uppercase tracking-widest">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `sidebar-nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
                      }
                    >
                      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                      {!collapsed && (
                        <span className="truncate text-[13px]">{item.label}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Logout ── */}
        <div className="px-2 py-3 border-t border-white/8 flex-shrink-0">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? t('nav.logout') : undefined}
            className={`
              sidebar-nav-item w-full
              text-red-400/70 hover:text-red-300
              hover:!bg-red-900/20
              ${collapsed ? 'justify-center px-0' : ''}
            `}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && (
              <span className="text-[13px] truncate">
                {loggingOut ? `${t('nav.logout')}...` : t('nav.logout')}
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
