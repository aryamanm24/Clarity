'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, fonts } from '@/lib/design-tokens';
import type { GraphState } from '@/lib/types';

interface BiasDashboardProps {
  graphState: GraphState;
  onNodeSelect?: (id: string) => void;
}

export const BiasDashboard = ({ graphState, onNodeSelect }: BiasDashboardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // System indicator: 0 biases = green, 1-2 = yellow, 3+ = red
  const systemStatus = useMemo(() => {
    const count = graphState.biases.length;
    if (count === 0) return { color: colors.evidence, label: 'System 2 Engaged', dot: 'bg-green-500' };
    if (count <= 2) return { color: colors.assumption, label: 'Mixed Signals', dot: 'bg-yellow-500' };
    return { color: colors.contradiction, label: 'System 1 Dominant', dot: 'bg-red-500' };
  }, [graphState.biases.length]);

  // Overall argument strength (average of all scores)
  const overallScore = useMemo(() => {
    if (graphState.argumentScores.length === 0) return null;
    const avg =
      graphState.argumentScores.reduce((sum, s) => sum + s.score, 0) /
      graphState.argumentScores.length;
    return avg;
  }, [graphState.argumentScores]);

  const scoreColor = overallScore
    ? overallScore > 0.7
      ? colors.evidence
      : overallScore > 0.4
        ? colors.assumption
        : colors.contradiction
    : colors.textMuted;

  // Don't render if no biases and no scores
  if (graphState.biases.length === 0 && graphState.argumentScores.length === 0) return null;

  return (
    <div className="border-b border-gray-200 bg-white shrink-0">
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-4 px-4 py-3" style={{ maxHeight: 80 }}>
              {/* Left: System indicator */}
              <div className="flex items-center gap-2 shrink-0" role="status" aria-live="polite">
                <span className={`inline-block h-3 w-3 rounded-full ${systemStatus.dot}`} />
                <span
                  className="text-xs font-medium text-clarity-text whitespace-nowrap"
                  style={{ fontFamily: fonts.system }}
                >
                  {systemStatus.label}
                </span>
              </div>

              {/* Center: Bias chips */}
              <div className="flex-1 flex gap-2 overflow-x-auto py-1 min-w-0" role="list" aria-label="Detected biases">
                {graphState.biases.map((bias) => (
                  <motion.button
                    key={bias.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors hover:opacity-80 ${
                      bias.severity === 'high'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : bias.severity === 'medium'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                    }`}
                    style={{ fontFamily: fonts.system }}
                    onClick={() => {
                      const ids = bias.affectedNodeIds ?? (bias as { affected_node_ids?: string[] }).affected_node_ids ?? [];
                      if (ids[0]) {
                        onNodeSelect?.(ids[0]);
                      }
                    }}
                    role="listitem"
                    aria-label={`${bias.name} — ${bias.severity} severity`}
                  >
                    🧠 {bias.name}
                  </motion.button>
                ))}
              </div>

              {/* Right: Overall score circle */}
              {overallScore !== null && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative h-10 w-10">
                    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-200"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={scoreColor}
                        strokeWidth="3"
                        strokeDasharray={`${overallScore * 100}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-clarity-text"
                      style={{ fontFamily: fonts.system }}
                    >
                      {(overallScore * 100).toFixed(0)}
                    </span>
                  </div>
                  <span
                    className="text-[10px] text-clarity-text-muted whitespace-nowrap"
                    style={{ fontFamily: fonts.system }}
                  >
                    Argument
                    <br />
                    Strength
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse/expand toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-center py-1 text-clarity-text-muted hover:text-clarity-text hover:bg-gray-50 transition-colors"
        aria-label={isExpanded ? 'Collapse bias dashboard' : 'Expand bias dashboard'}
      >
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
};
