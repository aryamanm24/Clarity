import dagre from 'dagre';
import type { Proposition, Relationship } from './types';
import { nodeConfig } from './design-tokens';

// ============================================================
// Graph Layout — Dagre Hierarchical Layout
// ============================================================

export interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  data: Proposition;
  width?: number;
  height?: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  data: Relationship;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export type LayoutMode = 'dagre' | 'radial';

const fromTo = (r: Relationship & { from?: string; to?: string; source?: string; target?: string }) => ({
  from: r.fromId ?? (r as { from_id?: string }).from_id ?? r.source ?? r.from ?? '',
  to: r.toId ?? (r as { to_id?: string }).to_id ?? r.target ?? r.to ?? '',
});

// Per-type node dimensions: main claims larger, assumptions/constraints compact
const getNodeDimensions = (type: string, connectionCount: number) => {
  const isMainClaim = type === 'claim' && connectionCount >= 2;
  if (isMainClaim) return { width: 280, height: 80 };
  if (type === 'claim') return { width: 240, height: 70 };
  if (type === 'evidence') return { width: 220, height: 60 };
  return { width: 200, height: 56 }; // assumptions, constraints, etc.
};

const PADDING = 20; // Minimum gap between node edges

// Post-layout overlap removal
const removeOverlaps = (
  nodes: LayoutNode[],
  dimensions: Map<string, { width: number; height: number }>
): LayoutNode[] => {
  const result = nodes.map((n) => ({
    ...n,
    position: { ...n.position },
  }));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i];
      const b = result[j];
      const aDim = dimensions.get(a.id) ?? { width: 240, height: 70 };
      const bDim = dimensions.get(b.id) ?? { width: 240, height: 70 };
      const aW = aDim.width / 2 + PADDING;
      const aH = aDim.height / 2 + PADDING;
      const bW = bDim.width / 2 + PADDING;
      const bH = bDim.height / 2 + PADDING;

      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const overlapX = aW + bW - Math.abs(dx);
      const overlapY = aH + bH - Math.abs(dy);

      if (overlapX > 0 && overlapY > 0) {
        const shiftX = overlapX / 2;
        const shiftY = overlapY / 2;
        if (overlapX < overlapY) {
          const sign = dx > 0 ? 1 : -1;
          a.position.x -= sign * shiftX;
          b.position.x += sign * shiftX;
        } else {
          const sign = dy > 0 ? 1 : -1;
          a.position.y -= sign * shiftY;
          b.position.y += sign * shiftY;
        }
      }
    }
  }
  return result;
};

/**
 * Simple grid fallback when dagre fails (e.g. "intersection inside rectangle" error).
 */
const computeGridLayout = (
  propositions: Proposition[],
  relationships: Relationship[],
  connectivity: Map<string, number>
): LayoutResult => {
  const colWidth = 240 + 80;
  const rowHeight = 70 + 60;
  const cols = Math.ceil(Math.sqrt(propositions.length)) || 1;

  const nodes: LayoutNode[] = propositions.map((prop, i) => {
    const conn = connectivity.get(prop.id) ?? 0;
    const dim = getNodeDimensions(prop.type ?? 'claim', conn);
    return {
      id: prop.id,
      position: {
        x: (i % cols) * colWidth,
        y: Math.floor(i / cols) * rowHeight,
      },
      data: prop,
      width: dim.width,
      height: dim.height,
    };
  });

  const propIds = new Set(propositions.map((p) => p.id));
  const edges: LayoutEdge[] = relationships
    .filter((rel) => {
      const { from, to } = fromTo(rel);
      return from && to && from !== to && propIds.has(from) && propIds.has(to);
    })
    .map((rel) => {
      const { from, to } = fromTo(rel);
      return { id: rel.id, source: from, target: to, data: rel };
    });

  return { nodes, edges };
};

/**
 * Compute radial layout: center = most important claim, inner ring = directly connected, outer ring = rest.
 * Uses radii proportional to node count and size to prevent overlap.
 */
