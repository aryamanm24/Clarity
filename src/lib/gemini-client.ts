import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  Proposition,
  Relationship,
  ThoughtSummary,
  Insight,
  GroundingResult,
  EngineType,
  GraphState,
} from './types';

// ============================================================
// Gemini Client — API key and client singleton
// ============================================================

const apiKey = process.env.GEMINI_API_KEY;

function getClient(): GoogleGenAI {
  if (!apiKey?.trim()) {
    throw new Error(
      'Missing GEMINI_API_KEY. Set it in .env.local (see .env.example).'
    );
  }
  return new GoogleGenAI({ apiKey });
}

// ============================================================
// Parse result & Insight result types (exported)
// ============================================================

export interface ParseResult {
  propositions: Proposition[];
  relationships: Relationship[];
  thoughtSummary: ThoughtSummary;
}

export interface InsightResult {
  insight: Insight;
  groundingResults: GroundingResult[];
  thoughtSummary: ThoughtSummary;
}

// ============================================================
// JSON Schema for structured proposition extraction
// ============================================================

const PARSE_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  required: ['propositions', 'relationships'],
  properties: {
    propositions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['statement', 'formalExpression', 'type', 'confidence', 'isImplicit', 'isLoadBearing', 'isAnchored'],
        properties: {
          statement: { type: 'string' },
          formalExpression: { type: 'string' },
          type: { type: 'string', enum: ['claim', 'evidence', 'assumption', 'constraint', 'risk'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unstated_as_absolute'] },
          isImplicit: { type: 'boolean' },
          isLoadBearing: { type: 'boolean' },
          isAnchored: { type: 'boolean' },
        },
      },
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fromId', 'toId', 'type', 'strength'],
        properties: {
          fromId: { type: 'string' },
          toId: { type: 'string' },
          type: { type: 'string', enum: ['supports', 'contradicts', 'depends_on', 'attacks', 'assumes'] },
          strength: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
          label: { type: 'string' },
        },
      },
    },
  },
} as const;

// ============================================================
// Helpers: IDs, thought extraction, grounding mapping
// ============================================================

