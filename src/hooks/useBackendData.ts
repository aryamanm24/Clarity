import {
  toCamelCase,
  type Proposition,
  type Relationship,
  type Contradiction,
  type Fallacy,
  type CognitiveBias,
  type Insight,
  type ThoughtSummary,
  type GroundingResult,
  type ArgumentScore,
} from '@/lib/types';

/**
 * Normalizes backend response (snake_case) to frontend format (camelCase)
 */
export function normalizeBackendResponse(data: unknown): {
  propositions: Proposition[];
  relationships: Relationship[];
  contradictions: Contradiction[];
  fallacies: Fallacy[];
  biases: CognitiveBias[];
  insights: Insight[];
  thoughtSummaries: ThoughtSummary[];
  groundingResults: GroundingResult[];
  argumentScores: ArgumentScore[];
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
    propositions: ((normalized.propositions as unknown[]) || []) as Proposition[],
    relationships: ((normalized.relationships as unknown[]) || []) as Relationship[],
    contradictions: ((normalized.contradictions as unknown[]) || []) as Contradiction[],
    fallacies: ((normalized.fallacies as unknown[]) || []) as Fallacy[],
    biases: ((normalized.biases as unknown[]) || []) as CognitiveBias[],
    insights: ((normalized.insights as unknown[]) || []) as Insight[],
    thoughtSummaries: ((normalized.thoughtSummaries as unknown[]) || []) as ThoughtSummary[],
    groundingResults: ((normalized.groundingResults as unknown[]) || []) as GroundingResult[],
    argumentScores: ((normalized.argumentScores as unknown[]) || []) as ArgumentScore[],
  };
}
