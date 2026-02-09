import { toCamelCase } from '@/lib/types';

/**
 * Normalizes backend response (snake_case) to frontend format (camelCase)
 */
export function normalizeBackendResponse(data: unknown): {
  propositions: import('@/lib/types').Proposition[];
  relationships: import('@/lib/types').Relationship[];
  contradictions: import('@/lib/types').Contradiction[];
  fallacies: import('@/lib/types').Fallacy[];
  biases: import('@/lib/types').CognitiveBias[];
  insights: import('@/lib/types').Insight[];
  thoughtSummaries: import('@/lib/types').ThoughtSummary[];
  groundingResults: import('@/lib/types').GroundingResult[];
  argumentScores: import('@/lib/types').ArgumentScore[];
} {
  if (!data || typeof data !== 'object') {
    return {
      propositions: [],
      relationships: [],
      contradictions: [],
      fallacies: [],
      biases: [],
      insights: [],
      thoughtSummaries: [],
      groundingResults: [],
      argumentScores: [],
    };
  }

  // Convert entire response to camelCase
  const normalized = toCamelCase(data) as Record<string, unknown>;

  return {
    propositions: (normalized.propositions as unknown[]) || [],
    relationships: (normalized.relationships as unknown[]) || [],
    contradictions: (normalized.contradictions as unknown[]) || [],
    fallacies: (normalized.fallacies as unknown[]) || [],
    biases: (normalized.biases as unknown[]) || [],
    insights: (normalized.insights as unknown[]) || [],
    thoughtSummaries: (normalized.thoughtSummaries as unknown[]) || [],
    groundingResults: (normalized.groundingResults as unknown[]) || [],
    argumentScores: (normalized.argumentScores as unknown[]) || [],
  };
}
