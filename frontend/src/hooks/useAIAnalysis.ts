/**
 * useAIAnalysis.ts — React Hook للتحليل الطبي بالذكاء الاصطناعي
 *
 * يدير:
 * - استدعاء FastAPI AI Service
 * - حالات التحميل والأخطاء
 * - Streaming mode للعرض التدريجي
 * - Cache للنتائج السابقة
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DiagnosticSuggestion {
  condition: string;
  confidence: 'élevé' | 'moyen' | 'faible' | string;
  reasoning: string;
  recommended_tests: string[];
}

export interface AnalysisResult {
  patient_id: string;
  hospitalization_id: string;
  patient_name: string;
  summary: string;
  diagnostic_suggestions: DiagnosticSuggestion[];
  key_findings: string[];
  retrieved_context?: string;
  model_used: string;
  processing_time_seconds: number;
  language: string;
}

export interface AnalyzeRequest {
  patient_id: string;
  hospitalization_id?: string;
  language?: 'fr' | 'ar' | 'en';
  analysis_type?: 'full' | 'summary' | 'diagnostics' | 'followup';
}

export interface AIServiceHealth {
  status: string;
  ollama_available: boolean;
  ollama_model: string;
  embedding_model: string;
  chroma_db: string;
  mongodb: string;
}

// ── API Client ────────────────────────────────────────────────────────────────

const AI_SERVICE_URL =
  (import.meta as any).env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

const aiApi = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 120_000,   // 2 minutes — الـ LLM قد يحتاج وقتاً
});

// ── Hook: useAIAnalysis ────────────────────────────────────────────────────────

export function useAIAnalysis() {
  const qc = useQueryClient();

  const mutation = useMutation<AnalysisResult, Error, AnalyzeRequest>({
    mutationFn: async (req: AnalyzeRequest) => {
      const res = await aiApi.post<AnalysisResult>('/api/ai/analyze', req);
      return res.data;
    },
    onSuccess: (data, variables) => {
      // Cache بـ patient_id
      qc.setQueryData(
        ['ai-analysis', variables.patient_id, variables.hospitalization_id],
        data
      );
    },
  });

  const analyze = useCallback(
    (req: AnalyzeRequest) => mutation.mutate(req),
    [mutation]
  );

  return {
    analyze,
    result:     mutation.data,
    isLoading:  mutation.isPending,
    error:      mutation.error?.message || null,
    reset:      mutation.reset,
  };
}

// ── Hook: useAIStream (streaming mode) ────────────────────────────────────────

export function useAIStream() {
  const [streamText, setStreamText]   = useState('');
  const [isStreaming, setIsStreaming]  = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const abortRef                      = useRef<AbortController | null>(null);

  const startStream = useCallback(async (req: AnalyzeRequest) => {
    // إلغاء stream سابق إن وجد
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStreamText('');
    setError(null);
    setIsStreaming(true);

    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/ai/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader   = res.body.getReader();
      const decoder  = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const raw = line.replace('data: ', '');
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'token') {
              setStreamText(prev => prev + parsed.content);
            } else if (parsed.type === 'done') {
              setIsStreaming(false);
            } else if (parsed.type === 'error') {
              setError(parsed.message);
              setIsStreaming(false);
            }
          } catch (_) { /* ignore malformed events */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Erreur de connexion au service AI');
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { startStream, stopStream, streamText, isStreaming, error };
}

// ── Hook: useAIHealth ─────────────────────────────────────────────────────────

export function useAIHealth() {
  return useQuery<AIServiceHealth>({
    queryKey: ['ai-health'],
    queryFn: async () => {
      const res = await aiApi.get<AIServiceHealth>('/api/health');
      return res.data;
    },
    refetchInterval: 30_000,   // كل 30 ثانية
    retry: false,
    staleTime: 10_000,
  });
}

// ── Hook: useAIIndex (فهرسة مسبقة) ───────────────────────────────────────────

export function useAIIndex() {
  return useMutation({
    mutationFn: async (req: {
      patient_id: string;
      hospitalization_id?: string;
      force_reindex?: boolean;
    }) => {
      const res = await aiApi.post('/api/ai/index', req);
      return res.data;
    },
  });
}
