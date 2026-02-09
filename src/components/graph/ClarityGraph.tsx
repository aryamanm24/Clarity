'use client';

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { GitBranch, Circle } from 'lucide-react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { computeLayout, computeRadialLayout, type LayoutMode } from '@/lib/graph-layout';
import type { GraphState, Relationship, ArgumentScore, GroundingResult, CognitiveBias } from '@/lib/types';
import { colors } from '@/lib/design-tokens';

import { ClaimNode } from './nodes/ClaimNode';
import { EvidenceNode } from './nodes/EvidenceNode';
import { AssumptionNode } from './nodes/AssumptionNode';

// Simplified node types for cleaner UI
const nodeTypes: NodeTypes = {
  claim: ClaimNode,
  evidence: EvidenceNode,
  assumption: AssumptionNode,
  // Fallback types use claim styling
  conclusion: ClaimNode,
  premise: ClaimNode,
  constraint: AssumptionNode,
  risk: AssumptionNode,
};

// Edge styling hierarchy: contradictions prominent, supports subtle, assumes dashed
const edgeStyles: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  supports: { stroke: 'rgba(34, 197, 94, 0.6)', strokeWidth: 1.5 },
  contradicts: { stroke: '#ef4444', strokeWidth: 2.5, strokeDasharray: '8 4' },
  assumes: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '6 3' },
  weakens: { stroke: 'rgba(249, 115, 22, 0.6)', strokeWidth: 2, strokeDasharray: '4 4' },
  depends_on: { stroke: 'rgba(148, 163, 184, 0.5)', strokeWidth: 1.5 },
  attacks: { stroke: 'rgba(249, 115, 22, 0.6)', strokeWidth: 2 },
};
const defaultEdgeStyle = { stroke: 'rgba(148, 163, 184, 0.4)', strokeWidth: 1 };

// Edge labels by type
const edgeLabels: Record<string, string> = {
  contradicts: '✕ contradicts',
  supports: 'supports',
  assumes: 'assumes',
  weakens: 'weakens',
  depends_on: 'depends on',
  attacks: 'attacks',
};

// Helper to get connected nodes
const getFromTo = (r: Relationship & { from?: string; to?: string; source?: string; target?: string }) => ({
  from: (r.fromId ?? (r as { from_id?: string }).from_id ?? r.source ?? r.from ?? '') as string,
  to: (r.toId ?? (r as { to_id?: string }).to_id ?? r.target ?? r.to ?? '') as string,
});

const getConnectedNodeIds = (nodeId: string, relationships: Relationship[]): Set<string> => {
  const connected = new Set<string>();
  connected.add(nodeId);
  relationships.forEach((rel) => {
    const { from: f, to: t } = getFromTo(rel);
    if (f === nodeId) connected.add(t);
    if (t === nodeId) connected.add(f);
  });
  return connected;
};

// -- Types --

interface ClarityGraphProps {
  graphState: GraphState;
  onNodeSelect?: (propositionId: string | null) => void;
  selectedNodeId?: string | null;
  isAnalyzing?: boolean;
}

// -- FitView helper (rendered inside ReactFlow) --

const FitViewOnChange = ({ nodeCount, layoutMode }: { nodeCount: number; layoutMode: LayoutMode }) => {
  const { fitView } = useReactFlow();
  const prevCountRef = useRef(0);
  const prevLayoutRef = useRef<LayoutMode>(layoutMode);

  useEffect(() => {
    if (nodeCount === 0) return;
    const layoutChanged = layoutMode !== prevLayoutRef.current;
    const countChanged = nodeCount !== prevCountRef.current;
    if (!layoutChanged && !countChanged) return;
    prevCountRef.current = nodeCount;
    prevLayoutRef.current = layoutMode;
    const delay = layoutChanged ? 650 : 100;
    const timer = setTimeout(() => {
      fitView({ padding: 0.4, maxZoom: 1.0, minZoom: 0.3, duration: 600 });
    }, delay);
    return () => clearTimeout(timer);
  }, [nodeCount, layoutMode, fitView]);

  return null;
};

// -- Loading skeleton --

const LoadingSkeleton = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="flex gap-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-56 h-20 rounded-xl bg-gray-200/60 skeleton-node"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
    </div>
  </div>
);

// -- Inner graph component --

// Layout toggle toolbar
const LayoutToolbar = ({
  layoutMode,
  onLayoutChange,
}: {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
}) => {
  const active = 'bg-blue-600 dark:bg-gray-800 text-white';
  const inactive =
    'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white';
  return (
    <div
      className="absolute top-4 left-4 z-20 flex rounded-full border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm overflow-hidden"
      role="group"
      aria-label="Layout mode"
    >
      <button
        type="button"
        onClick={() => onLayoutChange('dagre')}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-0 ${layoutMode === 'dagre' ? active : inactive}`}
        aria-pressed={layoutMode === 'dagre'}
      >
        <GitBranch className="w-3 h-3" />
        Tree
      </button>
      <button
        type="button"
        onClick={() => onLayoutChange('radial')}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-0 ${layoutMode === 'radial' ? active : inactive}`}
        aria-pressed={layoutMode === 'radial'}
      >
        <Circle className="w-3 h-3" />
        Radial
      </button>
    </div>
  );
};

