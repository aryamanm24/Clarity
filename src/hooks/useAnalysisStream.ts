'use client';

import { useState, useCallback, useRef } from 'react';
import {
  GraphState,
  Proposition,
  Relationship,
  Contradiction,
  Fallacy,
  Insight,
  ArgumentScore,
} from '@/lib/types';
import { EMPTY_GRAPH_STATE } from '@/lib/types';
import { toCamelCase } from '@/lib/types';

export type AnalysisPhase = 'idle' | 'parsing' | 'analyzing' | 'complete' | 'error';

function normalizeRelationships(
  rels: Relationship[] | unknown[],
  _r: Relationship & { source?: string; target?: string; from?: string; to?: string }
): Relationship[] {
  return rels.map((rel: unknown) => {
    const r = rel as Record<string, unknown>;
    return {
      ...r,
      fromId: r.fromId ?? r.from_id ?? r.source ?? r.from ?? '',
      toId: r.toId ?? r.to_id ?? r.target ?? r.to ?? '',
    } as Relationship;
  });
}

function computeArgumentScores(
  propositions: Proposition[],
  relationships: Relationship[],
  contradictions: Contradiction[]
): ArgumentScore[] {
  return propositions.map((prop) => {
    const supportCount = relationships.filter(
      (r) => (r.toId ?? r.to_id) === prop.id && (r.type === 'supports' || r.type === 'concludes_from')
    ).length;
    const contraCount = contradictions.filter((c) =>
      ((c.propositionIds ?? c.proposition_ids) ?? []).includes(prop.id)
    ).length;
    const base = supportCount / (supportCount + 1);
    const penalty = contraCount * 0.3;
    const score = Math.max(0, Math.min(1, base - penalty));
    return {
      propositionId: prop.id,
      score: Math.round(score * 100) / 100,
      evidencePaths: supportCount,
      contradictionCount: contraCount,
      vulnerableAssumptions: propositions.filter(
        (p) => (p.isLoadBearing ?? p.is_load_bearing) && (p.isImplicit ?? p.is_implicit)
      ).length,
    };
  });
}

function buildInsights(
  validity: Record<string, unknown> | null,
  reconstruction: Record<string, unknown> | null,
  tensions: unknown[],
  ambiguities: unknown[],
  propositions: Proposition[]
): Insight[] {
  const insights: Insight[] = [];
  if (validity?.validityExplanation) {
    insights.push({
      id: `insight_${Math.random().toString(36).slice(2, 10)}`,
      engineType: 'precision',
      content: validity.validityExplanation as string,
      keyQuestion: undefined,
      affectedNodeIds: propositions.filter((p) => p.type === 'claim').map((p) => p.id),
    });
  }
  if (reconstruction?.presentableArgument) {
    insights.push({
      id: `insight_${Math.random().toString(36).slice(2, 10)}`,
      engineType: 'signal',
      content: reconstruction.presentableArgument as string,
      keyQuestion: undefined,
      affectedNodeIds: propositions.map((p) => p.id),
    });
  }
  tensions.forEach((t: unknown) => {
    const r = t as Record<string, unknown>;
    insights.push({
      id: `insight_${Math.random().toString(36).slice(2, 10)}`,
      engineType: 'adversarial',
      content: (r.description as string) ?? '',
      keyQuestion: (r.probingQuestion as string) ?? undefined,
      affectedNodeIds: (r.propositionIds ?? r.proposition_ids ?? []) as string[],
    });
  });
  ambiguities.forEach((a: unknown) => {
    const r = a as Record<string, unknown>;
    insights.push({
      id: `insight_${Math.random().toString(36).slice(2, 10)}`,
      engineType: 'assumption',
      content: `The term '${(r.ambiguousTerm as string) ?? ''}' is ambiguous in your argument.`,
      keyQuestion: (r.questionForUser as string) ?? undefined,
      affectedNodeIds: (r.propositionIds ?? r.proposition_ids ?? []) as string[],
    });
  });
  return insights;
}

