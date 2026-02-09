'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, fonts } from '@/lib/design-tokens';
import type {
  GraphState,
  Proposition,
  ArgumentScore,
  Contradiction,
  Fallacy,
  CognitiveBias,
  GroundingResult,
  Insight,
} from '@/lib/types';

// -- Props --

interface InsightPanelProps {
  graphState: GraphState;
  selectedNodeId?: string | null;
  onNodeSelect?: (id: string) => void;
  isAnalyzing?: boolean;
}

// -- Collapsible section --

const CollapsibleSection = ({
  title,
  icon,
  count,
  accentColor,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: string;
  count?: number;
  accentColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
        aria-expanded={isOpen}
        aria-label={`${title} section`}
      >
        <span className="text-sm">{icon}</span>
        <span
          className="text-xs font-semibold uppercase tracking-wider flex-1"
          style={{ color: accentColor || colors.text, fontFamily: fonts.system }}
        >
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span
            className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white min-w-[18px]"
            style={{ backgroundColor: accentColor || colors.textSecondary }}
          >
            {count}
          </span>
        )}
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// -- Node pill (clickable reference to a proposition) --

const NodePill = ({
  propositionId,
  propositions,
  onSelect,
}: {
  propositionId: string;
  propositions: Proposition[];
  onSelect?: (id: string) => void;
}) => {
  const prop = propositions.find((p) => p.id === propositionId);
  if (!prop) return null;

  const typeColors: Record<string, string> = {
    claim: colors.claim,
    evidence: colors.evidence,
    assumption: colors.assumption,
    risk: colors.risk,
    constraint: colors.peripheral,
  };

  const color = typeColors[prop.type] || colors.textSecondary;
  const shortLabel = prop.statement.length > 30 ? prop.statement.slice(0, 30) + '…' : prop.statement;

  return (
    <button
      onClick={() => onSelect?.(propositionId)}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-all hover:scale-105"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        fontFamily: fonts.system,
      }}
      aria-label={`Select: ${prop.statement}`}
    >
      {shortLabel}
    </button>
  );
};

// -- Contradiction card --

const ContradictionCard = ({
  contradiction,
  propositions,
  onNodeSelect,
}: {
  contradiction: Contradiction;
  propositions: Proposition[];
  onNodeSelect?: (id: string) => void;
}) => {
  const [showProof, setShowProof] = useState(false);

  const severityColors: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'bg-red-100', text: 'text-red-700' },
    major: { bg: 'bg-orange-100', text: 'text-orange-700' },
    minor: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  };
  const sev = severityColors[contradiction.severity] || severityColors.major;

  return (
    <div className="rounded-lg border-l-[3px] bg-red-50/50 p-3" style={{ borderColor: colors.contradiction }}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sev.bg} ${sev.text}`}>
          {contradiction.severity}
        </span>
        <span className="text-[10px] text-clarity-text-muted" style={{ fontFamily: fonts.system }}>
          {contradiction.type}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-clarity-text mb-2" style={{ fontFamily: fonts.ui }}>
        {contradiction.humanExplanation ?? (contradiction as { human_explanation?: string }).human_explanation}
      </p>

      {/* Affected propositions */}
      <div className="flex flex-wrap gap-1 mb-2">
        {(contradiction.propositionIds ?? (contradiction as { proposition_ids?: string[] }).proposition_ids ?? []).map((id) => (
          <NodePill key={id} propositionId={id} propositions={propositions} onSelect={onNodeSelect} />
        ))}
      </div>

      {/* Formal proof toggle */}
      <button
        onClick={() => setShowProof(!showProof)}
        className="text-[10px] text-red-600 hover:text-red-700 font-medium"
        style={{ fontFamily: fonts.system }}
      >
        {showProof ? '▼ Hide Formal Proof' : '▶ View Formal Proof'}
      </button>
      <AnimatePresence>
        {showProof && (contradiction.formalProof ?? (contradiction as { formal_proof?: string }).formal_proof) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre
              className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-green-400 overflow-x-auto"
              style={{ fontFamily: fonts.system }}
            >
              {contradiction.formalProof ?? (contradiction as { formal_proof?: string }).formal_proof}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// -- Fallacy card --

const FallacyCard = ({
  fallacy,
  propositions,
  onNodeSelect,
}: {
  fallacy: Fallacy;
  propositions: Proposition[];
  onNodeSelect?: (id: string) => void;
}) => (
  <div className="rounded-lg border-l-[3px] bg-amber-50/50 p-3" style={{ borderColor: colors.assumption }}>
    <p className="text-xs font-semibold text-clarity-text mb-1" style={{ fontFamily: fonts.system }}>
      {fallacy.name}
    </p>
    <p className="text-xs leading-relaxed text-clarity-text-secondary mb-2" style={{ fontFamily: fonts.ui }}>
      {fallacy.description}
    </p>
    <div className="flex flex-wrap gap-1">
      {(fallacy.affectedNodeIds ?? (fallacy as { affected_node_ids?: string[] }).affected_node_ids ?? []).map((id) => (
        <NodePill key={id} propositionId={id} propositions={propositions} onSelect={onNodeSelect} />
      ))}
    </div>
  </div>
);

// -- Bias card --

const BiasCard = ({
  bias,
  propositions,
  onNodeSelect,
}: {
  bias: CognitiveBias;
  propositions: Proposition[];
  onNodeSelect?: (id: string) => void;
}) => {
  const severityColors: Record<string, { bg: string; text: string }> = {
    high: { bg: 'bg-red-100', text: 'text-red-700' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
    low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  };
  const sev = severityColors[bias.severity] || severityColors.medium;

  return (
    <div className="rounded-lg border-l-[3px] bg-purple-50/50 p-3" style={{ borderColor: colors.bias }}>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-semibold text-clarity-text" style={{ fontFamily: fonts.system }}>
          {bias.name}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.text}`}>
          {bias.severity}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[10px]"
          title={`System ${bias.system}`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: bias.system === 1 ? colors.contradiction : colors.evidence }}
          />
          <span className="text-clarity-text-muted">S{bias.system}</span>
        </span>
      </div>

      <p
        className="text-[11px] italic text-clarity-text-muted mb-2"
        style={{ fontFamily: fonts.system }}
      >
        {bias.kahnemanReference}
      </p>

      <p className="text-xs leading-relaxed text-clarity-text-secondary mb-2" style={{ fontFamily: fonts.ui }}>
        {bias.description}
      </p>

      <div className="flex flex-wrap gap-1">
        {(bias.affectedNodeIds ?? (bias as { affected_node_ids?: string[] }).affected_node_ids ?? []).map((id) => (
          <NodePill key={id} propositionId={id} propositions={propositions} onSelect={onNodeSelect} />
        ))}
      </div>
    </div>
  );
};

