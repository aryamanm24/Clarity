'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Fallacy, Proposition } from '@/lib/types';
import { fonts } from '@/lib/design-tokens';

interface CircularReasoningViewerProps {
  fallacy: Fallacy;
  propositions: Proposition[];
  variant?: 'default' | 'glass';
}

export const CircularReasoningViewer = ({ fallacy, propositions, variant = 'default' }: CircularReasoningViewerProps) => {
  const propDict = Object.fromEntries(propositions.map(p => [p.id, p]));
  const isGlass = variant === 'glass';
  const cyclePath =
    fallacy.proofPath ??
    (fallacy as { proof_path?: string[] }).proof_path ??
    fallacy.affectedNodeIds ??
    (fallacy as { affected_node_ids?: string[] }).affected_node_ids ??
    [];
const cycleProps = cyclePath.map(id => propDict[id]).filter(Boolean);

  if (cycleProps.length === 0) {
    return (
      <div className={`rounded-lg p-4 mb-3 last:mb-0 ${isGlass ? 'bg-white/[0.02] border border-white/[0.04]' : 'border-2 border-orange-400 bg-orange-50'}`}>
        <div className={`font-semibold mb-2 ${isGlass ? 'text-amber-300' : 'text-orange-900'}`} style={{ fontFamily: fonts.ui }}>
          {fallacy.name}
        </div>
        <p className={`text-sm ${isGlass ? 'text-gray-400' : 'text-orange-800'}`} style={{ fontFamily: fonts.ui }}>
          {fallacy.description}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={`rounded-lg p-4 mb-3 last:mb-0 ${isGlass ? 'bg-white/[0.02] border border-white/[0.04]' : 'border-2 border-orange-500 bg-orange-50'}`}
      initial={{ opacity: 0, rotate: -5 }}
      animate={{ opacity: 1, rotate: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="text-2xl">🔄</div>
        <h3 className={`font-semibold ${isGlass ? 'text-amber-300' : 'text-orange-900'}`} style={{ fontFamily: fonts.ui }}>
          {fallacy.name}
        </h3>
      </div>
      
      <p className={`text-sm mb-4 ${isGlass ? 'text-gray-400' : 'text-orange-800'}`} style={{ fontFamily: fonts.ui }}>
        {fallacy.description.split('\n')[0]}
      </p>
      
      {/* Cycle Visualization */}
      <div className={`rounded p-4 ${isGlass ? 'bg-white/[0.02] border border-white/[0.04]' : 'bg-white border border-orange-200'}`}>
        <div className={`text-xs font-semibold mb-3 ${isGlass ? 'text-amber-400' : 'text-orange-600'}`} style={{ fontFamily: fonts.system }}>
          Detected Cycle (length: {cycleProps.length}):
        </div>
        
        <div className="space-y-3">
          {cycleProps.map((prop, idx) => (
            <React.Fragment key={`cycle-step-${idx}-${prop.id}`}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.2 }}
                className="flex items-start gap-2"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className={`text-sm ${isGlass ? 'text-gray-400' : 'text-gray-800'}`} style={{ fontFamily: fonts.proposition }}>
                    {prop.statement}
                  </div>
                </div>
              </motion.div>
              
              {idx < cycleProps.length - 1 && (
                <motion.div
                  key={`arrow-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.2 + 0.1 }}
                  className="ml-3 text-orange-600 text-sm"
                  style={{ fontFamily: fonts.ui }}
                >
                  ↓ supports
                </motion.div>
              )}
            </React.Fragment>
          ))}
          
          {/* Loop back arrow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: cycleProps.length * 0.2 }}
            className="ml-3 text-orange-600 text-sm font-semibold"
            style={{ fontFamily: fonts.ui }}
          >
            ↺ loops back to (1)
          </motion.div>
        </div>
      </div>
      
      <div className={`mt-3 text-xs flex items-center gap-2 ${isGlass ? 'text-gray-500' : 'text-gray-600'}`} style={{ fontFamily: fonts.system }}>
        <div className={`px-2 py-1 rounded border ${isGlass ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-100 border-gray-300'}`}>
          Detection Method: DFS Cycle Detection
        </div>
        <div className={`px-2 py-1 rounded border ${isGlass ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-100 border-gray-300'}`}>
          Graph Theory Algorithm
        </div>
      </div>
    </motion.div>
  );
};
