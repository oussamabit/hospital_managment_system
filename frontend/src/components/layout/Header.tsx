import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Moon, Sun, Globe, Menu, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  setMobileOpen: (open: boolean) => void;
}

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':        'nav.dashboard',
  '/calendar':         'nav.calendar',
  '/appointments':     'nav.appointments',
  '/appointments/new': 'nav.new_rdv',
  '/patients':         'nav.patients',
  '/patients/new':     'nav.new_patient',
  '/consultations':    'nav.consultations',
  '/prescriptions':    'ordonnance.title',
  '/profile':          'nav.profile',
  '/admin/users':      'nav.users',
  '/admin/logs':       'nav.activity_logs',
};

const LANGS = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'ar', label: 'العربية',  flag: '🇩🇿' },
];

const Header: React.FC<HeaderProps> = ({ setMobileOpen }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen,  setLangOpen]  = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const langRef  = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (langRef.current  && !langRef.current.contains(e.target as Node))  setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getTitle = () => {
    const path = location.pathname;
    // Exact match first
    const key = ROUTE_TITLES[path];
    if (key) return t(key, path.replace('/', ''));
    // Dynamic routes
    if (path.startsWith('/patients/') && path !== '/patients/new') return t('nav.patient_file', 'Fiche Patient');
    if (path.startsWith('/appointments/'))  return t('nav.rdv_detail', 'Détail RDV');
    if (path.startsWith('/consultations/')) return t('nav.consultation', 'Consultation');
    return 'Hospital RDV';
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('header.greeting_morning', 'Bonjour');
    if (h < 18) return t('header.greeting_afternoon', 'Bon après-midi');
    return t('header.greeting_evening', 'Bonsoir');
  };

  const currentLang = LANGS.find((l) => i18n.language.startsWith(l.code)) || LANGS[0];

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm flex-shrink-0">
      {/* ── Left ── */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden btn-icon"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb / Title */}
        <div>
          <h1 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight">
            {getTitle()}
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block leading-tight mt-0.5">
            {getGreeting()}, <span className="font-semibold text-slate-600 dark:text-slate-300">{user?.firstName}</span>
          </p>
        </div>
      </div>

      {/* ── Right Controls ── */}
      <div className="flex items-center gap-1">

        {/* Language Selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => { setLangOpen(!langOpen); setNotifOpen(false); }}
            className="btn-icon gap-1.5 px-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline uppercase tracking-wider">{currentLang.code}</span>
            <ChevronDown className="w-3 h-3 hidden sm:block" />
          </button>

          {langOpen && (
            <div className="absolute right-0 top-12 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-modal py-1.5 z-50 animate-slide-up overflow-hidden">
              {LANGS.map((lang) => {
                const active = i18n.language.startsWith(lang.code);
                return (
                  <button
                    key={lang.code}
                    onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      active
                        ? 'font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.label}</span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn-icon rounded-xl"
          title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
        >
          {theme === 'light'
            ? <Moon className="w-4.5 h-4.5 text-slate-500" />
            : <Sun className="w-4.5 h-4.5 text-amber-400" />
          }
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setLangOpen(false); }}
            className="btn-icon rounded-xl relative"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
            {/* Unread dot */}
            <span className="absolute top-2 right-2 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-modal z-50 animate-slide-up overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('header.notifications', 'Notifications')}
                </p>
                <span className="badge badge-blue">0 nouveau</span>
              </div>
              <div className="empty-state py-12">
                <div className="empty-state-icon w-12 h-12 rounded-xl">
                  <Bell className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {t('header.no_notifications', 'Aucune notification')}
                </p>
                <p className="text-xs text-slate-400 mt-1">Vous êtes à jour !</p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* User Avatar */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
        >
          <div className="avatar avatar-sm shadow-sm">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-400 hidden lg:block group-hover:text-slate-600 transition-colors" />
        </button>
      </div>
    </header>
  );
};

export default Header;
