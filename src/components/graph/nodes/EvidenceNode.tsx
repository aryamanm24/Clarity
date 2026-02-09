'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';

export function EvidenceNode({ data }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="
        relative w-[280px] min-h-[100px] p-3 rounded-lg border-2
        bg-green-50 dark:bg-green-950/30 border-green-400 dark:border-green-500
        shadow-lg shadow-green-500/10 backdrop-blur-sm
      "
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-green-500"
      />
      
      <div className="flex items-start gap-2 mb-2">
        <div className="px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300">
          Evidence
        </div>
      </div>
      
      <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
        {data.statement}
      </p>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-green-500"
      />
    </motion.div>
  );
}
