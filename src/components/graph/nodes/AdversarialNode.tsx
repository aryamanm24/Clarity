'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { colors, fonts, nodeConfig } from '@/lib/design-tokens';
import type { Proposition, CognitiveBias } from '@/lib/types';

interface AdversarialNodeData extends Proposition {
  biases?: CognitiveBias[];
  isDimmed?: boolean;
}

export const AdversarialNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as AdversarialNodeData;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: d.isDimmed ? 0.25 : 1, scale: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
      className="cursor-pointer rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow"
      style={{
        borderLeft: `${nodeConfig.borderWidth}px solid ${colors.adversarial}`,
        width: 320,
        padding: nodeConfig.padding,
        borderRadius: nodeConfig.borderRadius,
      }}
      aria-label={`Adversarial mirror: ${d.statement}`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: colors.adversarial }} />

      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base" role="img" aria-label="Adversarial">⚔️</span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: colors.adversarial, fontFamily: fonts.system }}
        >
          Adversarial Mirror
        </span>
      </div>

      {/* Counterargument */}
      <p
        className="text-sm leading-relaxed text-clarity-text"
        style={{ fontFamily: fonts.proposition }}
      >
        {d.statement}
      </p>

      {/* Key question (using formal expression as the resolver question) */}
      {d.formalExpression && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <p
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700"
            style={{ fontFamily: fonts.system }}
          >
            Key Question
          </p>
          <p
            className="text-xs leading-relaxed text-amber-900"
            style={{ fontFamily: fonts.system }}
          >
            {d.formalExpression}
          </p>
        </div>
      )}

      {/* Bias badges */}
      {d.biases && d.biases.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.biases.map((bias) => (
            <span
              key={bias.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: colors.bias, fontFamily: fonts.system }}
              title={bias.kahnemanReference}
            >
              🧠 {bias.name}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: colors.adversarial }} />
    </motion.div>
  );
});

AdversarialNode.displayName = 'AdversarialNode';
