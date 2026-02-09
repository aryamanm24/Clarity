// ============================================================
// CLARITY: Shared Type Definitions
// ============================================================
// THIS FILE IS THE CONTRACT BETWEEN PERSON A AND PERSON B.
// DO NOT MODIFY WITHOUT TELLING THE OTHER PERSON.
// ============================================================

// Helper to convert snake_case to camelCase (for Python backend responses)
export function toCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      (acc as Record<string, unknown>)[camelKey] = toCamelCase((obj as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return obj;
}

// --- Core Proposition Types ---

export interface Proposition {
  id: string;
  statement: string;
  formal_expression?: string;
  formalExpression?: string;
  type: 'claim' | 'evidence' | 'assumption' | 'constraint' | 'risk';
  confidence: 'high' | 'medium' | 'low' | 'unstated_as_absolute' | string | number;
  is_implicit?: boolean;
  isImplicit?: boolean;
  is_load_bearing?: boolean;
  isLoadBearing?: boolean;
  is_anchored?: boolean;
  isAnchored?: boolean;
  position?: { x: number; y: number };
}

export interface Relationship {
  id: string;
  from_id?: string;
  fromId?: string;
  to_id?: string;
  toId?: string;
  /** supports | concludes_from (backend) | contradicts | depends_on | attacks | assumes */
  type: 'supports' | 'contradicts' | 'depends_on' | 'attacks' | 'assumes' | 'concludes_from';
  strength: 'strong' | 'moderate' | 'weak' | string;
  label?: string;
}

// --- Analysis Result Types ---

export interface Contradiction {
  id: string;
  proposition_ids?: string[];
  propositionIds?: string[];
  type: 'logical' | 'temporal' | 'empirical' | string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'major' | 'minor' | string;
  formal_proof?: string;
  formalProof?: string;
  human_explanation?: string;
  humanExplanation?: string;
  minimal_core?: string[];
  minimalCore?: string[];
}

export interface Fallacy {
  id: string;
  name: string;
  description: string;
  affected_node_ids?: string[];
  affectedNodeIds?: string[];
  pattern_type?: string;
  patternType?: string;
  proof_path?: string[];
  proofPath?: string[];
}

export interface CognitiveBias {
  id: string;
  name: string;
  kahnemanReference?: string;
  description: string;
  affected_node_ids?: string[];
  affectedNodeIds?: string[];
  severity: 'high' | 'medium' | 'low' | string;
  system?: 1 | 2;
}

export interface ThoughtSummary {
  text: string;
  timestamp: number;
}

export interface GroundingResult {
  query: string;
  claim: string;
  verdict: 'supported' | 'contradicted' | 'insufficient_data';
  evidence: string;
  sources: { title: string; url: string }[];
  propositionId: string;
}

export interface Insight {
  id: string;
  engine_type?: string;
  engineType?: EngineType | string;
  content: string;
  key_question?: string;
  keyQuestion?: string;
  affected_node_ids?: string[];
  affectedNodeIds?: string[];
  groundingResults?: GroundingResult[];
}

export interface ArgumentScore {
  propositionId: string;
  score: number;
  evidencePaths: number;
  contradictionCount: number;
  vulnerableAssumptions: number;
}

// --- Load-Bearing Info ---

export interface LoadBearingInfo {
  propositionId: string;
  centralityScore: number;
  dependentClaims: string[]; // Claims that depend on this assumption
}

// --- Master State ---

export interface GraphState {
  propositions: Proposition[];
  relationships: Relationship[];
  contradictions: Contradiction[];
  fallacies: Fallacy[];
  biases: CognitiveBias[];
  insights: Insight[];
  thought_summaries?: ThoughtSummary[];
  thoughtSummaries?: ThoughtSummary[];
  grounding_results?: GroundingResult[];
  groundingResults?: GroundingResult[];
  argument_scores?: ArgumentScore[];
  argumentScores?: ArgumentScore[];
  loadBearingAssumptions?: LoadBearingInfo[];
}

// --- SSE Event Types ---

export type AnalysisEventType =
  | 'propositions_parsed'
  | 'analysis_started'
  | 'contradictions_found'
  | 'fallacies_found'
  | 'biases_found'
  | 'scores_computed'
  | 'insight_generated'
  | 'grounding_result'
  | 'thought_summary'
  | 'analysis_complete'
  | 'error';

export interface AnalysisEvent {
  type: AnalysisEventType;
  data: Partial<GraphState>;
  timestamp: number;
}

// --- Engine Configuration ---

export type EngineType = 'adversarial' | 'assumption' | 'decomposition' | 'precision' | 'perspective' | 'signal';

export interface EngineConfig {
  activeEngines: EngineType[];
}

// --- Utility Types ---

export const EMPTY_GRAPH_STATE: GraphState = {
  propositions: [],
  relationships: [],
  contradictions: [],
  fallacies: [],
  biases: [],
  insights: [],
  thoughtSummaries: [],
  groundingResults: [],
  argumentScores: [],
  loadBearingAssumptions: [],
};
