import { NextResponse } from 'next/server';
import type { Proposition, Insight, GroundingResult, ThoughtSummary, EngineType, GraphState } from '@/lib/types';

export interface InsightRequest {
  propositions: Proposition[];
  analysisResults: Partial<GraphState>;
  engineType: EngineType;
}

export interface InsightResponse {
  insight: Insight;
  groundingResults: GroundingResult[];
  thoughtSummary: ThoughtSummary;
}

/**
 * Layer 3: Gemini insight generator
 * POST /api/insight
 *
 * Takes propositions + analysis results and generates insights with grounding.
 */
export async function POST(request: Request) {
  try {
    const body: InsightRequest = await request.json();

    if (!body.propositions || !body.engineType) {
      return NextResponse.json({ error: 'Propositions and engineType are required' }, { status: 400 });
    }

    // TODO: Person A implements — call generateInsight from gemini-client.ts
    // import { generateInsight } from '@/lib/gemini-client';
    // const result = await generateInsight(body.propositions, body.analysisResults, body.engineType);
    // return NextResponse.json(result);

    // Mock response for development
    const mockResponse: InsightResponse = {
      insight: {
        id: `insight-mock-${Date.now()}`,
        engineType: body.engineType,
        content: 'Mock: Insight generation not yet implemented',
        affectedNodeIds: [],
      },
      groundingResults: [],
      thoughtSummary: {
        text: 'Mock: Insight generation not yet implemented',
        timestamp: Date.now(),
      },
    };

    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error('Insight API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
