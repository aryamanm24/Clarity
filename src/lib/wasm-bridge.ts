import type { Contradiction, Fallacy, CognitiveBias, ArgumentScore } from './types';

// ============================================================
// WASM Bridge — TypeScript ↔ Rust Interface
// ============================================================
// Person A implements the WASM loading and function calls.
// Person B codes against the typed return values.
// ============================================================

export interface WasmAnalysisResult {
  contradictions: Contradiction[];
  fallacies: Fallacy[];
  biases: CognitiveBias[];
  argumentScores: ArgumentScore[];
  cycles: string[][];          // Arrays of node IDs forming cycles
  topologicalOrder: string[];  // Dependency-ordered node IDs
}

let engineLoaded = false;

/**
 * Dynamically load the Rust WASM module.
 * Must be called in browser only (not during SSR).
 */
export async function loadClarityEngine(): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn('WASM engine cannot be loaded during SSR');
    return;
  }

  try {
    // TODO: Person A implements — dynamic import of WASM module
    // const wasm = await import('/wasm/clarity_engine.js');
    // await wasm.default();
    console.warn('WASM engine not loaded — using mock analysis');
    engineLoaded = false;
  } catch (error) {
    console.error('Failed to load WASM engine:', error);
    engineLoaded = false;
  }
}

/**
 * Run the full analysis pipeline on a graph.
 * Falls back to empty results if WASM is not loaded.
 */
export async function analyzeGraph(graphJson: string): Promise<WasmAnalysisResult> {
  if (!engineLoaded) {
    // Return empty analysis so Person B can develop UI without WASM
    return {
      contradictions: [],
      fallacies: [],
      biases: [],
      argumentScores: [],
      cycles: [],
      topologicalOrder: [],
    };
  }

  // TODO: Person A implements — calls into WASM module
  // const result = wasm.analyze(graphJson);
  // return JSON.parse(result) as WasmAnalysisResult;
  void graphJson;
  return {
    contradictions: [],
    fallacies: [],
    biases: [],
    argumentScores: [],
    cycles: [],
    topologicalOrder: [],
  };
}

/**
 * Check if the WASM engine has been loaded.
 */
export function isEngineLoaded(): boolean {
  return engineLoaded;
}