const ClarityGraphInner = ({
  graphState,
  onNodeSelect,
  selectedNodeId,
  isAnalyzing,
}: ClarityGraphProps) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showContradictionFlash, setShowContradictionFlash] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('dagre');
  const prevContradictionCountRef = useRef(0);

  // Contradiction flash when new contradictions arrive
  useEffect(() => {
    if (graphState.contradictions.length > prevContradictionCountRef.current) {
      setShowContradictionFlash(true);
      const timer = setTimeout(() => setShowContradictionFlash(false), 300);
      prevContradictionCountRef.current = graphState.contradictions.length;
      return () => clearTimeout(timer);
    }
    prevContradictionCountRef.current = graphState.contradictions.length;
  }, [graphState.contradictions.length]);

  // Compute connected nodes for hover dimming
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    return getConnectedNodeIds(hoveredNodeId, graphState.relationships);
  }, [hoveredNodeId, graphState.relationships]);

  // Build lookup maps for scores, grounding, biases
  const scoreMap = useMemo(() => {
    const map = new Map<string, ArgumentScore>();
    (graphState.argumentScores || []).forEach((s) => map.set(s.propositionId, s));
    return map;
  }, [graphState.argumentScores]);

  const groundingMap = useMemo(() => {
    const map = new Map<string, GroundingResult>();
    (graphState.groundingResults || []).forEach((g) => map.set(g.propositionId, g));
    return map;
  }, [graphState.groundingResults]);

  const biasMap = useMemo(() => {
    const map = new Map<string, CognitiveBias[]>();
    graphState.biases.forEach((b) => {
      (b.affectedNodeIds ?? (b as { affected_node_ids?: string[] }).affected_node_ids ?? []).forEach((nodeId) => {
        const existing = map.get(nodeId) || [];
        existing.push(b);
        map.set(nodeId, existing);
      });
    });
    return map;
  }, [graphState.biases]);

  // Convert propositions to React Flow nodes (Dagre or Radial based on layoutMode)
  const nodes: Node[] = useMemo(() => {
    if (graphState.propositions.length === 0) return [];
    const layoutResult =
      layoutMode === 'radial'
        ? computeRadialLayout(graphState.propositions, graphState.relationships)
        : computeLayout(graphState.propositions, graphState.relationships);
    const { nodes: layoutNodes } = layoutResult;
    return layoutNodes.map((n) => {
      const isDimmed = connectedNodeIds ? !connectedNodeIds.has(n.id) : false;
      return {
        id: n.id,
        type: n.data.type,
        position: n.position,
        style: {
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        data: {
          ...n.data,
          score: scoreMap.get(n.id),
          groundingResult: groundingMap.get(n.id),
          biases: biasMap.get(n.id),
          isDimmed,
          isSelected: selectedNodeId === n.id,
        } as Record<string, unknown>,
      };
    });
  }, [
    graphState.propositions,
    graphState.relationships,
    layoutMode,
    connectedNodeIds,
    scoreMap,
    groundingMap,
    biasMap,
    selectedNodeId,
  ]);

  // Convert relationships to React Flow edges with styling hierarchy and labels
  // Radial view: use bezier for all edges (smoothstep looks weird with non-axis-aligned nodes)
  const edges: Edge[] = useMemo(() => {
    const relType = (t: string) => (t ?? '').toLowerCase();
    return graphState.relationships
      .filter((rel) => {
        const { from: f, to: t } = getFromTo(rel);
        return !!(f && t);
      })
      .map((rel) => {
        const { from: source, to: target } = getFromTo(rel);
        const typeKey = relType(rel.type ?? '');
        const style = edgeStyles[typeKey] ?? defaultEdgeStyle;
        const isContradicts = typeKey === 'contradicts';
        const edgeType = layoutMode === 'radial' ? 'default' : isContradicts ? 'default' : 'smoothstep';
        const label = edgeLabels[typeKey] ?? '';
        return {
          id: rel.id,
          source,
          target,
          type: edgeType,
          data: { ...rel } as Record<string, unknown>,
          animated: isContradicts,
          style: {
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            strokeDasharray: style.strokeDasharray,
          },
          label: label || undefined,
          labelShowBg: !!label,
          labelStyle: {
            fontSize: 10,
            fontWeight: isContradicts ? 600 : 400,
            fill: isContradicts ? '#ef4444' : 'rgba(148, 163, 184, 0.8)',
          },
          labelBgStyle: { fill: 'rgba(15, 23, 42, 0.8)', fillOpacity: 0.8 },
          labelBgPadding: [4, 8] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: style.stroke,
            width: 15,
            height: 15,
          },
        };
      });
  }, [graphState.relationships, layoutMode]);

  // Event handlers
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id === selectedNodeId ? null : node.id);
    },
    [onNodeSelect, selectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setHoveredNodeId(node.id);
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const showSkeleton = isAnalyzing && graphState.propositions.length === 0;

  return (
    <div className="relative h-full w-full">
      {/* Layout toggle toolbar */}
      {graphState.propositions.length > 0 && (
        <LayoutToolbar layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
      )}
      {/* Contradiction flash overlay */}
      {showContradictionFlash && (
        <div
          className="pointer-events-none absolute inset-0 z-50"
          style={{
            boxShadow: `inset 0 0 60px ${colors.edgeContradiction}40, inset 0 0 120px ${colors.edgeContradiction}20`,
            animation: 'contradiction-flash 300ms ease-out forwards',
          }}
          aria-hidden="true"
        />
      )}

      {/* Loading skeleton */}
      {showSkeleton && <LoadingSkeleton />}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 1.0, minZoom: 0.3, duration: 600 }}
        minZoom={0.4}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 2 },
        }}
      >
        <FitViewOnChange nodeCount={graphState.propositions.length} layoutMode={layoutMode} />
        <Background color="#E5E7EB" gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

// -- Exported component with ReactFlowProvider wrapper --

export const ClarityGraph = (props: ClarityGraphProps) => (
  <ReactFlowProvider>
    <ClarityGraphInner {...props} />
  </ReactFlowProvider>
);