// -- Grounding card --

const GroundingCard = ({ result }: { result: GroundingResult }) => {
  const verdictConfig: Record<string, { icon: string; bg: string; text: string; label: string }> = {
    supported: { icon: '✅', bg: 'bg-green-100', text: 'text-green-700', label: 'Supported' },
    contradicted: { icon: '❌', bg: 'bg-red-100', text: 'text-red-700', label: 'Contradicted' },
    insufficient_data: { icon: '⚪', bg: 'bg-gray-100', text: 'text-gray-600', label: 'Insufficient Data' },
  };
  const v = verdictConfig[result.verdict] || verdictConfig.insufficient_data;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${v.bg} ${v.text}`}>
          {v.icon} {v.label}
        </span>
      </div>
      <p className="text-xs font-medium text-clarity-text mb-1" style={{ fontFamily: fonts.ui }}>
        {result.claim}
      </p>
      <p className="text-xs leading-relaxed text-clarity-text-secondary mb-2" style={{ fontFamily: fonts.ui }}>
        {result.evidence}
      </p>
      {result.sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.sources.map((source, i) => (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-clarity-claim hover:underline"
              style={{ fontFamily: fonts.system }}
            >
              🔗 {source.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// -- Insight card --

const InsightCard = ({
  insight,
  propositions,
  onNodeSelect,
}: {
  insight: Insight;
  propositions: Proposition[];
  onNodeSelect?: (id: string) => void;
}) => {
  const engineIcons: Record<string, string> = {
    adversarial: '⚔️',
    assumption: '⚓',
    decomposition: '🔍',
    precision: '🎯',
    perspective: '🔮',
    signal: '💡',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{engineIcons[insight.engineType ?? (insight as { engine_type?: string }).engine_type ?? ''] || '💡'}</span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider text-clarity-text-secondary"
          style={{ fontFamily: fonts.system }}
        >
          {insight.engineType ?? (insight as { engine_type?: string }).engine_type ?? 'insight'}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-clarity-text mb-2" style={{ fontFamily: fonts.ui }}>
        {insight.content}
      </p>

      {(insight.keyQuestion ?? (insight as { key_question?: string }).key_question) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 mb-2">
          <p className="text-[10px] font-semibold text-amber-700 mb-0.5" style={{ fontFamily: fonts.system }}>
            KEY QUESTION
          </p>
          <p className="text-xs text-amber-900 font-medium" style={{ fontFamily: fonts.ui }}>
            {insight.keyQuestion ?? (insight as { key_question?: string }).key_question}
          </p>
        </div>
      )}

      {((insight.affectedNodeIds ?? (insight as { affected_node_ids?: string[] }).affected_node_ids) ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(insight.affectedNodeIds ?? (insight as { affected_node_ids?: string[] }).affected_node_ids ?? []).map((id) => (
            <NodePill key={id} propositionId={id} propositions={propositions} onSelect={onNodeSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

// -- Selected node detail view --

const SelectedNodeDetails = ({
  prop,
  score,
  graphState,
  onNodeSelect,
}: {
  prop: Proposition;
  score?: ArgumentScore;
  graphState: GraphState;
  onNodeSelect?: (id: string) => void;
}) => {
  const scoreColor = score
    ? score.score > 0.6
      ? colors.evidence
      : score.score > 0.3
        ? colors.assumption
        : colors.contradiction
    : undefined;

  const typeColors: Record<string, string> = {
    claim: colors.claim,
    evidence: colors.evidence,
    assumption: colors.assumption,
    risk: colors.risk,
    constraint: colors.peripheral,
  };

  return (
    <motion.div
      key={prop.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3 px-4 py-3"
    >
      {/* Back button */}
      <button
        onClick={() => onNodeSelect?.('')}
        className="text-[10px] text-clarity-claim hover:underline"
        style={{ fontFamily: fonts.system }}
      >
        ← Back to Overview
      </button>

      {/* Type + Statement */}
      <div>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white mb-2"
          style={{ backgroundColor: typeColors[prop.type] || colors.textSecondary, fontFamily: fonts.system }}
        >
          {prop.type}
        </span>
        <p className="mt-2 text-sm leading-relaxed text-clarity-text" style={{ fontFamily: fonts.proposition }}>
          {prop.statement}
        </p>
      </div>

      {/* Formal expression */}
      <div className="rounded-lg bg-gray-50 p-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-clarity-text-secondary mb-1" style={{ fontFamily: fonts.system }}>
          Formal Expression
        </h4>
        <code className="block text-[11px] text-clarity-text leading-relaxed break-all" style={{ fontFamily: fonts.system }}>
          {prop.formalExpression ?? (prop as { formal_expression?: string }).formal_expression ?? ''}
        </code>
      </div>

      {/* Score */}
      {score && (
        <div className="rounded-lg bg-gray-50 p-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-clarity-text-secondary mb-2" style={{ fontFamily: fonts.system }}>
            Argument Strength
          </h4>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-clarity-text-muted">Score</span>
              <span className="font-medium text-clarity-text">{(score.score * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score.score * 100}%`, backgroundColor: scoreColor }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-clarity-text-muted">
              <span>{score.evidencePaths} evidence paths</span>
              <span>{score.contradictionCount} contradictions</span>
            </div>
          </div>
        </div>
      )}

      {/* Properties */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-clarity-text-secondary">
          {prop.confidence}
        </span>
        {prop.isImplicit && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-700">implicit</span>
        )}
        {prop.isLoadBearing && (
          <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] text-blue-700">load-bearing</span>
        )}
        {prop.isAnchored && (
          <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] text-purple-700">anchored</span>
        )}
      </div>

      {/* Related contradictions for this node */}
      {graphState.contradictions.filter((c) => (c.propositionIds ?? (c as { proposition_ids?: string[] }).proposition_ids ?? []).includes(prop.id)).length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-2" style={{ fontFamily: fonts.system }}>
            Contradictions involving this node
          </h4>
          {graphState.contradictions
            .filter((c) => (c.propositionIds ?? (c as { proposition_ids?: string[] }).proposition_ids ?? []).includes(prop.id))
            .map((c) => (
              <ContradictionCard
                key={c.id}
                contradiction={c}
                propositions={graphState.propositions}
                onNodeSelect={onNodeSelect}
              />
            ))}
        </div>
      )}
    </motion.div>
  );
};

