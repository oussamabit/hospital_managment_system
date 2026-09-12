import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  LayoutGrid,
  Columns
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  Locale,
} from 'date-fns';
import { ar, fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { rdvApi } from '../services/api';
import { RendezVous, RdvStatus, RdvStatusColors, RdvStatusLabels, Patient, User } from '../types';

// Updated specific colors for premium look
const STATUS_INDICATOR_COLORS: Record<RdvStatus, string> = {
  PLANIFIE: 'border-blue-500',
  CONFIRME: 'border-emerald-500',
  EN_COURS: 'border-amber-500',
  TERMINE: 'border-indigo-500',
  ANNULE: 'border-rose-500',
  ABSENT: 'border-slate-500',
};

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const locales: Record<string, Locale> = { fr, ar, en: enUS };
  const currentLocale = locales[i18n.language.substring(0, 2)] || enUS;

  const dateFrom = useMemo(() => {
    const start = view === 'month'
      ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      : startOfWeek(currentDate, { weekStartsOn: 1 });
    return format(start, 'yyyy-MM-dd');
  }, [currentDate, view]);

  const dateTo = useMemo(() => {
    const end = view === 'month'
      ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
      : endOfWeek(currentDate, { weekStartsOn: 1 });
    return format(end, 'yyyy-MM-dd');
  }, [currentDate, view]);

  const { data } = useQuery({
    queryKey: ['rdvs-calendar', dateFrom, dateTo],
    queryFn: () => rdvApi.getAll({ dateFrom, dateTo, limit: 1000 }).then(res => res.data.rdvs as RendezVous[]),
  });

  const rdvs = data || [];

  const navigatePeriod = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => {
      if (view === 'month') {
        return dir === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      }
      return dir === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1);
    });
  };

  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  });

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: endOfWeek(currentDate, { weekStartsOn: 1 }),
  });

  const weekHours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

  const getRdvsForDay = (day: Date) => rdvs.filter(rdv => isSameDay(new Date(rdv.dateTime), day));

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/40 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary-600 p-3 rounded-2xl shadow-lg shadow-primary-200">
            <CalendarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: currentLocale })}
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {rdvs.length} {t('dashboard.total_rdv', 'rendez-vous au total')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-100/80 p-1 rounded-2xl border border-gray-200">
            <button
              onClick={() => setView('month')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'month' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <LayoutGrid className="w-4 h-4" /> {t('calendar.month')}
            </button>
            <button
              onClick={() => setView('week')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'week' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Columns className="w-4 h-4" /> {t('calendar.week')}
            </button>
          </div>

          <div className="flex items-center bg-gray-100/80 p-1 rounded-2xl border border-gray-200">
            <button onClick={() => navigatePeriod('prev')} className="p-2 hover:bg-white rounded-xl transition-all">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-1 text-sm font-bold text-gray-700 hover:text-primary-600 transition-colors"
            >
              {t('dashboard.today_rdv')}
            </button>
            <button onClick={() => navigatePeriod('next')} className="p-2 hover:bg-white rounded-xl transition-all">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Calendar Card */}
        <div className="xl:col-span-3 bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden min-h-[700px]">
          {view === 'month' ? (
            <div className="flex flex-col h-full">
              {/* Day names */}
              <div className="grid grid-cols-7 border-b border-gray-50">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, i) => (
                  <div key={i} className="py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEEEEE', { locale: currentLocale })}
                  </div>
                ))}
              </div>
              {/* Grid */}
              <div className="grid grid-cols-7 flex-1">
                {monthDays.map((day, i) => {
                  const dayRdvs = getRdvsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isTodayDay = isToday(day);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-[120px] p-2 border-b border-r border-gray-50 group cursor-pointer transition-all relative
                        ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white'}
                        ${isSelected ? 'bg-primary-50/50' : 'hover:bg-primary-50/20'}
                        ${i % 7 === 6 ? 'border-r-0' : ''}
                      `}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`
                          w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold transition-all
                          ${isTodayDay ? 'bg-primary-600 text-white shadow-md shadow-primary-200 scale-110' : 'text-gray-500 group-hover:text-primary-600'}
                          ${!isCurrentMonth ? 'opacity-30' : ''}
                        `}>
                          {format(day, 'd')}
                        </span>
                        {dayRdvs.length > 0 && isCurrentMonth && (
                          <span className="text-[10px] font-bold text-primary-500 bg-primary-100 px-1.5 py-0.5 rounded-md">
                            {dayRdvs.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        {dayRdvs.slice(0, 3).map((rdv) => (
                          <div
                            key={rdv._id}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold truncate transition-all hover:brightness-95 active:scale-95 border-l-2 ${STATUS_INDICATOR_COLORS[rdv.status]} ${RdvStatusColors[rdv.status]}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/appointments/${rdv._id}`);
                            }}
                          >
                            {format(new Date(rdv.dateTime), 'HH:mm')} {(rdv.patient as Patient)?.lastName}
                          </div>
                        ))}
                        {dayRdvs.length > 3 && (
                          <p className="text-[9px] text-gray-400 font-bold mt-1 text-center">
                            +{dayRdvs.length - 3} {t('calendar.others')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Week Header */}
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-100">
                    <div className="p-4" />
                    {weekDays.map((day) => (
                      <div key={day.toISOString()} className={`py-4 text-center border-l border-gray-50 ${isToday(day) ? 'bg-primary-50/30' : ''}`}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-2">
                          {format(day, 'EEE', { locale: currentLocale })}
                        </p>
                        <p className={`text-xl font-black ${isToday(day) ? 'text-primary-600' : 'text-gray-800'}`}>
                          {format(day, 'd')}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Timeline */}
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] relative h-[600px] overflow-y-auto scrollbar-hide">
                    <div className="flex flex-col">
                      {weekHours.map(hour => (
                        <div key={hour} className="h-20 border-b border-gray-50 px-2 py-1 text-right text-[10px] font-bold text-gray-400 uppercase">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>
                    {weekDays.map(day => (
                      <div key={day.toISOString()} className="h-full border-l border-gray-50 relative group">
                        {weekHours.map(hour => (
                          <div key={hour} className="h-20 border-b border-gray-50/50 hover:bg-gray-50/50 transition-colors" />
                        ))}
                        {/* Render Appointments Absolute */}
                        {getRdvsForDay(day).map(rdv => {
                          const date = new Date(rdv.dateTime);
                          const hour = date.getHours();
                          const minutes = date.getMinutes();
                          const top = (hour - 8) * 80 + (minutes / 60) * 80;
                          const height = Math.max((rdv.duration || 30) * (80 / 60), 30);

                          return (
                            <div
                              key={rdv._id}
                              onClick={() => navigate(`/appointments/${rdv._id}`)}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                zIndex: 10
                              }}
                              className={`absolute left-1 right-1 px-2 py-1.5 rounded-xl border shadow-sm cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden ${RdvStatusColors[rdv.status]}`}
                            >
                              <div className={`absolute top-0 left-0 bottom-0 w-1 ${STATUS_INDICATOR_COLORS[rdv.status].replace('border-', 'bg-')}`} />
                              <div className="flex flex-col h-full justify-between">
                                <div>
                                  <p className="text-[10px] font-black leading-tight flex items-center gap-1">
                                    <Clock className="w-2 h-2" />
                                    {format(date, 'HH:mm')}
                                  </p>
                                  <p className="text-[11px] font-bold truncate mt-0.5">
                                    {(rdv.patient as Patient)?.firstName} {(rdv.patient as Patient)?.lastName}
                                  </p>
                                </div>
                                <p className="text-[9px] font-medium opacity-70 truncate">
                                  {rdv.motif}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Panel */}
        <div className="space-y-6">
          <div className="bg-white/60 backdrop-blur-xl p-6 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-white/60">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              {selectedDay ? format(selectedDay, 'd MMMM', { locale: currentLocale }) : 'Séléctionnez un jour'}
            </h2>

            <div className="space-y-4">
              {selectedDay && getRdvsForDay(selectedDay).length > 0 ? (
                getRdvsForDay(selectedDay).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(rdv => (
                  <div
                    key={rdv._id}
                    onClick={() => navigate(`/appointments/${rdv._id}`)}
                    className="group bg-white hover:bg-primary-50/50 p-4 rounded-2xl border border-gray-100 hover:border-primary-200 transition-all cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-black text-primary-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(rdv.dateTime), 'HH:mm')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${RdvStatusColors[rdv.status]}`}>
                        {RdvStatusLabels[rdv.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-primary-600 transition-all">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {(rdv.patient as Patient)?.firstName} {(rdv.patient as Patient)?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 font-medium truncate">
                          {rdv.motif}
                        </p>
                      </div>
                    </div>
                    {rdv.medecin && (
                      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase">
                        <UserIcon className="w-3 h-3" />
                        Dr. {(rdv.medecin as User).lastName || 'Doctor'}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                    <CalendarIcon className="w-8 h-8 text-gray-200" />
                  </div>
                  <p className="text-gray-400 font-bold text-sm tracking-tight text-center">
                    {t('calendar.no_rdv_this_day', 'Aucun rendez-vous prévu')}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
