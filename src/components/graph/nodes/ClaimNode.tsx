'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';

export function ClaimNode({ data }: any) {
  const isContradiction = data.isInContradiction;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        relative w-[300px] min-h-[120px] p-4 rounded-xl border-2
        ${isContradiction 
          ? 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-500 shadow-red-500/20' 
          : 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500 shadow-blue-500/20'
        }
        shadow-lg backdrop-blur-sm
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500"
      />
      
      <div className="flex items-start gap-2 mb-2">
        <div className={`
          px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide
          ${isContradiction 
            ? 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300' 
            : 'bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
          }
        `}>
          Claim
        </div>
        
        {data.confidence && (
          <div className="ml-auto text-xs font-mono text-gray-600 dark:text-gray-400">
            {typeof data.confidence === 'number' 
              ? Math.round(data.confidence * 100) 
              : data.confidence}%
          </div>
        )}
      </div>
      
      <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
        {data.statement}
      </p>
      
      {(data.formal_expression || data.formalExpression) && (
        <div className="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
          {data.formal_expression || data.formalExpression}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500"
      />
    </motion.div>
  );
}
