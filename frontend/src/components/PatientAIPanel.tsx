/**
 * PatientAIPanel.tsx
 * AI Medical Assistant on the Patient page.
 * Lets the doctor chat with the AI about ALL hospitalizations
 * or a specific one — without opening each dossier individually.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Brain, Send, Loader2, Sparkles, CircleAlert,
  ChevronDown, AlertTriangle, Bed, RefreshCw,
} from 'lucide-react';
import { useAIHealth } from '../hooks/useAIAnalysis';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Hospitalization {
  _id: string;
  dateEntree?: string;
  dateSortie?: string;
  diagnostic?: string;
  motifAdmission?: string;
  dossierN?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface Props {
  patientId: string;
  patientName: string;
  hospitalizations: Hospitalization[];
}

const AI_URL = (import.meta as any).env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

const fdate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '?';

// ── AI Status Badge ────────────────────────────────────────────────────────────

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
      {health.ollama_model} actif
    </span>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const PatientAIPanel: React.FC<Props> = ({ patientId, patientName, hospitalizations }) => {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [selectedHospId, setSelectedHospId] = useState<string>('all');
  const [open, setOpen]                 = useState(false);
  const abortRef                        = useRef<AbortController | null>(null);
  const bottomRef                       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message to AI
  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || isLoading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Build the request
    const hospId = selectedHospId === 'all' ? null : selectedHospId;

    // Add an empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      // Build a context prompt from conversation history
      const history = [...messages, userMsg]
        .map(m => `${m.role === 'user' ? 'Médecin' : 'IA'}: ${m.content}`)
        .join('\n');

      const req = {
        patient_id: patientId,
        hospitalization_id: hospId,
        language: 'fr',
        analysis_type: 'full',
        // Pass conversation context as part of the query
        user_question: userText,
        conversation_history: history,
      };

      const res = await fetch(`${AI_URL}/api/ai/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        // Fallback to non-streaming
        const fallback = await fetch(`${AI_URL}/api/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
          signal: abortRef.current.signal,
        });
        const data = await fallback.json();
        const answer = buildAnswer(data, userText);
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { role: 'assistant', content: answer, isStreaming: false } : m
        ));
        setIsLoading(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.replace('data: ', ''));
            if (parsed.type === 'token') {
              full += parsed.content;
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: full } : m
              ));
            } else if (parsed.type === 'done' || parsed.type === 'error') {
              break;
            }
          } catch (_) {}
        }
      }

      // If streaming gave nothing, do a normal analyze call
      if (!full) {
        const fallback = await fetch(`${AI_URL}/api/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        });
        const data = await fallback.json();
        full = buildAnswer(data, userText);
      }

      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'assistant', content: full || 'Analyse terminée.', isStreaming: false } : m
      ));
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1
            ? { role: 'assistant', content: '❌ Erreur de connexion au service IA. Vérifiez que Ollama est actif (`ollama serve`).', isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const buildAnswer = (data: any, question: string): string => {
    if (!data || data.detail) return `❌ ${data?.detail || 'Patient non trouvé'}`;
    const parts: string[] = [];
    if (data.summary) parts.push(`**Résumé :** ${data.summary}`);
    if (data.key_findings?.length) {
      parts.push(`**Points clés :**\n${data.key_findings.map((f: string) => `• ${f}`).join('\n')}`);
    }
    if (data.diagnostic_suggestions?.length) {
      parts.push(`**Diagnostics suggérés :**\n${data.diagnostic_suggestions
        .map((d: any) => `• [${d.confidence}] ${d.condition} — ${d.reasoning}`)
        .join('\n')}`);
    }
    return parts.join('\n\n') || 'Analyse complète. Posez une question spécifique.';
  };

  const quickQuestions = [
    'Résume le dernier séjour',
    'Quels sont les résultats biologiques ?',
    'Y a-t-il des allergies documentées ?',
    'Évolution post-opératoire ?',
    'Antécédents chirurgicaux ?',
  ];

  const selectedHosp = hospitalizations.find(h => h._id === selectedHospId);

  return (
    <div className="card border border-violet-100 dark:border-violet-800/30 overflow-hidden">

      {/* ── Header ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/10 dark:to-indigo-900/10 hover:from-violet-100 dark:hover:from-violet-900/20 transition"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
            <Brain className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Assistant IA — {patientName}
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {hospitalizations.length} hospitalisation(s) · Analyse locale
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AIStatusBadge />
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="flex flex-col" style={{ height: '520px' }}>

          {/* ── Hospitalization selector ── */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Bed className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={selectedHospId}
                onChange={e => setSelectedHospId(e.target.value)}
                className="flex-1 min-w-0 text-xs rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 focus:ring-2 focus:ring-violet-400 outline-none"
              >
                <option value="all">🏥 Toutes les hospitalisations ({hospitalizations.length})</option>
                {hospitalizations.map(h => (
                  <option key={h._id} value={h._id}>
                    📋 {fdate(h.dateEntree)}
                    {h.dateSortie ? ` → ${fdate(h.dateSortie)}` : ' (en cours)'}
                    {h.diagnostic ? ` — ${h.diagnostic.slice(0, 40)}` : ''}
                    {h.dossierN ? ` #${h.dossierN}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); abortRef.current?.abort(); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Réinitialiser
              </button>
            )}
          </div>

          {/* ── Context info bar ── */}
          {selectedHospId !== 'all' && selectedHosp && (
            <div className="px-4 py-2 bg-violet-50 dark:bg-violet-900/10 border-b border-violet-100 dark:border-violet-800/30 text-[10px] text-violet-700 dark:text-violet-400 flex items-center gap-2">
              <span className="font-bold">Dossier sélectionné :</span>
              <span>{fdate(selectedHosp.dateEntree)} · {selectedHosp.diagnostic || selectedHosp.motifAdmission || 'Sans diagnostic'}</span>
            </div>
          )}

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-6">
                <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Assistant médical IA
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Posez une question sur {selectedHospId === 'all' ? 'toutes les hospitalisations' : 'ce dossier'}
                  </p>
                </div>
                {/* Quick questions */}
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {quickQuestions.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-full text-gray-600 dark:text-gray-300 hover:border-violet-400 hover:text-violet-600 transition disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-200 dark:border-slate-700'
                  }`}
                >
                  {msg.content || (msg.isStreaming ? <Loader2 className="w-4 h-4 animate-spin inline" /> : '')}
                  {msg.isStreaming && msg.content && (
                    <span className="inline-block w-1.5 h-3.5 bg-current rounded-sm animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* ── Disclaimer ── */}
          <div className="px-4 py-1.5 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-800/30">
            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <p className="text-[9px] text-amber-600 dark:text-amber-400">
              Suggestions IA à titre informatif uniquement — ne remplacent pas le jugement clinique.
            </p>
          </div>

          {/* ── Input ── */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={`Question sur ${selectedHospId === 'all' ? 'toutes les hospitalisations' : 'ce dossier'}...`}
              disabled={isLoading}
              className="flex-1 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 focus:ring-2 focus:ring-violet-400 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl transition flex-shrink-0"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientAIPanel;
