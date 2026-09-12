import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, Stethoscope, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';

const FloatingActionMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canCreateRdv, isDoctor, isAdmin } = usePermissions();

  if (!canCreateRdv()) return null;

  const actions = [
    {
      label: t('dashboard.new_rdv', 'Nouveau RDV'),
      icon: Calendar,
      onClick: () => { navigate('/appointments/new'); setIsOpen(false); },
      bg: 'bg-primary-600 hover:bg-primary-700',
    },
    {
      label: t('dashboard.new_patient', 'Nouveau patient'),
      icon: Users,
      onClick: () => { navigate('/patients/new'); setIsOpen(false); },
      bg: 'bg-cyan-600 hover:bg-cyan-700',
    },
    ...(isDoctor || isAdmin ? [{
      label: 'Nouvelle consultation',
      icon: Stethoscope,
      onClick: () => { navigate('/consultations/new'); setIsOpen(false); },
      bg: 'bg-indigo-600 hover:bg-indigo-700',
    }] : []),
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 no-print">

      {/* Action items */}
      <div
        className={`flex flex-col items-end gap-2.5 transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {actions.map((action, idx) => (
          <div key={idx} className="flex items-center gap-3 group">
            {/* Label tooltip */}
            <span className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-card border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {action.label}
            </span>
            {/* Button */}
            <button
              onClick={action.onClick}
              className={`${action.bg} text-white w-12 h-12 rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center`}
            >
              <action.icon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-14 h-14 rounded-2xl flex items-center justify-center
          text-white shadow-lg transition-all duration-300
          ${isOpen
            ? 'bg-slate-700 dark:bg-slate-600 rotate-45 scale-95'
            : 'bg-gradient-to-br from-primary-600 to-cyan-600 hover:shadow-xl hover:scale-105 active:scale-95'
          }
        `}
        aria-label={isOpen ? 'Fermer' : 'Actions rapides'}
      >
        {isOpen
          ? <X className="w-6 h-6" />
          : <Plus className="w-6 h-6" strokeWidth={2.5} />
        }
      </button>
    </div>
  );
};

export default FloatingActionMenu;
