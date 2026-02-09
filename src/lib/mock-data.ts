import type { GraphState } from './types';

// ============================================================
// Mock Data: Realistic scenarios for UI development
// ============================================================

// --- Scenario 1: Founder Pivot ---

export const founderPivotScenario: GraphState = {
  propositions: [
    {
      id: 'fp-p1-a1b2c3d4',
      statement: 'We should pivot to Enterprise',
      formalExpression: 'pivot_enterprise → optimal_outcome',
      type: 'claim',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: true,
      isAnchored: false,
    },
    {
      id: 'fp-p2-e5f6g7h8',
      statement: 'Enterprise deal sizes are 5x larger than SMB',
      formalExpression: 'deal_size(enterprise) > 5 * deal_size(smb)',
      type: 'evidence',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
    {
      id: 'fp-p3-i9j0k1l2',
      statement: 'Current SMB growth is stalling at 3% MoM',
      formalExpression: 'growth_rate(smb) ≤ 0.03 ∧ declining(growth_rate)',
      type: 'evidence',
      confidence: 'medium',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
    {
      id: 'fp-p4-m3n4o5p6',
      statement: 'Larger deals necessarily lead to better business outcomes',
      formalExpression: 'deal_size(x) > deal_size(y) → outcome(x) > outcome(y)',
      type: 'assumption',
      confidence: 'unstated_as_absolute',
      isImplicit: true,
      isLoadBearing: true,
      isAnchored: true,
    },
    {
      id: 'fp-p5-q7r8s9t0',
      statement: 'Full product rebuild for enterprise would take >12 months',
      formalExpression: 'time(rebuild_enterprise) > 12_months ∧ ¬compatible(current_product, enterprise_requirements)',
      type: 'constraint',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
  ],
  relationships: [
    {
      id: 'fp-r1-u1v2w3x4',
      fromId: 'fp-p2-e5f6g7h8',
      toId: 'fp-p1-a1b2c3d4',
      type: 'supports',
      strength: 'strong',
      label: 'Revenue justification',
    },
    {
      id: 'fp-r2-y5z6a7b8',
      fromId: 'fp-p3-i9j0k1l2',
      toId: 'fp-p1-a1b2c3d4',
      type: 'supports',
      strength: 'moderate',
      label: 'Negative signal from current path',
    },
    {
      id: 'fp-r3-c9d0e1f2',
      fromId: 'fp-p1-a1b2c3d4',
      toId: 'fp-p4-m3n4o5p6',
      type: 'depends_on',
      strength: 'strong',
      label: 'Hidden dependency — pivot assumes bigger = better',
    },
    {
      id: 'fp-r4-g3h4i5j6',
      fromId: 'fp-p5-q7r8s9t0',
      toId: 'fp-p1-a1b2c3d4',
      type: 'contradicts',
      strength: 'strong',
      label: 'Temporal impossibility',
    },
  ],
  contradictions: [
    {
      id: 'fp-c1-k7l8m9n0',
      propositionIds: ['fp-p1-a1b2c3d4', 'fp-p5-q7r8s9t0'],
      type: 'temporal',
      severity: 'critical',
      formalProof: 'pivot_enterprise ∧ time(rebuild) > 12mo → ¬feasible(pivot_now)',
      humanExplanation:
        'The pivot to Enterprise requires a product rebuild that would take over 12 months, but the urgency implied by "we should pivot" suggests immediate action. These two claims cannot both be true simultaneously without addressing the timeline.',
    },
  ],
  fallacies: [
    {
      id: 'fp-f1-o1p2q3r4',
      name: 'Hasty Generalization',
      description:
        'The claim "We should pivot to Enterprise" is stated with high confidence but is supported by only 2 evidence points (deal size and growth stalling). No counter-evidence is considered, and alternative explanations for SMB stalling are not explored.',
      affectedNodeIds: ['fp-p1-a1b2c3d4', 'fp-p2-e5f6g7h8', 'fp-p3-i9j0k1l2'],
      patternType: 'hasty_generalization',
    },
  ],
  biases: [
    {
      id: 'fp-b1-s5t6u7v8',
      name: 'Anchoring Effect',
      kahnemanReference: 'Thinking, Fast and Slow — Chapter 11: Anchors',
      description:
        'The proposition "Larger deals = better outcome" is stated as an absolute without evidence. The 5x deal size figure acts as an anchor, causing subsequent reasoning to be pulled toward enterprise without evaluating total cost of acquisition, sales cycle length, or churn differences.',
      affectedNodeIds: ['fp-p4-m3n4o5p6'],
      severity: 'high',
      system: 1,
    },
  ],
  insights: [
    {
      id: 'fp-i1-w9x0y1z2',
      engineType: 'adversarial',
      content:
        'What if the enterprise market is already saturated by incumbents? The 5x deal size means nothing if customer acquisition cost is 10x higher. Have you validated enterprise willingness to pay, or is this projection based on published averages?',
      keyQuestion: 'What is your validated enterprise CAC vs. SMB CAC?',
      affectedNodeIds: ['fp-p1-a1b2c3d4', 'fp-p2-e5f6g7h8'],
    },
  ],
  thoughtSummaries: [
    {
      text: 'The argument structure has a critical temporal contradiction and relies on an unexamined anchoring assumption. The pivot reasoning follows a common pattern where founders anchor on deal size without accounting for the full cost structure of enterprise sales.',
      timestamp: Date.now(),
    },
  ],
  groundingResults: [
    {
      query: 'Enterprise deal sizes vs SMB in SaaS',
      claim: 'Enterprise deal sizes are 5x larger than SMB',
      verdict: 'supported',
      evidence:
        'According to multiple SaaS industry reports, enterprise contracts average $25K-$100K ACV while SMB averages $5K-$15K ACV, roughly a 5x difference.',
      sources: [
        { title: 'Bessemer Cloud Index', url: 'https://www.bvp.com/cloud' },
        { title: 'OpenView SaaS Benchmarks 2024', url: 'https://openviewpartners.com/benchmarks' },
      ],
      propositionId: 'fp-p2-e5f6g7h8',
    },
    {
      query: 'SMB growth rates in SaaS',
      claim: 'Current SMB growth is stalling at 3% MoM',
      verdict: 'insufficient_data',
      evidence:
        'Growth rates vary widely by company and segment. 3% MoM growth is below typical SaaS benchmarks but without specific company data, this claim cannot be verified.',
      sources: [],
      propositionId: 'fp-p3-i9j0k1l2',
    },
  ],
  argumentScores: [
    {
      propositionId: 'fp-p1-a1b2c3d4',
      score: 0.35,
      evidencePaths: 2,
      contradictionCount: 1,
      vulnerableAssumptions: 1,
    },
    {
      propositionId: 'fp-p2-e5f6g7h8',
      score: 0.72,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 0,
    },
    {
      propositionId: 'fp-p3-i9j0k1l2',
      score: 0.55,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 0,
    },
    {
      propositionId: 'fp-p4-m3n4o5p6',
      score: 0.15,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 1,
    },
    {
      propositionId: 'fp-p5-q7r8s9t0',
      score: 0.80,
      evidencePaths: 0,
      contradictionCount: 1,
      vulnerableAssumptions: 0,
    },
  ],
};

// --- Scenario 2: Leave My Job ---

export const leaveMyJobScenario: GraphState = {
  propositions: [
    {
      id: 'lj-p1-a1b2c3d4',
      statement: 'I should leave my job to start a company',
      formalExpression: 'leave_job → start_company ∧ expected_value(startup) > expected_value(employment)',
      type: 'claim',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: true,
      isAnchored: false,
    },
    {
      id: 'lj-p2-e5f6g7h8',
      statement: 'Market timing feels right — AI wave is accelerating',
      formalExpression: 'market_sentiment(AI) = bullish ∧ timing_intuition = positive',
      type: 'evidence',
      confidence: 'medium',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: true,
    },
    {
      id: 'lj-p3-i9j0k1l2',
      statement: 'I have $80K in savings',
      formalExpression: 'savings = $80,000',
      type: 'evidence',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: true,
      isAnchored: false,
    },
    {
      id: 'lj-p4-m3n4o5p6',
      statement: 'Family expenses are $8K per month',
      formalExpression: 'expenses(family, monthly) = $8,000',
      type: 'constraint',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: true,
      isAnchored: false,
    },
    {
      id: 'lj-p5-q7r8s9t0',
      statement: 'I have no co-founder and would be building solo',
      formalExpression: 'team_size = 1 ∧ ¬exists(cofounder)',
      type: 'risk',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
    {
      id: 'lj-p6-u1v2w3x4',
      statement: 'My savings are sufficient to fund both the startup and family expenses during the runway period',
      formalExpression: 'savings ≥ expenses(family) * runway_months + expenses(startup)',
      type: 'assumption',
      confidence: 'unstated_as_absolute',
      isImplicit: true,
      isLoadBearing: true,
      isAnchored: true,
    },
  ],
  relationships: [
    {
      id: 'lj-r1-y5z6a7b8',
      fromId: 'lj-p2-e5f6g7h8',
      toId: 'lj-p1-a1b2c3d4',
      type: 'supports',
      strength: 'weak',
      label: 'Intuitive market justification',
    },
    {
      id: 'lj-r2-c9d0e1f2',
      fromId: 'lj-p3-i9j0k1l2',
      toId: 'lj-p1-a1b2c3d4',
      type: 'supports',
      strength: 'moderate',
      label: 'Financial cushion',
    },
    {
      id: 'lj-r3-g3h4i5j6',
      fromId: 'lj-p4-m3n4o5p6',
      toId: 'lj-p1-a1b2c3d4',
      type: 'contradicts',
      strength: 'moderate',
      label: 'Burn rate limits runway to ~10 months',
    },
    {
      id: 'lj-r4-k7l8m9n0',
      fromId: 'lj-p5-q7r8s9t0',
      toId: 'lj-p1-a1b2c3d4',
      type: 'attacks',
      strength: 'moderate',
      label: 'Solo founder risk',
    },
    {
      id: 'lj-r5-o1p2q3r4',
      fromId: 'lj-p1-a1b2c3d4',
      toId: 'lj-p6-u1v2w3x4',
      type: 'depends_on',
      strength: 'strong',
      label: 'Hidden financial assumption',
    },
  ],
  contradictions: [
    {
      id: 'lj-c1-s5t6u7v8',
      propositionIds: ['lj-p6-u1v2w3x4', 'lj-p3-i9j0k1l2', 'lj-p4-m3n4o5p6'],
      type: 'empirical',
      severity: 'critical',
      formalProof:
        'savings($80K) / expenses($8K/mo) = 10 months. startup_costs > $0 → actual_runway < 10 months. median_time_to_revenue(solo_founder) > 18 months → savings < required',
      humanExplanation:
        '$80K in savings with $8K/month family expenses gives a bare maximum of 10 months — and that assumes zero startup costs (incorporation, infrastructure, marketing, etc.). The assumption that savings are "sufficient" is mathematically unsupported when startup expenses are factored in.',
    },
  ],
  fallacies: [],
  biases: [
    {
      id: 'lj-b1-w9x0y1z2',
      name: 'Anchoring Effect',
      kahnemanReference: 'Thinking, Fast and Slow — Chapter 11: Anchors',
      description:
        '"Market timing feels right" is a System 1 intuitive judgment anchored to the current AI hype cycle. The subjective feeling of rightness is being treated as evidence, when market timing requires System 2 analysis of competition, adoption curves, and personal competitive advantage.',
      affectedNodeIds: ['lj-p2-e5f6g7h8'],
      severity: 'high',
      system: 1,
    },
    {
      id: 'lj-b2-a3b4c5d6',
      name: 'Confirmation Bias',
      kahnemanReference: 'Thinking, Fast and Slow — Chapter 7: A Machine for Jumping to Conclusions',
      description:
        'All evidence presented supports the decision to leave. No counter-evidence has been considered: What if staying and building on the side is viable? What if the market window is longer than assumed? What if the specific idea hasn\'t been validated? The absence of opposing evidence is itself a signal of confirmation bias.',
      affectedNodeIds: ['lj-p1-a1b2c3d4', 'lj-p2-e5f6g7h8', 'lj-p3-i9j0k1l2'],
      severity: 'medium',
      system: 1,
    },
  ],
  insights: [
    {
      id: 'lj-i1-e7f8g9h0',
      engineType: 'assumption',
      content:
        'The most dangerous assumption here is implicit: "my savings are sufficient." When we do the math — $80K / $8K = 10 months max, minus startup costs — the real runway might be 6-7 months. The median solo founder takes 18+ months to reach revenue. This gap is existential.',
      keyQuestion: 'What is your actual monthly burn rate including startup costs, and what is your minimum viable runway?',
      affectedNodeIds: ['lj-p6-u1v2w3x4', 'lj-p3-i9j0k1l2', 'lj-p4-m3n4o5p6'],
    },
    {
      id: 'lj-i2-i1j2k3l4',
      engineType: 'adversarial',
      content:
        'Counter-argument: What if you kept your job and built the product on evenings/weekends for 6 months? You\'d preserve your savings, validate the market, and potentially find a co-founder. The "feels right" timing argument loses force if the opportunity persists for another year.',
      keyQuestion: 'Have you exhausted all options that don\'t require quitting?',
      affectedNodeIds: ['lj-p1-a1b2c3d4', 'lj-p2-e5f6g7h8', 'lj-p5-q7r8s9t0'],
    },
  ],
  thoughtSummaries: [
    {
      text: 'This decision has a critical hidden financial assumption that doesn\'t survive basic arithmetic. The argument is emotionally compelling but structurally weak — it relies on System 1 intuitions (market timing "feels right") and a confirmation-biased evidence set (no counter-evidence considered). The solo founder risk compounds the financial risk.',
      timestamp: Date.now(),
    },
  ],
  groundingResults: [
    {
      query: 'AI market timing 2024-2025',
      claim: 'Market timing feels right — AI wave is accelerating',
      verdict: 'supported',
      evidence:
        'AI investment reached $189B in 2024, with enterprise AI adoption growing 35% YoY. However, "market timing feeling right" is subjective and not directly verifiable.',
      sources: [
        { title: 'Stanford AI Index 2024', url: 'https://aiindex.stanford.edu/report/' },
      ],
      propositionId: 'lj-p2-e5f6g7h8',
    },
  ],
  argumentScores: [
    {
      propositionId: 'lj-p1-a1b2c3d4',
      score: 0.28,
      evidencePaths: 2,
      contradictionCount: 1,
      vulnerableAssumptions: 1,
    },
    {
      propositionId: 'lj-p2-e5f6g7h8',
      score: 0.30,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 0,
    },
    {
      propositionId: 'lj-p3-i9j0k1l2',
      score: 0.85,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 0,
    },
    {
      propositionId: 'lj-p4-m3n4o5p6',
      score: 0.90,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 0,
    },
    {
      propositionId: 'lj-p5-q7r8s9t0',
      score: 0.75,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 0,
    },
    {
      propositionId: 'lj-p6-u1v2w3x4',
      score: 0.12,
      evidencePaths: 0,
      contradictionCount: 1,
      vulnerableAssumptions: 1,
    },
  ],
};

// --- Scenario selector ---

// --- Scenario 3: Logical Contradiction (SAT Test) ---

export const logicalContradictionScenario: GraphState = {
  propositions: [
    {
      id: 'lc-p1-a1b2c3d4',
      statement: 'I love cow milk',
      formalExpression: 'loves(user, cow_milk) = true',
      type: 'claim',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
    {
      id: 'lc-p2-e5f6g7h8',
      statement: 'I hate all cow-based products',
      formalExpression: '∀x (cow_product(x) → hates(user, x))',
      type: 'claim',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
    {
      id: 'lc-p3-i9j0k1l2',
      statement: 'Cow milk is a cow-based product',
      formalExpression: 'cow_product(cow_milk)',
      type: 'evidence',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
  ],
  relationships: [
    {
      id: 'lc-r1-m3n4o5p6',
      fromId: 'lc-p1-a1b2c3d4',
      toId: 'lc-p2-e5f6g7h8',
      type: 'contradicts',
      strength: 'strong',
      label: 'Direct logical contradiction',
    },
    {
      id: 'lc-r2-q7r8s9t0',
      fromId: 'lc-p3-i9j0k1l2',
      toId: 'lc-p2-e5f6g7h8',
      type: 'supports',
      strength: 'strong',
      label: 'Establishes category',
    },
  ],
  contradictions: [
    {
      id: 'lc-c1-u1v2w3x4',
      propositionIds: ['lc-p1-a1b2c3d4', 'lc-p2-e5f6g7h8', 'lc-p3-i9j0k1l2'],
      minimalCore: ['lc-p1-a1b2c3d4', 'lc-p2-e5f6g7h8', 'lc-p3-i9j0k1l2'],
      type: 'logical',
      severity: 'critical',
      formalProof: `=== FORMAL PROOF OF CONTRADICTION ===
Premises:
  P1: loves(user, cow_milk) = true
  P2: ∀x (cow_product(x) → hates(user, x))
  P3: cow_product(cow_milk)

Derivation:
  1. cow_product(cow_milk)                    [P3]
  2. cow_product(cow_milk) → hates(user, cow_milk)   [Universal instantiation of P2]
  3. hates(user, cow_milk)                    [Modus ponens: 1, 2]
  4. loves(user, cow_milk)                    [P1]
  5. hates(user, cow_milk) ∧ loves(user, cow_milk)   [Conjunction: 3, 4]

Conclusion:
  ∴ ⊥ (contradiction)
  
Q.E.D.

Method: SAT Solver (DPLL Algorithm)
Result: UNSAT - No model satisfies all premises`,
      humanExplanation:
        'You stated that you love cow milk while simultaneously claiming to hate all cow-based products. Since cow milk is definitionally a cow-based product, these two statements are logically contradictory and cannot both be true.',
    },
  ],
  fallacies: [],
  biases: [],
  insights: [
    {
      id: 'lc-i1-y5z6a7b8',
      engineType: 'adversarial',
      content:
        'This is a classic logical contradiction. The two statements are mutually exclusive. Either you don\'t actually love cow milk, or you have an exception in your rule about cow-based products.',
      keyQuestion: 'Did you mean to exclude cow milk from "all cow-based products," or is one of these statements not actually true?',
      affectedNodeIds: ['lc-p1-a1b2c3d4', 'lc-p2-e5f6g7h8'],
    },
  ],
  thoughtSummaries: [
    {
      text: 'SAT solver detected UNSAT: The conjunction of all three propositions admits no valid model. The minimal unsatisfiable core contains all three statements.',
      timestamp: Date.now(),
    },
  ],
  groundingResults: [],
  argumentScores: [
    {
      propositionId: 'lc-p1-a1b2c3d4',
      score: 0.0,
      evidencePaths: 0,
      contradictionCount: 1,
      vulnerableAssumptions: 0,
    },
    {
      propositionId: 'lc-p2-e5f6g7h8',
      score: 0.0,
      evidencePaths: 0,
      contradictionCount: 1,
      vulnerableAssumptions: 0,
    },
  ],
  loadBearingAssumptions: [],
};

// --- Scenario 4: Circular Reasoning ---

export const circularReasoningScenario: GraphState = {
  propositions: [
    {
      id: 'cr-p1-a1b2c3d4',
      statement: 'The Bible is true',
      formalExpression: 'true(bible)',
      type: 'claim',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
    {
      id: 'cr-p2-e5f6g7h8',
      statement: 'The Bible says it is the word of God',
      formalExpression: 'claims(bible, word_of_god(bible))',
      type: 'evidence',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: false,
      isAnchored: false,
    },
    {
      id: 'cr-p3-i9j0k1l2',
      statement: 'What the Bible says is true because it is the word of God',
      formalExpression: 'word_of_god(bible) → true(bible)',
      type: 'assumption',
      confidence: 'high',
      isImplicit: false,
      isLoadBearing: true,
      isAnchored: false,
    },
  ],
  relationships: [
    {
      id: 'cr-r1-m3n4o5p6',
      fromId: 'cr-p2-e5f6g7h8',
      toId: 'cr-p1-a1b2c3d4',
      type: 'supports',
      strength: 'strong',
      label: 'Self-validation',
    },
    {
      id: 'cr-r2-q7r8s9t0',
      fromId: 'cr-p3-i9j0k1l2',
      toId: 'cr-p1-a1b2c3d4',
      type: 'supports',
      strength: 'strong',
      label: 'Circular dependency',
    },
    {
      id: 'cr-r3-u1v2w3x4',
      fromId: 'cr-p1-a1b2c3d4',
      toId: 'cr-p3-i9j0k1l2',
      type: 'depends_on',
      strength: 'strong',
      label: 'Completes the cycle',
    },
  ],
  contradictions: [],
  fallacies: [
    {
      id: 'cr-f1-y5z6a7b8',
      name: 'Circular Reasoning (Begging the Question)',
      description: `This argument forms a logical cycle where the conclusion depends on a premise that itself depends on the conclusion:

1. The Bible is true (claim)
2. Because the Bible says it is the word of God (self-reference)
3. And what the Bible says is true because it is the word of God (circular dependency)

The truth of the Bible is being used to prove the truth of the Bible. No independent verification exists outside the cycle.`,
      affectedNodeIds: ['cr-p1-a1b2c3d4', 'cr-p2-e5f6g7h8', 'cr-p3-i9j0k1l2'],
      patternType: 'cycle',
      proofPath: ['cr-p1-a1b2c3d4', 'cr-p3-i9j0k1l2', 'cr-p2-e5f6g7h8', 'cr-p1-a1b2c3d4'],
    },
  ],
  biases: [],
  insights: [
    {
      id: 'cr-i1-c9d0e1f2',
      engineType: 'adversarial',
      content:
        'This is textbook circular reasoning. You\'re using the Bible\'s claim about itself to prove the Bible\'s truthfulness. An external, independent source of verification is required to break the cycle.',
      keyQuestion: 'What evidence exists outside the Bible itself that would independently verify its claims?',
      affectedNodeIds: ['cr-p1-a1b2c3d4', 'cr-p2-e5f6g7h8', 'cr-p3-i9j0k1l2'],
    },
  ],
  thoughtSummaries: [
    {
      text: 'DFS cycle detection found a strongly connected component of length 3. The argument graph contains a cycle with no external validation.',
      timestamp: Date.now(),
    },
  ],
  groundingResults: [],
  argumentScores: [
    {
      propositionId: 'cr-p1-a1b2c3d4',
      score: 0.15,
      evidencePaths: 0,
      contradictionCount: 0,
      vulnerableAssumptions: 1,
    },
  ],
  loadBearingAssumptions: [
    {
      propositionId: 'cr-p3-i9j0k1l2',
      centralityScore: 0.95,
      dependentClaims: ['cr-p1-a1b2c3d4', 'cr-p2-e5f6g7h8'],
    },
  ],
};

export const mockScenarios = {
  'founder-pivot': founderPivotScenario,
  'leave-my-job': leaveMyJobScenario,
  'logical-contradiction': logicalContradictionScenario,
  'circular-reasoning': circularReasoningScenario,
} as const;

export type MockScenarioKey = keyof typeof mockScenarios;