export const computeRadialLayout = (
  propositions: Proposition[],
  relationships: Relationship[]
): LayoutResult => {
  const positions = new Map<string, { x: number; y: number }>();
  const propIds = new Set(propositions.map((p) => p.id));

  if (propositions.length === 0) {
    return { nodes: [], edges: [] };
  }

  const NODE_WIDTH = 280;
  const NODE_HEIGHT = 90;
  const PADDING = 40;

  // Connectivity
  const connectivity = new Map<string, number>();
  propositions.forEach((p) => connectivity.set(p.id, 0));
  relationships.forEach((r) => {
    const { from, to } = fromTo(r);
    if (from && propIds.has(from)) connectivity.set(from, (connectivity.get(from) ?? 0) + 1);
    if (to && propIds.has(to)) connectivity.set(to, (connectivity.get(to) ?? 0) + 1);
  });

  const scored = [...propositions]
    .map((p) => ({
      ...p,
      score: (p.type === 'claim' ? 50 : 0) + (connectivity.get(p.id) ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  const centerNode = scored[0];
  const remaining = scored.slice(1);

  // Center connections
  const centerConnections = new Set<string>();
  relationships.forEach((r) => {
    const { from, to } = fromTo(r);
    if (from === centerNode.id && propIds.has(to)) centerConnections.add(to);
    if (to === centerNode.id && propIds.has(from)) centerConnections.add(from);
  });

  const innerNodes: (typeof scored)[0][] = remaining.filter((p) => centerConnections.has(p.id));
  const outerNodes: (typeof scored)[0][] = remaining.filter((p) => !centerConnections.has(p.id));

  // If everything connects to center, split evenly between rings
  if (outerNodes.length === 0 && innerNodes.length > 5) {
    const half = Math.ceil(innerNodes.length / 2);
    outerNodes.push(...innerNodes.splice(half));
  }

  if (innerNodes.length === 0) {
    innerNodes.push(...outerNodes.splice(0));
  }

  // Minimum radius so circumference fits N * (NODE_WIDTH + PADDING)
  const calcMinRadius = (nodeCount: number): number => {
    if (nodeCount === 0) return 0;
    if (nodeCount === 1) return NODE_WIDTH + PADDING;
    const circumference = nodeCount * (NODE_WIDTH + PADDING);
    return Math.max(circumference / (2 * Math.PI), NODE_WIDTH * 1.5);
  };

  const innerRadius = calcMinRadius(innerNodes.length);
  const outerRadius =
    outerNodes.length > 0
      ? innerRadius + calcMinRadius(outerNodes.length) * 0.6 + NODE_HEIGHT + PADDING
      : 0;

  const canvasSize = Math.max(
    outerRadius * 2 + NODE_WIDTH * 2,
    innerRadius * 2 + NODE_WIDTH * 2,
    800
  );
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // Center node (top-left)
  positions.set(centerNode.id, {
    x: cx - NODE_WIDTH / 2,
    y: cy - NODE_HEIGHT / 2,
  });

  // Inner ring
  innerNodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / innerNodes.length - Math.PI / 2;
    positions.set(node.id, {
      x: cx + innerRadius * Math.cos(angle) - NODE_WIDTH / 2,
      y: cy + innerRadius * Math.sin(angle) - NODE_HEIGHT / 2,
    });
  });

  // Outer ring
  outerNodes.forEach((node, i) => {
    let baseAngle = (2 * Math.PI * i) / Math.max(outerNodes.length, 1) - Math.PI / 4;

    const connectedInnerNode = innerNodes.find((inner) =>
      relationships.some((r) => {
        const { from, to } = fromTo(r);
        return (from === node.id && to === inner.id) || (to === node.id && from === inner.id);
      })
    );

    if (connectedInnerNode) {
      const innerPos = positions.get(connectedInnerNode.id);
      if (innerPos) {
        const innerCenterX = innerPos.x + NODE_WIDTH / 2;
        const innerCenterY = innerPos.y + NODE_HEIGHT / 2;
        baseAngle = Math.atan2(innerCenterY - cy, innerCenterX - cx);

        const siblings = outerNodes.filter((o) =>
          relationships.some((r) => {
            const { from, to } = fromTo(r);
            return (
              (from === o.id && to === connectedInnerNode.id) ||
              (to === o.id && from === connectedInnerNode.id)
            );
          })
        );
        const siblingIndex = siblings.findIndex((o) => o.id === node.id);
        if (siblings.length > 1 && siblingIndex >= 0) {
          const spread = 0.5;
          baseAngle += (siblingIndex - (siblings.length - 1) / 2) * spread;
        }
      }
    }

    positions.set(node.id, {
      x: cx + outerRadius * Math.cos(baseAngle) - NODE_WIDTH / 2,
      y: cy + outerRadius * Math.sin(baseAngle) - NODE_HEIGHT / 2,
    });
  });

  // Overlap removal (3 iterations, center node anchored)
  const allNodes = [centerNode, ...innerNodes, ...outerNodes];
  for (let iteration = 0; iteration < 3; iteration++) {
    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        const posA = positions.get(allNodes[i].id)!;
        const posB = positions.get(allNodes[j].id)!;

        const centerAx = posA.x + NODE_WIDTH / 2;
        const centerAy = posA.y + NODE_HEIGHT / 2;
        const centerBx = posB.x + NODE_WIDTH / 2;
        const centerBy = posB.y + NODE_HEIGHT / 2;

        const dx = centerBx - centerAx;
        const dy = centerBy - centerAy;

        const minDistX = NODE_WIDTH + PADDING;
        const minDistY = NODE_HEIGHT + PADDING;

        const overlapX = minDistX - Math.abs(dx);
        const overlapY = minDistY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          const moveA = allNodes[i].id === centerNode.id ? 0 : 0.5;
          const moveB = allNodes[j].id === centerNode.id ? 0 : 0.5;
          const totalMove = moveA + moveB;
          if (totalMove === 0) continue;

          if (overlapX < overlapY) {
            const shift = overlapX;
            const dir = dx > 0 ? 1 : -1;
            posA.x -= dir * shift * (moveA / totalMove);
            posB.x += dir * shift * (moveB / totalMove);
          } else {
            const shift = overlapY;
            const dir = dy > 0 ? 1 : -1;
            posA.y -= dir * shift * (moveA / totalMove);
            posB.y += dir * shift * (moveB / totalMove);
          }
        }
      }
    }
  }

  const dimensions = new Map<string, { width: number; height: number }>();
  propositions.forEach((p) => {
    dimensions.set(p.id, getNodeDimensions(p.type ?? 'claim', connectivity.get(p.id) ?? 0));
  });

  let nodes: LayoutNode[] = propositions.map((prop) => {
    const pos = positions.get(prop.id) ?? { x: cx - NODE_WIDTH / 2, y: cy - NODE_HEIGHT / 2 };
    const dim = dimensions.get(prop.id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
    return {
      id: prop.id,
      position: pos,
      data: prop,
      width: dim.width,
      height: dim.height,
    };
  });

  // Normalize positions for radial layout (prevents clipping)
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const offsetX = minX < 0 ? Math.abs(minX) + 40 : 0;
  const offsetY = minY < 0 ? Math.abs(minY) + 40 : 0;
  if (offsetX > 0 || offsetY > 0) {
    nodes = nodes.map((n) => ({
      ...n,
      position: {
        x: n.position.x + offsetX,
        y: n.position.y + offsetY,
      },
    }));
  }

  const seen = new Set<string>();
  const edges: LayoutEdge[] = relationships
    .filter((rel) => {
      const { from, to } = fromTo(rel);
      return from && to && from !== to && propIds.has(from) && propIds.has(to);
    })
    .filter((rel) => {
      const { from, to } = fromTo(rel);
      const key = `${from}\x00${to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((rel) => {
      const { from, to } = fromTo(rel);
      return { id: rel.id, source: from, target: to, data: rel };
    });

  return { nodes, edges };
};

/**
 * Compute hierarchical top-to-bottom layout positions for React Flow nodes.
 * Uses dagre for automatic graph layout. Falls back to grid if dagre fails.
 *
 * @param propositions - Array of propositions to lay out
 * @param relationships - Array of relationships (edges) between propositions
 * @returns Layout result with positioned nodes and edges
 */
export const computeLayout = (
  propositions: Proposition[],
  relationships: Relationship[]
): LayoutResult => {
  const propIds = new Set(propositions.map((p) => p.id));

  // Connectivity for node sizing and rank hints
  const connectivity = new Map<string, number>();
  propositions.forEach((p) => connectivity.set(p.id, 0));
  relationships.forEach((rel) => {
    const { from, to } = fromTo(rel);
    if (from && propIds.has(from)) connectivity.set(from, (connectivity.get(from) ?? 0) + 1);
    if (to && propIds.has(to)) connectivity.set(to, (connectivity.get(to) ?? 0) + 1);
  });

  // Filter edges: only include valid edges (both endpoints exist, no self-loops)
  const validRels = relationships.filter((rel) => {
    const { from, to } = fromTo(rel);
    return from && to && from !== to && propIds.has(from) && propIds.has(to);
  });

  // Deduplicate edges by source-target pair
  const seen = new Set<string>();
  const uniqueRels = validRels.filter((rel) => {
    const { from, to } = fromTo(rel);
    const key = `${from}\x00${to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: 'TB',
    nodesep: 100,
    ranksep: 140,
    edgesep: 40,
    align: 'UL',
    marginx: 40,
    marginy: 40,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Per-type node dimensions for proper spacing
  const dimensions = new Map<string, { width: number; height: number }>();
  propositions.forEach((prop) => {
    const conn = connectivity.get(prop.id) ?? 0;
    const dim = getNodeDimensions(prop.type ?? 'claim', conn);
    dimensions.set(prop.id, dim);
    g.setNode(prop.id, { width: dim.width, height: dim.height });
  });

  // Add edges. For "supports": evidence supports claim = edge evidence->claim.
  // In TB, source is above target, so evidence would be above claim.
  // Reverse supports edges so claims (supported) end up above evidence (supporters).
  uniqueRels.forEach((rel) => {
    const { from, to } = fromTo(rel);
    if (!from || !to) return;
    const isSupports = (rel.type ?? '').toLowerCase() === 'supports';
    if (isSupports) {
      g.setEdge(to, from); // reversed: claim above evidence
    } else {
      g.setEdge(from, to);
    }
  });

  try {
    dagre.layout(g);
  } catch {
    return computeGridLayout(propositions, validRels, connectivity);
  }

  let nodes: LayoutNode[] = propositions.map((prop) => {
    const nodeWithPosition = g.node(prop.id);
    const dim = dimensions.get(prop.id) ?? { width: 240, height: 70 };
    const x = nodeWithPosition?.x ?? 0;
    const y = nodeWithPosition?.y ?? 0;
    return {
      id: prop.id,
      position: {
        x: x - dim.width / 2,
        y: y - dim.height / 2,
      },
      data: prop,
      width: dim.width,
      height: dim.height,
    };
  });

  // Post-layout overlap removal
  nodes = removeOverlaps(nodes, dimensions);

  // Normalize positions so nothing is negative (prevents left-side clipping)
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const offsetX = minX < 0 ? Math.abs(minX) + 40 : 0;
  const offsetY = minY < 0 ? Math.abs(minY) + 40 : 0;
  if (offsetX > 0 || offsetY > 0) {
    nodes = nodes.map((n) => ({
      ...n,
      position: {
        x: n.position.x + offsetX,
        y: n.position.y + offsetY,
      },
    }));
  }

  const edges: LayoutEdge[] = uniqueRels.map((rel) => {
    const { from, to } = fromTo(rel);
    return { id: rel.id, source: from, target: to, data: rel };
  });

  return { nodes, edges };
};
