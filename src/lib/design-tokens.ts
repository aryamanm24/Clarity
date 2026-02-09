export const colors = {
  // Node types
  claim: '#0EA5E9',
  evidence: '#22C55E',
  assumption: '#F59E0B',
  adversarial: '#F97316',
  contradiction: '#EF4444',
  bias: '#8B5CF6',
  risk: '#F43F5E',
  peripheral: '#9CA3AF',

  // Backgrounds
  background: '#F9F9F7',
  surface: '#FFFFFF',
  surfaceHover: '#F3F4F6',
  surfaceDark: '#1F2937',

  // Text
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnDark: '#F9FAFB',

  // Status
  verified: '#22C55E',
  unverified: '#F59E0B',
  contradicted: '#EF4444',

  // Edges
  edgeSupport: '#22C55E',
  edgeContradiction: '#EF4444',
  edgeDependency: '#9CA3AF',
  edgeAdversarial: '#F97316',
} as const;

export const fonts = {
  proposition: 'var(--font-merriweather)',
  system: 'var(--font-jetbrains-mono)',
  ui: 'var(--font-inter)',
} as const;

export const nodeConfig = {
  width: 280,
  minHeight: 80,
  borderRadius: 12,
  borderWidth: 3,
  padding: 16,
} as const;

export const animation = {
  nodeEntrance: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  edgeDraw: { duration: 0.6, ease: 'easeOut' },
  contradictionPulse: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  staggerDelay: 0.15,
} as const;

export type NodeColor = keyof typeof colors;