// -- Main InsightPanel component --

export const InsightPanel = ({ graphState, selectedNodeId, onNodeSelect, isAnalyzing }: InsightPanelProps) => {
  const selectedProp = useMemo(
    () => graphState.propositions.find((p) => p.id === selectedNodeId),
    [graphState.propositions, selectedNodeId]
  );

  const selectedScore = useMemo(
    () => (graphState.argumentScores ?? []).find((s) => s.propositionId === selectedNodeId),
    [graphState.argumentScores, selectedNodeId]
  );

  const issueCount =
    graphState.contradictions.length + graphState.fallacies.length + graphState.biases.length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 shrink-0">
        <h2 className="text-sm font-semibold text-clarity-text" style={{ fontFamily: fonts.system }}>
          Analysis
        </h2>
        {isAnalyzing && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-clarity-claim animate-breathing" />
            <span className="text-[10px] text-clarity-text-muted" style={{ fontFamily: fonts.system }}>
              Processing…
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedProp ? (
            <SelectedNodeDetails
              prop={selectedProp}
              score={selectedScore}
              graphState={graphState}
              onNodeSelect={onNodeSelect}
            />
          ) : (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Section 1: Gemini's Reasoning */}
              {graphState.thoughtSummaries.length > 0 && (
                <CollapsibleSection
                  title="Gemini's Reasoning"
                  icon="🧠"
                  accentColor={colors.claim}
                  defaultOpen={true}
                >
                  {graphState.thoughtSummaries
                    .slice()
                    .reverse()
                    .map((ts, i) => (
                      <div key={i} className="rounded-lg bg-gray-50 p-3">
                        <p
                          className="text-xs leading-relaxed text-clarity-text"
                          style={{ fontFamily: fonts.system }}
                        >
                          {ts.text}
                        </p>
                        <p className="mt-1 text-[10px] text-clarity-text-muted">
                          {new Date(ts.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                </CollapsibleSection>
              )}

              {/* Section 2: Detected Issues */}
              {issueCount > 0 && (
                <CollapsibleSection
                  title="Detected Issues"
                  icon="⚠️"
                  count={issueCount}
                  accentColor={colors.contradiction}
                  defaultOpen={true}
                >
                  {/* Contradictions */}
                  {graphState.contradictions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600" style={{ fontFamily: fonts.system }}>
                        Contradictions ({graphState.contradictions.length})
                      </p>
                      {graphState.contradictions.map((c) => (
                        <ContradictionCard
                          key={c.id}
                          contradiction={c}
                          propositions={graphState.propositions}
                          onNodeSelect={onNodeSelect}
                        />
                      ))}
                    </div>
                  )}

                  {/* Fallacies */}
                  {graphState.fallacies.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600" style={{ fontFamily: fonts.system }}>
                        Fallacies ({graphState.fallacies.length})
                      </p>
                      {graphState.fallacies.map((f) => (
                        <FallacyCard
                          key={f.id}
                          fallacy={f}
                          propositions={graphState.propositions}
                          onNodeSelect={onNodeSelect}
                        />
                      ))}
                    </div>
                  )}

                  {/* Biases */}
                  {graphState.biases.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ fontFamily: fonts.system, color: colors.bias }}>
                        Cognitive Biases ({graphState.biases.length})
                      </p>
                      {graphState.biases.map((b) => (
                        <BiasCard
                          key={b.id}
                          bias={b}
                          propositions={graphState.propositions}
                          onNodeSelect={onNodeSelect}
                        />
                      ))}
                    </div>
                  )}
                </CollapsibleSection>
              )}

              {/* Section 3: Fact Check */}
              {graphState.groundingResults.length > 0 && (
                <CollapsibleSection
                  title="Fact Check"
                  icon="📊"
                  count={graphState.groundingResults.length}
                  accentColor={colors.evidence}
                  defaultOpen={true}
                >
                  {graphState.groundingResults.map((g, i) => (
                    <GroundingCard key={i} result={g} />
                  ))}
                </CollapsibleSection>
              )}

              {/* Section 4: Insights */}
              {graphState.insights.length > 0 && (
                <CollapsibleSection
                  title="Insights"
                  icon="💡"
                  count={graphState.insights.length}
                  accentColor={colors.claim}
                  defaultOpen={true}
                >
                  {graphState.insights.map((ins) => (
                    <InsightCard
                      key={ins.id}
                      insight={ins}
                      propositions={graphState.propositions}
                      onNodeSelect={onNodeSelect}
                    />
                  ))}
                </CollapsibleSection>
              )}

              {/* Empty state */}
              {graphState.propositions.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-clarity-text-muted" style={{ fontFamily: fonts.system }}>
                    Analysis results will appear here
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
