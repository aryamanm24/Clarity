'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { colors } from '@/lib/design-tokens';

export const SupportEdge = memo(({
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
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(1000);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [edgePath]);

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
      {/* Visible path with draw animation */}
      <path
        ref={pathRef}
        id={id}
        d={edgePath}
        fill="none"
        stroke={colors.edgeSupport}
        strokeWidth={isHovered ? 3 : 2}
        markerEnd={markerEnd as string}
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength}
        style={{
          animation: 'edge-draw 600ms ease-out forwards',
          transition: 'stroke-width 0.2s ease',
        }}
      />
      {/* Hover label at midpoint */}
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-md bg-white px-2 py-1 text-[10px] font-medium shadow-sm border border-green-200 text-green-700"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontFamily: 'var(--font-jetbrains-mono)',
            }}
          >
            {data?.label ? String(data.label) : 'supports'}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

SupportEdge.displayName = 'SupportEdge';
