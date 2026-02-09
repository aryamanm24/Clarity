'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { colors } from '@/lib/design-tokens';

export const AdversarialEdge = memo(({
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
        stroke={colors.edgeAdversarial}
        strokeWidth={2.5}
        strokeDasharray="12 6"
        markerEnd={markerEnd as string}
        strokeDashoffset={pathLength}
        style={{
          animation: 'edge-draw 600ms ease-out forwards',
        }}
      />
      {/* Midpoint sword icon */}
      <EdgeLabelRenderer>
        <div
          className="pointer-events-auto absolute cursor-pointer"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span className="text-sm" role="img" aria-label="Attacks">⚔️</span>
          {isHovered && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium shadow-sm border border-orange-200 text-orange-700 whitespace-nowrap"
              style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
            >
              {data?.label ? String(data.label) : 'attacks'}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

AdversarialEdge.displayName = 'AdversarialEdge';
