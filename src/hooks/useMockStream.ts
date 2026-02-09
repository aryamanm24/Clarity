'use client';

import { useState, useCallback, useRef } from 'react';
import type { GraphState } from '@/lib/types';
import { EMPTY_GRAPH_STATE } from '@/lib/types';
import { founderPivotScenario, leaveMyJobScenario } from '@/lib/mock-data';

export const useMockStream = () => {
  const [graphState, setGraphState] = useState<GraphState>(EMPTY_GRAPH_STATE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const reset = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setGraphState(EMPTY_GRAPH_STATE);
    setIsAnalyzing(false);
    setError(null);
  }, []);

  const analyze = useCallback(
    (input: string) => {
      reset();
      setIsAnalyzing(true);

      // Pick scenario based on input keywords
      let scenario;
      const lowerInput = input.toLowerCase();
      
      if (lowerInput.includes('milk') || lowerInput.includes('cow')) {
        // Logical contradiction test
        const { logicalContradictionScenario } = require('@/lib/mock-data');
        scenario = logicalContradictionScenario;
      } else if (lowerInput.includes('bible') || lowerInput.includes('circular')) {
        // Circular reasoning test
        const { circularReasoningScenario } = require('@/lib/mock-data');
        scenario = circularReasoningScenario;
      } else if (lowerInput.includes('pivot') || lowerInput.includes('enterprise')) {
        // Founder pivot scenario
        scenario = founderPivotScenario;
      } else {
        // Leave my job scenario
        scenario = leaveMyJobScenario;
      }

      const events: { delay: number; update: Partial<GraphState> }[] = [];

      // Phase 1 (0-800ms): Propositions appear one by one
      scenario.propositions.forEach((_, i) => {
        events.push({
          delay: 200 + i * 150,
          update: {
            propositions: scenario.propositions.slice(0, i + 1),
          },
        });
      });

      // Phase 2: Relationships draw in
      const relDelay = 200 + scenario.propositions.length * 150 + 300;
      events.push({
        delay: relDelay,
        update: { relationships: scenario.relationships },
      });

      // Thought summaries
      events.push({
        delay: relDelay + 200,
        update: { thoughtSummaries: scenario.thoughtSummaries },
      });

      // Phase 3: Contradictions + fallacies
      events.push({
        delay: relDelay + 700,
        update: { contradictions: scenario.contradictions },
      });

      events.push({
        delay: relDelay + 1000,
        update: { fallacies: scenario.fallacies },
      });

      // Phase 4: Biases + scores
      events.push({
        delay: relDelay + 1400,
        update: { biases: scenario.biases },
      });

      events.push({
        delay: relDelay + 1700,
        update: { argumentScores: scenario.argumentScores },
      });

      // Phase 5: Insights + grounding results + load bearing
      events.push({
        delay: relDelay + 2200,
        update: { insights: scenario.insights },
      });

      events.push({
        delay: relDelay + 2700,
        update: { groundingResults: scenario.groundingResults },
      });

      events.push({
        delay: relDelay + 3000,
        update: { loadBearingAssumptions: scenario.loadBearingAssumptions || [] },
      });

      // Schedule all events
      events.forEach(({ delay, update }) => {
        const timeout = setTimeout(() => {
          setGraphState((prev) => ({ ...prev, ...update }));
        }, delay);
        timeoutsRef.current.push(timeout);
      });

      // Phase 6: Analysis complete
      const completeTimeout = setTimeout(() => {
        setIsAnalyzing(false);
      }, relDelay + 3200);
      timeoutsRef.current.push(completeTimeout);
    },
    [reset]
  );

  return { graphState, isAnalyzing, error, analyze, reset };
};
