'use client';

import { memo, useState } from 'react';
import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { colors } from '@/lib/design-tokens';

export const ContradictionEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const [isHovered, setIsHovered] = useState(false);
  const severity = data?.severity ? String(data.severity) : 'major';
  const isInMinimalCore = data?.isInMinimalCore || false;

  return (
    <>
      {/* Enhanced glow for minimal core */}
      {isInMinimalCore && (
        <path
          d={edgePath}
          fill="none"
          stroke="#dc2626"
          strokeWidth={12}
          strokeOpacity={0.3}
          style={{
            animation: 'glow-pulse 1s ease-in-out infinite',
          }}
        />
      )}
      {/* Glow layer — pulsing red glow */}
      <path
        d={edgePath}
        fill="none"
        stroke={isInMinimalCore ? '#dc2626' : colors.edgeContradiction}
        strokeWidth={8}
        strokeOpacity={0.15}
        style={{
          animation: 'glow-pulse 2s ease-in-out infinite',
        }}
      />
      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {/* Main line — marching ants animation */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={isInMinimalCore ? '#dc2626' : colors.edgeContradiction}
        strokeWidth={isInMinimalCore ? 4 : 3}
        strokeDasharray="8 4"
        markerEnd={markerEnd as string}
        style={{
          animation: 'marching-ants 1s linear infinite',
        }}
      />
      {/* Midpoint warning badge */}
      <EdgeLabelRenderer>
        <div
          className={`absolute pointer-events-auto cursor-pointer flex items-center gap-1 rounded-full px-2 py-1 shadow-md border transition-all duration-200 ${
            isHovered ? 'scale-110' : 'scale-100'
          }`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            backgroundColor: isInMinimalCore ? '#FEE2E2' : '#FEF2F2',
            borderColor: isInMinimalCore ? '#dc2626' : colors.edgeContradiction,
            fontFamily: 'var(--font-jetbrains-mono)',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role="status"
          aria-label={`Contradiction — ${severity}${isInMinimalCore ? ' (Minimal Core)' : ''}`}
        >
          <span className="text-xs">{isInMinimalCore ? '‼️' : '⚠️'}</span>
          {isHovered && (
            <span className="text-[10px] font-medium text-red-700 whitespace-nowrap">
              {isInMinimalCore ? 'UNSAT CORE' : `CONTRADICTION — ${severity}`}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ContradictionEdge.displayName = 'ContradictionEdge';
