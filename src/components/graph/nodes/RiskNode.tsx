'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { colors, fonts, nodeConfig } from '@/lib/design-tokens';
import type { Proposition, ArgumentScore } from '@/lib/types';

interface RiskNodeData extends Proposition {
  score?: ArgumentScore;
  isDimmed?: boolean;
}

export const RiskNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as RiskNodeData;
  const [showFormal, setShowFormal] = useState(false);

  // Use risk color for risk type, peripheral for constraint
  const nodeColor = d.type === 'risk' ? colors.risk : colors.peripheral;
  const typeLabel = d.type === 'risk' ? 'Risk' : 'Constraint';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: d.isDimmed ? 0.25 : 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="cursor-pointer rounded-xl bg-white shadow-md hover:shadow-lg transition-shadow"
      style={{
        borderLeft: `${nodeConfig.borderWidth}px solid ${nodeColor}`,
        width: nodeConfig.width,
        minHeight: nodeConfig.minHeight,
        padding: nodeConfig.padding,
        borderRadius: nodeConfig.borderRadius,
      }}
      onClick={() => setShowFormal(!showFormal)}
      aria-label={`${typeLabel}: ${d.statement}`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: nodeColor }} />

      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base" role="img" aria-label={typeLabel}>⚠️</span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
          style={{ backgroundColor: nodeColor, fontFamily: fonts.system }}
        >
          {typeLabel}
        </span>
        {d.confidence && (
          <span
            className="ml-auto text-[10px] text-clarity-text-muted"
            style={{ fontFamily: fonts.system }}
          >
            {d.confidence}
          </span>
        )}
      </div>

      {/* Statement */}
      <p
        className="text-sm leading-relaxed text-clarity-text"
        style={{ fontFamily: fonts.proposition }}
      >
        {d.statement}
      </p>

      {/* Formal expression (collapsed) */}
      {showFormal && d.formalExpression && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 rounded-md bg-gray-50 p-2"
        >
          <code
            className="text-[11px] text-clarity-text-secondary break-all leading-relaxed"
            style={{ fontFamily: fonts.system }}
          >
            {d.formalExpression}
          </code>
        </motion.div>
      )}

      {/* Score bar */}
      {d.score && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${d.score.score * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  d.score.score > 0.6 ? colors.evidence : d.score.score > 0.3 ? colors.assumption : colors.contradiction,
              }}
            />
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: nodeColor }} />
    </motion.div>
  );
});

RiskNode.displayName = 'RiskNode';