function generateId(prefix: string): string {
  const hex = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${hex}`;
}

function extractThoughtSummary(response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>): string {
  const parts: string[] = [];
  const candidate = response.candidates?.[0];
  const content = candidate?.content;
  if (content?.parts) {
    for (const part of content.parts) {
      const p = part as { thought?: boolean; text?: string };
      if (p.thought && typeof p.text === 'string') {
        parts.push(p.text);
      }
    }
  }
  return parts.length > 0 ? parts.join('\n\n') : (response.text ?? '');
}

function mapGroundingMetadata(
  groundingMetadata: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } | undefined,
  _propositionId: string
): GroundingResult[] {
  const results: GroundingResult[] = [];
  const chunks = groundingMetadata?.groundingChunks ?? [];
  for (const chunk of chunks) {
    const web = chunk.web;
    if (web?.uri) {
      results.push({
        query: '',
        claim: '',
        verdict: 'insufficient_data',
        evidence: '',
        sources: [{ title: web.title ?? '', url: web.uri }],
        propositionId: _propositionId,
      });
    }
  }
  return results;
}

// ============================================================
// Layer 1: Parse natural language → propositions & relationships
// ============================================================

const PARSE_SYSTEM = `You are an expert at argument analysis. Given a natural language argument or decision, extract:
1. Propositions: distinct claims, evidence, assumptions, constraints, and risks. For each provide statement (natural language), formalExpression (logical form, e.g. P → Q or predicate notation), type, confidence (high/medium/low/unstated_as_absolute), isImplicit, isLoadBearing, isAnchored.
2. Relationships: how propositions connect (supports, contradicts, depends_on, attacks, assumes) with strength (strong/moderate/weak) and optional label. Use fromId and toId as the index (0-based) of the proposition in the propositions array, e.g. "0" and "1".

Return only valid JSON matching the schema. Do not include markdown or extra text.`;

/**
 * Layer 1: Parse natural language input into propositions and relationships.
 * Uses Gemini with thinking and structured JSON output.
 */
export async function parsePropositions(input: string): Promise<ParseResult> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      { role: 'user', parts: [{ text: `Analyze this argument and extract propositions and relationships:\n\n${input}` }] },
    ],
    config: {
      systemInstruction: PARSE_SYSTEM,
      responseMimeType: 'application/json',
      responseJsonSchema: PARSE_RESPONSE_JSON_SCHEMA,
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: ThinkingLevel.HIGH,
      },
    },
  });

  const thoughtSummary: ThoughtSummary = {
    text: extractThoughtSummary(response),
    timestamp: Date.now(),
  };

  const raw = response.text?.trim();
  if (!raw) {
    return { propositions: [], relationships: [], thoughtSummary };
  }

  const parsed = JSON.parse(raw) as {
    propositions: Array<{
      statement: string;
      formalExpression: string;
      type: Proposition['type'];
      confidence: Proposition['confidence'];
      isImplicit: boolean;
      isLoadBearing: boolean;
      isAnchored: boolean;
    }>;
    relationships: Array<{
      fromId: string;
      toId: string;
      type: Relationship['type'];
      strength: Relationship['strength'];
      label?: string;
    }>;
  };

  const propositions: Proposition[] = (parsed.propositions ?? []).map((p, i) => ({
    id: generateId('p'),
    statement: p.statement,
    formalExpression: p.formalExpression,
    type: p.type,
    confidence: p.confidence,
    isImplicit: p.isImplicit ?? false,
    isLoadBearing: p.isLoadBearing ?? false,
    isAnchored: p.isAnchored ?? false,
  }));

  const indexToId = new Map<number, string>();
  propositions.forEach((prop, i) => indexToId.set(i, prop.id));

  const relationships: Relationship[] = (parsed.relationships ?? []).map((r) => {
    const fromIdx = parseInt(r.fromId, 10);
    const toIdx = parseInt(r.toId, 10);
    const fromId = Number.isNaN(fromIdx) ? r.fromId : (indexToId.get(fromIdx) ?? r.fromId);
    const toId = Number.isNaN(toIdx) ? r.toId : (indexToId.get(toIdx) ?? r.toId);
    return {
      id: generateId('r'),
      fromId,
      toId,
      type: r.type,
      strength: r.strength,
      label: r.label,
    };
  });

  return { propositions, relationships, thoughtSummary };
}

// ============================================================
// Layer 3: Generate insight (with optional Google Search grounding)
// ============================================================

/**
 * Layer 3: Generate insights from analysis results.
 * Uses Gemini with optional Google Search grounding for fact-checking.
 */
export async function generateInsight(
  propositions: Proposition[],
  analysisResults: Partial<GraphState>,
  engineType: EngineType
): Promise<InsightResult> {
  const ai = getClient();
  const context = [
    'Propositions:',
    propositions.map((p) => `- [${p.id}] ${p.type}: ${p.statement}`).join('\n'),
    '',
    'Analysis summary:',
    analysisResults.contradictions?.length ? `Contradictions: ${analysisResults.contradictions.length}` : '',
    analysisResults.fallacies?.length ? `Fallacies: ${analysisResults.fallacies.length}` : '',
    analysisResults.biases?.length ? `Biases: ${analysisResults.biases.length}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `As a ${engineType} engine, provide one concise insight that helps stress-test or clarify this argument. Include a key question the user should consider. Use the context below.\n\n${context}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { includeThoughts: true },
    },
  });

  const thoughtSummary: ThoughtSummary = {
    text: extractThoughtSummary(response),
    timestamp: Date.now(),
  };

  const content = response.text ?? '';
  const candidate = response.candidates?.[0];
  const groundingResults = mapGroundingMetadata(candidate?.groundingMetadata, propositions[0]?.id ?? '');

  const insight: Insight = {
    id: generateId('insight'),
    engineType,
    content: content.trim(),
    keyQuestion: content.includes('?') ? content.split('?').slice(-2, -1).join('?').trim() + '?' : undefined,
    affectedNodeIds: propositions.slice(0, 3).map((p) => p.id),
    groundingResults: groundingResults.length > 0 ? groundingResults : undefined,
  };

  return { insight, groundingResults, thoughtSummary };
}

/**
 * Adversarial Mirror: Generate counter-arguments and stress-test reasoning.
 */
export async function generateAdversarial(
  propositions: Proposition[],
  analysisResults: Partial<GraphState>
): Promise<InsightResult> {
  return generateInsight(propositions, analysisResults, 'adversarial');
}

/**
 * Assumption Archaeologist: Extract hidden assumptions from input.
 */
export async function extractAssumptions(
  input: string,
  propositions: Proposition[]
): Promise<ParseResult> {
  const ai = getClient();
  const existing = propositions.length
    ? `Existing propositions:\n${propositions.map((p) => `- ${p.statement}`).join('\n')}\n\n`
    : '';

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${existing}From the following text, extract only hidden or implicit assumptions as new propositions. Also list any new relationships (e.g. assumes, depends_on) linking them to existing or new propositions. If there are no new assumptions, return empty propositions and relationships.\n\nText:\n${input}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: PARSE_SYSTEM,
      responseMimeType: 'application/json',
      responseJsonSchema: PARSE_RESPONSE_JSON_SCHEMA,
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: ThinkingLevel.HIGH,
      },
    },
  });

  const thoughtSummary: ThoughtSummary = {
    text: extractThoughtSummary(response),
    timestamp: Date.now(),
  };

  const raw = response.text?.trim();
  if (!raw) {
    return { propositions: [], relationships: [], thoughtSummary };
  }

  const parsed = JSON.parse(raw) as {
    propositions: Array<{
      statement: string;
      formalExpression: string;
      type: Proposition['type'];
      confidence: Proposition['confidence'];
      isImplicit: boolean;
      isLoadBearing: boolean;
      isAnchored: boolean;
    }>;
    relationships: Array<{
      fromId: string;
      toId: string;
      type: Relationship['type'];
      strength: Relationship['strength'];
      label?: string;
    }>;
  };

  const startIdx = propositions.length;
  const newPropositions: Proposition[] = (parsed.propositions ?? []).map((p) => ({
    id: generateId('p'),
    statement: p.statement,
    formalExpression: p.formalExpression,
    type: (p.type === 'assumption' ? 'assumption' : p.type) as Proposition['type'],
    confidence: p.confidence,
    isImplicit: true,
    isLoadBearing: p.isLoadBearing ?? false,
    isAnchored: p.isAnchored ?? false,
  }));

  const indexToId = new Map<number, string>();
  newPropositions.forEach((prop, i) => indexToId.set(i, prop.id));

  const relationships: Relationship[] = (parsed.relationships ?? []).map((r) => {
    const fromIdx = parseInt(r.fromId, 10);
    const toIdx = parseInt(r.toId, 10);
    const fromId = Number.isNaN(fromIdx) ? r.fromId : (indexToId.get(fromIdx) ?? r.fromId);
    const toId = Number.isNaN(toIdx) ? r.toId : (indexToId.get(toIdx) ?? r.toId);
    return {
      id: generateId('r'),
      fromId,
      toId,
      type: r.type,
      strength: r.strength,
      label: r.label,
    };
  });

  return {
    propositions: newPropositions,
    relationships,
    thoughtSummary,
  };
}
