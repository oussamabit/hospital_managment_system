/**
 * MedicalAIAnalysis.tsx
 * AI Analysis panel for PatientDetail — supports all hospitalizations or a specific one.
 * Shows a conversation-style interface where the doctor can ask questions.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Brain, Loader2, Send, ChevronDown, AlertTriangle,
  CheckCircle, Sparkles, Clock, Stethoscope, FileText,
  TrendingUp, FlaskConical, CircleAlert, RefreshCw,
  MessageSquare, Hospital, X,
} from 'lucide-react';
import { useAIAnalysis, useAIHealth, DiagnosticSuggestion } from '../hooks/useAIAnalysis';

// ── Types ──────────────────────────────────────────────────────────────────────

interface HospitalizationSummary {
  _id: string;
  dateEntree?: string;
  dateSortie?: string;
  motifAdmission?: string;
  diagnostic?: string;
}

interface Props {
  patientId: string;
  patientName: string;
  hospitalizations: HospitalizationSummary[];
}

type AnalysisType = 'full' | 'summary' | 'diagnostics' | 'followup';
type Language    = 'fr' | 'ar' | 'en';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fdate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── AI Status badge ───────────────────────────────────────────────────────────

const AIStatusBadge: React.FC = () => {
  const { data: health, isLoading } = useAIHealth();
  if (isLoading) return (
    <span className="flex items-center gap-1 text-[10px] text-gray-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Vérification...
    </span>
  );
  if (!health?.ollama_available) return (
    <span className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
      <CircleAlert className="w-3 h-3" /> IA hors ligne
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded-full">
      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
      {health.ollama_model} · local
    </span>
  );
};

// ── Confidence badge ──────────────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ level: string }> = ({ level }) => {
  const map: Record<string, { cls: string; label: string }> = {
    'élevé':  { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       label: 'Elevé'  },
    'high':   { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       label: 'Elevé'  },
    'moyen':  { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Moyen' },
    'medium': { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Moyen' },
    'faible': { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',       label: 'Faible' },
    'low':    { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',       label: 'Faible' },
  };
  const conf = map[level?.toLowerCase()] || map['moyen'];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${conf.cls}`}>
      {conf.label}
    </span>
  );
};

// ── Diagnostic Card ───────────────────────────────────────────────────────────

const DiagnosticCard: React.FC<{ index: number; diag: DiagnosticSuggestion }> = ({ index, diag }) => (
  <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 space-y-1.5">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index}
        </span>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{diag.condition}</p>
      </div>
      <ConfidenceBadge level={diag.confidence} />
    </div>
    <p className="text-xs text-gray-600 dark:text-gray-400 pl-7">{diag.reasoning}</p>
    {diag.recommended_tests?.length > 0 && (
      <div className="pl-7 flex flex-wrap gap-1">
        {diag.recommended_tests.map((t, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-semibold rounded-full border border-blue-100 dark:border-blue-800/30">
            <FlaskConical className="w-2.5 h-2.5" /> {t}
          </span>
        ))}
      </div>
    )}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const MedicalAIAnalysis: React.FC<Props> = ({ patientId, patientName, hospitalizations }) => {
  const [selectedHospId, setSelectedHospId] = useState<string | 'all'>('all');
  const [analysisType, setAnalysisType]     = useState<AnalysisType>('full');
  const [language, setLanguage]             = useState<Language>('fr');
  const [expanded, setExpanded]             = useState<string | null>('summary');
  const [showSelector, setShowSelector]     = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  const { analyze, result, isLoading, error, reset } = useAIAnalysis();

  // Close selector on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setShowSelector(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleAnalyze = () => {
    reset();
    analyze({
      patient_id:         patientId,
      hospitalization_id: selectedHospId === 'all' ? undefined : selectedHospId,
      language,
      analysis_type:      analysisType,
    });
  };

  const selectedLabel = () => {
    if (selectedHospId === 'all') return `Toutes les hospitalisations (${hospitalizations.length})`;
    const h = hospitalizations.find(h => h._id === selectedHospId);
    if (!h) return '—';
    return `${fdate(h.dateEntree)} — ${h.motifAdmission || h.diagnostic || 'Hospitalisation'}`;
  };

  const toggle = (id: string) => setExpanded(p => p === id ? null : id);

  const selectCls = 'rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 outline-none';

  if (hospitalizations.length === 0) {
    return (
      <div className="card p-6 text-center border border-dashed border-gray-200 dark:border-slate-700">
        <Brain className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucune hospitalisation — l'analyse IA nécessite au moins un dossier.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <div className="card border border-violet-100 dark:border-violet-800/30 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 border-b border-violet-100 dark:border-violet-800/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <Brain className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Analyse Médicale IA
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {patientName} · Modèle local — données non partagées
              </p>
            </div>
          </div>
          <AIStatusBadge />
        </div>

        <div className="p-5 space-y-4">

          {/* Hospitalization selector */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">
              Dossier à analyser
            </label>
            <div className="relative" ref={selectorRef}>
              <button
                onClick={() => setShowSelector(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm hover:border-violet-300 transition text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {selectedHospId === 'all'
                    ? <><Hospital className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" /><span className="font-semibold text-violet-700 dark:text-violet-400 truncate">{selectedLabel()}</span></>
                    : <><FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /><span className="text-gray-700 dark:text-gray-300 truncate">{selectedLabel()}</span></>
                  }
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${showSelector ? 'rotate-180' : ''}`} />
              </button>

              {showSelector && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
                  {/* "All" option */}
                  <button
                    onClick={() => { setSelectedHospId('all'); setShowSelector(false); reset(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition text-left border-b border-gray-100 dark:border-slate-700 ${selectedHospId === 'all' ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}
                  >
                    <Hospital className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-violet-700 dark:text-violet-400">Toutes les hospitalisations</p>
                      <p className="text-[10px] text-gray-400">{hospitalizations.length} dossier(s) — analyse consolidée</p>
                    </div>
                    {selectedHospId === 'all' && <CheckCircle className="w-4 h-4 text-violet-500 ml-auto" />}
                  </button>

                  {/* Individual hospitalizations */}
                  <div className="max-h-52 overflow-y-auto">
                    {hospitalizations.map((h, i) => (
                      <button
                        key={h._id}
                        onClick={() => { setSelectedHospId(h._id); setShowSelector(false); reset(); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-slate-700/50 transition text-left ${selectedHospId === h._id ? 'bg-gray-50 dark:bg-slate-700/50' : ''}`}
                      >
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                            {h.motifAdmission || h.diagnostic || `Hospitalisation ${i + 1}`}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {fdate(h.dateEntree)}{h.dateSortie ? ` → ${fdate(h.dateSortie)}` : ' (en cours)'}
                          </p>
                        </div>
                        {selectedHospId === h._id && <CheckCircle className="w-4 h-4 text-teal-500 ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Type</label>
              <select className={selectCls + ' w-full'} value={analysisType} onChange={e => setAnalysisType(e.target.value as AnalysisType)}>
                <option value="full">Complet</option>
                <option value="summary">Résumé</option>
                <option value="diagnostics">Diagnostics</option>
                <option value="followup">Suivi</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Langue</label>
              <select className={selectCls + ' w-full'} value={language} onChange={e => setLanguage(e.target.value as Language)}>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex items-end col-span-2 sm:col-span-1">
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold transition"
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...</>
                  : <><Brain className="w-4 h-4" /> Analyser</>
                }
              </button>
            </div>
          </div>

          {/* Info about "all" mode */}
          {selectedHospId === 'all' && hospitalizations.length > 1 && (
            <div className="flex items-start gap-2 p-3 bg-violet-50 dark:bg-violet-900/10 rounded-xl border border-violet-100 dark:border-violet-800/20">
              <MessageSquare className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-violet-700 dark:text-violet-400 leading-relaxed">
                Mode <strong>toutes les hospitalisations</strong> — l'IA analysera le dernier dossier en priorité et synthétisera l'historique complet du patient.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Erreur d'analyse</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
            <p className="text-xs text-gray-400 mt-1">
              Vérifiez que Ollama est actif : <code className="bg-gray-100 px-1 rounded">ollama serve</code>
            </p>
          </div>
        </div>
      )}

      {/* ── Loading state ───────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="card p-6 flex flex-col items-center gap-3">
          <div className="relative">
            <Brain className="w-8 h-8 text-violet-300" />
            <Loader2 className="w-4 h-4 text-violet-600 animate-spin absolute -bottom-1 -right-1" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Mistral analyse le dossier...</p>
          <p className="text-xs text-gray-400">Peut prendre jusqu'à 2 minutes sur CPU</p>
          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {result && !isLoading && (
        <>
          {/* Meta */}
          <div className="flex items-center gap-3 px-1 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" /> {result.processing_time_seconds}s
            </span>
            <span className="text-[10px] text-gray-300">•</span>
            <span className="text-[10px] text-gray-400">{result.model_used}</span>
            <span className="text-[10px] text-gray-300">•</span>
            <span className="text-[10px] text-gray-400">
              {selectedHospId === 'all' ? 'Analyse globale' : 'Hospitalisation spécifique'}
            </span>
            <button onClick={() => { reset(); }} className="ml-auto flex items-center gap-1 text-[10px] text-gray-400 hover:text-violet-600 transition">
              <RefreshCw className="w-3 h-3" /> Réinitialiser
            </button>
          </div>

          {/* Summary */}
          {result.summary && (
            <ResultSection
              id="summary" expanded={expanded === 'summary'} onToggle={() => toggle('summary')}
              icon={<FileText className="w-4 h-4 text-blue-500" />}
              title="Résumé Médical" color="blue"
            >
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                {result.summary}
              </p>
            </ResultSection>
          )}

          {/* Key findings */}
          {result.key_findings?.length > 0 && (
            <ResultSection
              id="findings" expanded={expanded === 'findings'} onToggle={() => toggle('findings')}
              icon={<TrendingUp className="w-4 h-4 text-teal-500" />}
              title={`Points Clés (${result.key_findings.length})`} color="teal"
            >
              <ul className="space-y-2">
                {result.key_findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {/* Diagnostics */}
          {result.diagnostic_suggestions?.length > 0 && (
            <ResultSection
              id="diagnostics" expanded={expanded === 'diagnostics'} onToggle={() => toggle('diagnostics')}
              icon={<Stethoscope className="w-4 h-4 text-violet-500" />}
              title={`Diagnostics Suggérés (${result.diagnostic_suggestions.length})`} color="violet"
            >
              <div className="space-y-3">
                {result.diagnostic_suggestions.map((d, i) => (
                  <DiagnosticCard key={i} index={i + 1} diag={d} />
                ))}
              </div>
            </ResultSection>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Suggestions générées par IA à titre informatif uniquement.
              Ne remplacent pas le jugement clinique. Toute décision médicale doit être validée par un professionnel qualifié.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ── ResultSection ─────────────────────────────────────────────────────────────

const ResultSection: React.FC<{
  id: string; icon: React.ReactNode; title: string;
  expanded: boolean; onToggle: () => void; color: string;
  children: React.ReactNode;
}> = ({ icon, title, expanded, onToggle, color, children }) => (
  <div className={`card border border-${color}-100 dark:border-${color}-800/30 overflow-hidden`}>
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-5 py-3 bg-${color}-50 dark:bg-${color}-900/10 hover:bg-${color}-100 dark:hover:bg-${color}-900/20 transition`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className={`text-sm font-bold text-${color}-700 dark:text-${color}-400`}>{title}</span>
      </div>
      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
    {expanded && <div className="p-5">{children}</div>}
  </div>
);

export default MedicalAIAnalysis;
