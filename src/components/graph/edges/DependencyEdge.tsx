'use client';

import { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { colors } from '@/lib/design-tokens';

export const DependencyEdge = memo(({
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

  return (
    <>
      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: colors.edgeDependency,
          strokeWidth: 1.5,
          strokeDasharray: '5 5',
        }}
      />
      {/* Hover label */}
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-md bg-white px-2 py-1 text-[10px] font-medium shadow-sm border border-gray-200 text-gray-600"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontFamily: 'var(--font-jetbrains-mono)',
            }}
          >
            {data?.label ? String(data.label) : 'depends on'}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

DependencyEdge.displayName = 'DependencyEdge';
