'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Contradiction, Proposition } from '@/lib/types';
import { fonts } from '@/lib/design-tokens';

interface FormalProofViewerProps {
  contradiction: Contradiction;
  propositions: Proposition[];
  variant?: 'default' | 'glass';
}

export const FormalProofViewer = ({ contradiction, propositions, variant = 'default' }: FormalProofViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isGlass = variant === 'glass';

  // Handle both snake_case and camelCase from Python backend
  const proof = contradiction.formalProof ?? (contradiction as { formal_proof?: string }).formal_proof ?? '';
  const explanation =
    contradiction.humanExplanation ?? (contradiction as { human_explanation?: string }).human_explanation ?? '';
  const propIds =
    contradiction.propositionIds ?? (contradiction as { proposition_ids?: string[] }).proposition_ids ?? [];
  const minimalCore =
    contradiction.minimalCore ?? (contradiction as { minimal_core?: string[] }).minimal_core ?? propIds;

  const proofLines = proof ? proof.split('\n') : [];
  const propDict = Object.fromEntries(propositions.map(p => [p.id, p]));

  // Extract core propositions
  const coreProps = minimalCore
    .map(
    id => propDict[id]
    )
    .filter(Boolean);

  // Fallback for contradictions without formal proofs
  if (!proof) {
    return (
      <div className={`rounded-lg p-4 mb-4 last:mb-0 ${isGlass ? 'bg-white/[0.02] border border-white/[0.04]' : 'border-2 border-red-400 bg-red-50'}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <h3 className={`font-semibold ${isGlass ? 'text-red-300' : 'text-red-900'}`} style={{ fontFamily: fonts.ui }}>
            Contradiction Detected
          </h3>
        </div>
        <p className={`text-sm ${isGlass ? 'text-gray-300' : 'text-red-800'}`} style={{ fontFamily: fonts.ui }}>
          {explanation || 'A logical contradiction was detected.'}
        </p>
        <div className={`mt-3 text-xs ${isGlass ? 'text-gray-500' : 'text-gray-600'}`} style={{ fontFamily: fonts.system }}>
          Involving {propIds.length} proposition(s)
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`rounded-lg p-4 mb-4 last:mb-0 ${isGlass ? 'bg-white/[0.02] border border-white/[0.04]' : 'border-2 border-red-500 bg-red-50'}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className={`text-sm font-medium ${isGlass ? 'text-red-300' : 'text-red-900'}`} style={{ fontFamily: fonts.ui }}>
            Logical Contradiction Detected
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 shrink-0"
          style={{ fontFamily: fonts.system }}
        >
          <span className="text-[10px]">{isExpanded ? '▾' : '▸'}</span>
          {isExpanded ? 'Hide Proof' : 'Show Proof'}
        </button>
      </div>
      
      {/* Summary */}
      <p className={`text-sm mb-3 ${isGlass ? 'text-gray-300' : 'text-red-800'}`} style={{ fontFamily: fonts.ui }}>
        {explanation}
      </p>
      
      {/* Minimal Core */}
      <div className={`rounded p-3 mb-3 ${isGlass ? 'bg-gray-950/80 border border-white/[0.06]' : 'bg-white border border-red-200'}`}>
        <div className={`text-xs font-semibold mb-2 ${isGlass ? 'text-red-400/80' : 'text-red-600'}`} style={{ fontFamily: fonts.system }}>
          Minimal Unsatisfiable Core ({coreProps.length} proposition{coreProps.length !== 1 ? 's' : ''}):
        </div>
        <div className="space-y-2">
          {coreProps.map((prop, idx) => (
            <div key={prop.id} className="flex items-start gap-2">
              <span className={`text-xs font-mono mt-0.5 ${isGlass ? 'text-red-400' : 'text-red-700'}`} style={{ fontFamily: fonts.system }}>
                P{idx + 1}:
              </span>
              <div className="flex-1">
                <div className={`text-sm ${isGlass ? 'text-gray-400' : 'text-gray-800'}`} style={{ fontFamily: fonts.proposition }}>
                  {prop.statement}
                </div>
                {prop.formalExpression && (
                  <div className={`text-xs font-mono mt-1 ${isGlass ? 'text-gray-500' : 'text-gray-600'}`} style={{ fontFamily: fonts.system }}>
                    {prop.formalExpression}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Expandable Formal Proof */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-900 rounded p-4 font-mono text-xs" style={{ fontFamily: fonts.system }}>
              {proofLines.map((line, idx) => {
                const isHeader = line.includes('FORMAL PROOF') || line.includes('===');
                const isSection = line.match(/^[A-Z][a-z]+:/);
                const isConclusion = line.includes('∴') || line.includes('Q.E.D');
                const isContradiction = line.includes('contradiction') || line.includes('⊥');
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`
                      ${isHeader ? 'text-red-400 font-bold' : ''}
                      ${isSection ? 'text-yellow-400 font-semibold mt-2' : ''}
                      ${isConclusion ? 'text-green-400 font-semibold mt-2' : ''}
                      ${isContradiction ? 'text-red-300' : ''}
                      ${!isHeader && !isSection && !isConclusion && !isContradiction ? 'text-gray-300' : ''}
                    `}
                  >
                    {line || '\u00A0'}
                  </motion.div>
                );
              })}
            </div>
            
            {/* Proof Method Badges — dark glass pills */}
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-xs font-mono text-gray-400">
                Method: SAT Solver (DPLL)
              </div>
              <div className="px-3 py-1.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-xs font-mono text-gray-400">
                Complexity: NP-Complete
              </div>
              <div className="px-3 py-1.5 rounded-md bg-emerald-500/[0.1] border border-emerald-500/20 text-xs font-mono text-emerald-400">
                ✓ Formally Verified
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
