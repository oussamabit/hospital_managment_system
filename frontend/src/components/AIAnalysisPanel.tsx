/**
 * AIAnalysisPanel.tsx
 * مكون التحليل الطبي بالذكاء الاصطناعي
 * يُضاف داخل صفحة HospitalizationDetail أو PatientDetail
 */

import React, { useState } from 'react';
import {
  Brain, Loader2, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Activity, FileText,
  Sparkles, Clock, FlaskConical, Stethoscope,
  CircleAlert, TrendingUp,
} from 'lucide-react';
import {
  useAIAnalysis,
  useAIStream,
  useAIHealth,
  useAIIndex,
  DiagnosticSuggestion,
  AnalysisResult,
} from '../hooks/useAIAnalysis';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  patientId: string;
  hospitalizationId?: string;
  patientName?: string;
}

type AnalysisType = 'full' | 'summary' | 'diagnostics' | 'followup';
type Language    = 'fr' | 'ar' | 'en';

// ── Confidence badge ──────────────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ level: string }> = ({ level }) => {
  const map: Record<string, { cls: string; label: string }> = {
    'élevé': { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',    label: 'Elevé'  },
    'moyen': { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Moyen' },
    'faible':{ cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',   label: 'Faible' },
  };
  const conf = map[level] || map['moyen'];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${conf.cls}`}>
      {conf.label}
    </span>
  );
};

// ── AI Status indicator ───────────────────────────────────────────────────────

const AIStatusBadge: React.FC = () => {
  const { data: health, isLoading } = useAIHealth();

  if (isLoading) return (
    <span className="flex items-center gap-1 text-[10px] text-gray-400">
      <Loader2 className="w-3 h-3 animate-spin" /> Vérification...
    </span>
  );

  if (!health || !health.ollama_available) return (
    <span className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
      <CircleAlert className="w-3 h-3" /> IA hors ligne
    </span>
  );

  return (
    <span className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded-full">
      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
      {health.ollama_model} actif
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const AIAnalysisPanel: React.FC<Props> = ({
  patientId,
  hospitalizationId,
  patientName = 'Patient',
}) => {
  const [analysisType, setAnalysisType] = useState<AnalysisType>('full');
  const [language, setLanguage]         = useState<Language>('fr');
  const [useStream, setUseStream]       = useState(false);
  const [expanded, setExpanded]         = useState<string | null>('summary');

  // Hooks
  const { analyze, result, isLoading, error, reset } = useAIAnalysis();
  const { startStream, stopStream, streamText, isStreaming } = useAIStream();
  const indexMutation = useAIIndex();

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAnalyze = () => {
    reset();
    const req = {
      patient_id:         patientId,
      hospitalization_id: hospitalizationId,
      language,
      analysis_type:      analysisType,
    };

    if (useStream) {
      startStream(req);
    } else {
      analyze(req);
    }
  };

  const handleReIndex = () => {
    indexMutation.mutate({
      patient_id:         patientId,
      hospitalization_id: hospitalizationId,
      force_reindex:      true,
    });
  };

  const toggleSection = (id: string) =>
    setExpanded(prev => (prev === id ? null : id));

  // ── Styles ────────────────────────────────────────────────────────────────
  const cardCls  = 'card border border-gray-100 dark:border-slate-700 overflow-hidden';
  const btnPrimary = 'btn-primary py-2.5 px-5 text-sm flex items-center gap-2';
  const selectCls  = 'rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none';

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 border-b border-violet-100 dark:border-violet-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <Brain className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Analyse IA — {patientName}
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Modèle local — données non partagées
              </p>
            </div>
          </div>
          <AIStatusBadge />
        </div>

        {/* Controls */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Type d'analyse */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                Type d'analyse
              </label>
              <select
                className={selectCls + ' w-full'}
                value={analysisType}
                onChange={e => setAnalysisType(e.target.value as AnalysisType)}
              >
                <option value="full">Complet</option>
                <option value="summary">Résumé</option>
                <option value="diagnostics">Diagnostics</option>
                <option value="followup">Suivi</option>
              </select>
            </div>

            {/* Langue */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                Langue
              </label>
              <select
                className={selectCls + ' w-full'}
                value={language}
                onChange={e => setLanguage(e.target.value as Language)}
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Streaming toggle */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <div
                  onClick={() => setUseStream(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                    useStream ? 'bg-violet-500' : 'bg-gray-200 dark:bg-slate-600'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${useStream ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-300">Streaming</span>
              </label>
            </div>

            {/* Bouton analyser */}
            <div className="flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={isLoading || isStreaming}
                className={`${btnPrimary} w-full justify-center bg-violet-600 hover:bg-violet-700 disabled:opacity-40`}
              >
                {(isLoading || isStreaming)
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse...</>
                  : <><Brain className="w-4 h-4" /> Analyser</>
                }
              </button>
            </div>
          </div>

          {/* Actions secondaires */}
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={handleReIndex}
              disabled={indexMutation.isPending}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-600 transition"
            >
              {indexMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Re-indexer le dossier
            </button>
            {indexMutation.isSuccess && (
              <span className="text-[10px] text-teal-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Indexé
              </span>
            )}
            {isStreaming && (
              <button onClick={stopStream} className="text-xs text-red-500 hover:text-red-700 ml-auto">
                Arrêter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Erreur d'analyse</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
            <p className="text-xs text-gray-400 mt-1">
              Vérifiez que Ollama est actif: <code className="bg-gray-100 px-1 rounded">ollama serve</code>
            </p>
          </div>
        </div>
      )}

      {/* ── Streaming Output ───────────────────────────────────────────────── */}
      {(isStreaming || streamText) && (
        <div className={cardCls}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/10">
            <Activity className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
              Génération en cours...
            </span>
            {isStreaming && <div className="w-2 h-4 bg-violet-500 animate-pulse rounded ml-1" />}
          </div>
          <div className="p-5">
            <p
              className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            >
              {streamText}
              {isStreaming && <span className="animate-pulse">|</span>}
            </p>
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {result && !useStream && (
        <>
          {/* Metadata */}
          <div className="flex items-center gap-3 px-1">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" />
              {result.processing_time_seconds}s
            </span>
            <span className="text-[10px] text-gray-300">•</span>
            <span className="text-[10px] text-gray-400">{result.model_used}</span>
            <span className="text-[10px] text-gray-300">•</span>
            <span className="text-[10px] text-gray-400">{result.language}</span>
          </div>

          {/* Résumé */}
          <ResultSection
            id="summary"
            icon={<FileText className="w-4 h-4 text-blue-500" />}
            title="Résumé Médical"
            expanded={expanded === 'summary'}
            onToggle={() => toggleSection('summary')}
            color="blue"
          >
            <p
              className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            >
              {result.summary}
            </p>
          </ResultSection>

          {/* Points clés */}
          {result.key_findings.length > 0 && (
            <ResultSection
              id="findings"
              icon={<TrendingUp className="w-4 h-4 text-teal-500" />}
              title={`Points Clés (${result.key_findings.length})`}
              expanded={expanded === 'findings'}
              onToggle={() => toggleSection('findings')}
              color="teal"
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
          {result.diagnostic_suggestions.length > 0 && (
            <ResultSection
              id="diagnostics"
              icon={<Stethoscope className="w-4 h-4 text-violet-500" />}
              title={`Diagnostics Suggérés (${result.diagnostic_suggestions.length})`}
              expanded={expanded === 'diagnostics'}
              onToggle={() => toggleSection('diagnostics')}
              color="violet"
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
              Ces suggestions sont générées par IA à titre informatif uniquement.
              Elles ne remplacent pas le jugement clinique du médecin.
              Toute décision médicale doit être validée par un professionnel de santé qualifié.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ── ResultSection ─────────────────────────────────────────────────────────────

const ResultSection: React.FC<{
  id: string;
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  color: string;
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
      {expanded
        ? <ChevronUp className="w-4 h-4 text-gray-400" />
        : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
    {expanded && <div className="p-5">{children}</div>}
  </div>
);

// ── DiagnosticCard ────────────────────────────────────────────────────────────

const DiagnosticCard: React.FC<{ index: number; diag: DiagnosticSuggestion }> = ({ index, diag }) => (
  <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 space-y-2">
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
    {diag.recommended_tests.length > 0 && (
      <div className="pl-7 flex flex-wrap gap-1.5">
        {diag.recommended_tests.map((t, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-semibold rounded-full border border-blue-100 dark:border-blue-800/30">
            <FlaskConical className="w-2.5 h-2.5" />
            {t}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default AIAnalysisPanel;