export function useAnalysisStream() {
  const voiceSessionIdRef = useRef(`voice-${Date.now()}`);
  const [graphState, setGraphState] = useState<GraphState>(EMPTY_GRAPH_STATE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const applyVoiceResult = useCallback(
    (data: {
      propositions?: Proposition[];
      relationships?: Relationship[];
      contradictions?: Contradiction[];
      fallacies?: Fallacy[];
      insights?: Insight[];
      round?: number;
      degraded?: boolean;
    }) => {
      setGraphState((prev) => {
        const newProps = (data.propositions ?? prev.propositions) as Proposition[];
        const newRels = (data.relationships ?? prev.relationships) as Relationship[];
        const round = data.round ?? 1;
        const isDegraded = data.degraded === true;

        if (newProps.length === 0 && round > 1 && prev.propositions.length > 0) {
          return prev;
        }

        let propositions = newProps;
        let relationships = newRels;

        if (isDegraded && round > 1 && prev.propositions.length > 0) {
          const existingIds = new Set(prev.propositions.map((p: Proposition) => p.id));
          const newOnes = (data.propositions ?? []).filter(
            (p: Proposition) => !existingIds.has(p.id as string)
          );
          propositions = [...prev.propositions, ...newOnes];
          if ((data.relationships ?? []).length === 0 && prev.relationships.length > 0) {
            relationships = prev.relationships;
          }
        }

        if (
          round > 1 &&
          prev.propositions.length > 0 &&
          newProps.length > 0 &&
          newProps.length < prev.propositions.length &&
          !isDegraded
        ) {
          const existingIds = new Set(prev.propositions.map((p: Proposition) => p.id));
          const genuinelyNew = newProps.filter((p: Proposition) => !existingIds.has(p.id as string));
          if (genuinelyNew.length > 0) {
            propositions = [...prev.propositions, ...genuinelyNew];
          } else {
            return prev;
          }
        }

        const contradictions = (data.contradictions ?? prev.contradictions) as Contradiction[];
        const fallacies = (data.fallacies ?? prev.fallacies) as Fallacy[];
        const insights = (data.insights ?? prev.insights) as Insight[];

        const relsNormalized = normalizeRelationships(relationships, {} as Relationship);

        // Add contradiction edges from contradictions data (SAT/Gemini may find more than parser)
        const contradictionEdges = contradictions
          .map((c, idx) => {
            const ids = (c.propositionIds ?? (c as { proposition_ids?: string[] }).proposition_ids ?? []) as string[];
            if (ids.length >= 2) {
              return {
                id: `contradiction_edge_${idx}`,
                fromId: ids[0],
                toId: ids[1],
                type: 'contradicts',
              } as Relationship;
            }
            return null;
          })
          .filter((r): r is Relationship => r !== null);

        const nonContradictionRels = relsNormalized.filter(
          (r) => (r.type ?? '').toLowerCase() !== 'contradicts'
        );
        const relationshipsWithContradictions = normalizeRelationships(
          [...nonContradictionRels, ...contradictionEdges],
          {} as Relationship
        );
        const argumentScores = computeArgumentScores(
          propositions,
          relationshipsWithContradictions,
          contradictions
        );

        return {
          ...EMPTY_GRAPH_STATE,
          propositions,
          relationships: relationshipsWithContradictions,
          contradictions,
          fallacies,
          biases: [],
          insights,
          thoughtSummaries: prev.thoughtSummaries,
          groundingResults: [],
          argumentScores,
        };
      });
    },
    []
  );

  const triggerVoiceAnalysis = useCallback(
    async (input: string, roundNumber: number) => {
      if (!input.trim()) return;

      setIsAnalyzing(true);
      setAnalysisPhase('parsing');
      setError(null);

      let propositions: Proposition[] = [];
      let relationships: Relationship[] = [];
      let contradictions: Contradiction[] = [];
      let fallacies: Fallacy[] = [];
      let ambiguities: unknown[] = [];
      let tensions: unknown[] = [];
      let validity: Record<string, unknown> | null = null;
      let reconstruction: Record<string, unknown> | null = null;

      const updateVoiceState = () => {
        const relationshipsNormalized = normalizeRelationships(relationships, {} as Relationship);
        const argumentScores = computeArgumentScores(propositions, relationshipsNormalized, contradictions);
        const insights = buildInsights(validity, reconstruction, tensions, ambiguities, propositions);
        applyVoiceResult({
          propositions,
          relationships: relationshipsNormalized,
          contradictions,
          fallacies,
          insights,
          round: roundNumber,
        });
      };

      try {
        const response = await fetch('/api/analyze/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            session_id: voiceSessionIdRef.current,
            engines: ['adversarial', 'assumption', 'precision', 'signal'],
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error || 'Analysis failed');
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const raw = line.slice(6).trim();
              if (raw === '[DONE]' || raw === '') continue;
              const event = JSON.parse(raw) as { type: string; data?: Record<string, unknown> };
              const data = event.data ?? event;

              switch (event.type) {
                case 'analysis_started':
                  setAnalysisPhase('parsing');
                  break;
                case 'propositions_parsed': {
                  setAnalysisPhase('analyzing');
                  propositions = (toCamelCase(data.propositions ?? []) as Proposition[]) ?? [];
                  relationships = (toCamelCase(data.relationships ?? []) as Relationship[]) ?? [];
                  updateVoiceState();
                  break;
                }
                case 'validity_checked':
                  validity = (data.validity ?? data) as Record<string, unknown>;
                  break;
                case 'contradictions_found':
                  contradictions = (toCamelCase(data.contradictions ?? data ?? []) as Contradiction[]) ?? [];
                  updateVoiceState();
                  break;
                case 'fallacies_found':
                  fallacies = (toCamelCase(data.fallacies ?? data ?? []) as Fallacy[]) ?? [];
                  updateVoiceState();
                  break;
                case 'ambiguities_found':
                  ambiguities = (data.ambiguities ?? data ?? []) as unknown[];
                  break;
                case 'tensions_found':
                  tensions = (data.tensions ?? data ?? []) as unknown[];
                  break;
                case 'argument_reconstructed':
                  reconstruction = (data.reconstruction ?? data) as Record<string, unknown>;
                  updateVoiceState();
                  break;
                case 'analysis_complete':
                  setAnalysisPhase('complete');
                  setIsAnalyzing(false);
                  return;
                case 'error': {
                  const msg = (data.message as string) ?? 'Unknown error';
                  setError(typeof msg === 'string' && (msg.includes('coroutine object') || msg.includes('<coroutine')) ? 'An internal error occurred.' : msg);
                  setAnalysisPhase('error');
                  setIsAnalyzing(false);
                  return;
                }
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', line, parseErr);
            }
          }
        }

        setAnalysisPhase('complete');
        setIsAnalyzing(false);
      } catch (err) {
        console.error('Voice analysis error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setAnalysisPhase('error');
        setIsAnalyzing(false);
      }
    },
    [applyVoiceResult]
  );

  const startAnalysis = useCallback(
    async (input: string, engines?: string[]) => {
      if (!input.trim()) {
        setError('Please enter some text to analyze');
        return;
      }

      setIsAnalyzing(true);
      setAnalysisPhase('parsing');
      setError(null);
      setGraphState(EMPTY_GRAPH_STATE);

      try {
        const response = await fetch('/api/analyze/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            session_id: `session-${Date.now()}`,
            engines: engines || ['adversarial', 'assumption', 'precision', 'signal'],
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error || 'Analysis failed');
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let propositions: Proposition[] = [];
        let relationships: Relationship[] = [];
        let contradictions: Contradiction[] = [];
        let fallacies: Fallacy[] = [];
        let ambiguities: unknown[] = [];
        let tensions: unknown[] = [];
        let validity: Record<string, unknown> | null = null;
        let reconstruction: Record<string, unknown> | null = null;
        let thoughtSummaries: { text: string; timestamp: number }[] = [];

        const updateState = () => {
          const relationshipsNormalized = normalizeRelationships(relationships, {} as Relationship);
          const contradictionEdges = contradictions
            .map((c, idx) => {
              const ids = (c.propositionIds ?? (c as { proposition_ids?: string[] }).proposition_ids ?? []) as string[];
              if (ids.length >= 2) {
                return {
                  id: `contradiction_edge_${idx}`,
                  fromId: ids[0],
                  toId: ids[1],
                  type: 'contradicts',
                } as Relationship;
              }
              return null;
            })
            .filter((r): r is Relationship => r !== null);
          const nonContradictionRels = relationshipsNormalized.filter(
            (r) => (r.type ?? '').toLowerCase() !== 'contradicts'
          );
          const relationshipsWithContradictions = normalizeRelationships(
            [...nonContradictionRels, ...contradictionEdges],
            {} as Relationship
          );
          const argumentScores = computeArgumentScores(
            propositions,
            relationshipsWithContradictions,
            contradictions
          );
          const insights = buildInsights(validity, reconstruction, tensions, ambiguities, propositions);
          setGraphState({
            ...EMPTY_GRAPH_STATE,
            propositions,
            relationships: relationshipsWithContradictions,
            contradictions,
            fallacies,
            biases: [],
            insights,
            thoughtSummaries,
            groundingResults: [],
            argumentScores,
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const raw = line.slice(6).trim();
              if (raw === '[DONE]' || raw === '') continue;
              const event = JSON.parse(raw) as { type: string; data?: Record<string, unknown> };
              const data = event.data ?? event;

              switch (event.type) {
                case 'analysis_started':
                  setAnalysisPhase('parsing');
                  break;

                case 'propositions_parsed': {
                  setAnalysisPhase('analyzing');
                  const ps = (data.propositions ?? []) as Proposition[];
                  const rels = (data.relationships ?? []) as Relationship[];
                  propositions = (toCamelCase(ps) as Proposition[]) ?? ps;
                  relationships = (toCamelCase(rels) as Relationship[]) ?? rels;
                  thoughtSummaries = (data.thoughtSummaries ?? []) as { text: string; timestamp: number }[];
                  if (thoughtSummaries.length === 0 && data.thoughtSummary) {
                    thoughtSummaries = [{ text: data.thoughtSummary as string, timestamp: Date.now() / 1000 }];
                  }
                  updateState();
                  break;
                }

                case 'validity_checked':
                  validity = (data.validity ?? data) as Record<string, unknown>;
                  updateState();
                  break;

                case 'contradictions_found':
                  contradictions = (toCamelCase(data.contradictions ?? data ?? []) as Contradiction[]) ?? [];
                  updateState();
                  break;

                case 'fallacies_found':
                  fallacies = (toCamelCase(data.fallacies ?? data ?? []) as Fallacy[]) ?? [];
                  updateState();
                  break;

                case 'ambiguities_found':
                  ambiguities = (data.ambiguities ?? data ?? []) as unknown[];
                  updateState();
                  break;

                case 'tensions_found':
                  tensions = (data.tensions ?? data ?? []) as unknown[];
                  updateState();
                  break;

                case 'argument_reconstructed':
                  reconstruction = (data.reconstruction ?? data) as Record<string, unknown>;
                  updateState();
                  break;

                case 'analysis_complete':
                  setAnalysisPhase('complete');
                  setIsAnalyzing(false);
                  break;

                case 'error': {
                  const msg = (data.message as string) ?? 'Unknown error';
                  // Never display raw coroutine/backend repr in UI
                  if (typeof msg === 'string' && (msg.includes('coroutine object') || msg.includes('<coroutine'))) {
                    setError('An internal error occurred during analysis.');
                  } else {
                    setError(msg);
                  }
                  setAnalysisPhase('error');
                  setIsAnalyzing(false);
                  break;
                }
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', line, parseErr);
            }
          }
        }

        setAnalysisPhase('complete');
        setIsAnalyzing(false);
      } catch (err) {
        console.error('Analysis error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setAnalysisPhase('error');
        setIsAnalyzing(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    voiceSessionIdRef.current = `voice-${Date.now()}`;
    setGraphState(EMPTY_GRAPH_STATE);
    setError(null);
    setIsAnalyzing(false);
    setAnalysisPhase('idle');
  }, []);

  return {
    graphState,
    isAnalyzing,
    analysisPhase,
    error,
    startAnalysis,
    reset,
    applyVoiceResult,
    triggerVoiceAnalysis,
  };
}
