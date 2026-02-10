'use client';

import Link from 'next/link';
import {
  FileText,
  Mic,
  Sparkles,
  GitBranch,
  Workflow,
  Zap,
  ArrowRight,
  MessageSquare,
  Cpu,
  Shield,
  Lightbulb,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { ParticleBackground } from '@/components/effects/ParticleBackground';
import { fonts, colors } from '@/lib/design-tokens';

const cardBase =
  'rounded-2xl border p-5 transition-all duration-200 hover:border-opacity-60 dark:hover:border-white/20';
const cardDark = 'border-white/10 bg-white/[0.02]';
const cardLight = 'border-gray-200 bg-gray-50/50 hover:border-gray-300';
const sectionHeading =
  'flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white mb-4';
const accentBar = 'h-8 w-1 rounded-full';

export default function HowItWorksPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0e10] flex flex-col transition-colors relative overflow-x-hidden">
      <Header />

      <div className="flex-1 flex items-center justify-center p-6 py-12">
        {isDark && <ParticleBackground />}
        {isDark && (
          <>
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
          </>
        )}

        <div
          className={`relative w-full max-w-4xl rounded-[32px] overflow-hidden shadow-2xl z-10 ${
            isDark
              ? 'bg-white/[0.03] backdrop-blur-xl border border-white/10'
              : 'bg-white border border-gray-200 shadow-gray-200/50'
          }`}
        >
          <div className="px-8 sm:px-12 py-12">
            {/* Hero */}
            <header className="mb-14">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className={`${accentBar}`}
                  style={{ backgroundColor: colors.claim }}
                />
                <span
                  className="text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-white/50"
                  style={{ fontFamily: fonts.ui }}
                >
                  Technical overview
                </span>
              </div>
              <h1
                className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-5 tracking-tight"
                style={{ fontFamily: fonts.proposition }}
              >
                How CLARITY Works
              </h1>
              <p
                className="text-lg text-gray-600 dark:text-white/60 leading-relaxed mb-4 max-w-2xl"
                style={{ fontFamily: fonts.ui }}
              >
                CLARITY turns your argument into a formal graph, proves
                contradictions with a SAT solver, and surfaces fallacies,
                ambiguities, and tensions.{' '}
                <strong className="text-gray-800 dark:text-white/90">
                  Gemini
                </strong>{' '}
                handles all language understanding and explanation;{' '}
                <strong className="text-gray-800 dark:text-white/90">
                  Python engines
                </strong>{' '}
                (SAT + graph algorithms) handle formal verification. Voice mode
                adds{' '}
                <strong className="text-gray-800 dark:text-white/90">
                  Gemini Live
                </strong>{' '}
                for instant spoken feedback and for “Ask CLARITY” read-aloud.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Next.js', 'React Flow', 'FastAPI', 'Gemini 3', 'Gemini Live'].map(
                  (tech) => (
                    <span
                      key={tech}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        isDark
                          ? 'bg-white/10 text-white/80'
                          : 'bg-gray-200/80 text-gray-700'
                      }`}
                      style={{ fontFamily: fonts.system }}
                    >
                      {tech}
                    </span>
                  )
                )}
              </div>
            </header>

            {/* Two ways to analyze */}
            <section className="mb-14">
              <h2
                className={sectionHeading}
                style={{ fontFamily: fonts.ui }}
              >
                <div
                  className={`${accentBar} shrink-0`}
                  style={{ backgroundColor: colors.evidence }}
                />
                <GitBranch className="h-6 w-6 text-gray-500 dark:text-white/50 shrink-0" />
                Two ways to analyze
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <div
                  className={`${cardBase} ${isDark ? cardDark : cardLight} flex gap-4`}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: colors.claim }}
                  >
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-gray-900 dark:text-white mb-2"
                      style={{ fontFamily: fonts.ui }}
                    >
                      Text mode
                    </h3>
                    <p
                      className="text-sm text-gray-600 dark:text-white/70 leading-relaxed"
                      style={{ fontFamily: fonts.ui }}
                    >
                      You type → the app calls the backend{' '}
                      <code
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          isDark ? 'bg-white/10' : 'bg-gray-200'
                        }`}
                      >
                        /analyze/stream
                      </code>{' '}
                      (SSE). Events stream back: propositions first, then
                      contradictions, fallacies, ambiguities, and the
                      reconstructed argument. The graph and sidebar update in
                      real time.
                    </p>
                  </div>
                </div>
                <div
                  className={`${cardBase} ${isDark ? cardDark : cardLight} flex gap-4`}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: colors.assumption }}
                  >
                    <Mic className="h-6 w-6" />
                  </div>
                  <div>
                    <h3
                      className="font-semibold text-gray-900 dark:text-white mb-2"
                      style={{ fontFamily: fonts.ui }}
                    >
                      Voice mode
                    </h3>
                    <p
                      className="text-sm text-gray-600 dark:text-white/70 leading-relaxed"
                      style={{ fontFamily: fonts.ui }}
                    >
                      You speak; mic audio goes to the backend over WebSocket.{' '}
                      <strong>Gemini Live</strong> returns a short spoken
                      acknowledgment. When you stop, the full transcript runs
                      through the <em>same</em> SSE analysis pipeline as text.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Gemini integration */}
            <section className="mb-14">
              <h2
                className={sectionHeading}
                style={{ fontFamily: fonts.ui }}
              >
                <div
                  className={`${accentBar} shrink-0`}
                  style={{ backgroundColor: colors.bias }}
                />
                <Sparkles className="h-6 w-6 text-gray-500 dark:text-white/50 shrink-0" />
                Gemini integration
              </h2>
              <p
                className="text-sm text-gray-600 dark:text-white/70 leading-relaxed mb-5 max-w-2xl"
                style={{ fontFamily: fonts.ui }}
              >
                We use two Gemini products: <strong>Generate Content</strong>{' '}
                (text/JSON) for understanding and explaining, and{' '}
                <strong>Gemini Live</strong> (audio) for voice.
              </p>
              <div className="space-y-5">
                <div
                  className={`${cardBase} ${isDark ? cardDark : cardLight} border-l-4`}
                  style={{ borderLeftColor: colors.claim }}
                >
                  <h3
                    className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"
                    style={{ fontFamily: fonts.ui }}
                  >
                    <Cpu className="h-5 w-5 opacity-70" />
                    Generate Content (Gemini 3 Flash / Pro)
                  </h3>
                  <p
                    className="text-sm text-gray-600 dark:text-white/70 leading-relaxed"
                    style={{ fontFamily: fonts.ui }}
                  >
                    Powers nine steps: (1) Proposition parser — raw text →
                    propositions, relationships, formal logic. (2) Semantic
                    implications — implicit contradictions for SAT. (3) Semantic
                    contradictions fallback. (4) Validity checker. (5) Ambiguity
                    detector. (6) Tension detector. (7) Temporal tracker. (8)
                    Argument reconstructor. (9) Pre-generated explanation for
                    “Ask CLARITY.”
                  </p>
                </div>
                <div
                  className={`${cardBase} ${isDark ? cardDark : cardLight} border-l-4`}
                  style={{ borderLeftColor: colors.assumption }}
                >
                  <h3
                    className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"
                    style={{ fontFamily: fonts.ui }}
                  >
                    <MessageSquare className="h-5 w-5 opacity-70" />
                    Gemini Live (native audio)
                  </h3>
                  <p
                    className="text-sm text-gray-600 dark:text-white/70 leading-relaxed"
                    style={{ fontFamily: fonts.ui }}
                  >
                    <strong>Voice acknowledgment</strong> — mic → Live returns
                    “I heard you…” while analysis runs on SSE.{' '}
                    <strong>Ask CLARITY</strong> — cached explanation text →
                    Live read-aloud → PCM audio, accumulate-then-play for
                    natural speech.
                  </p>
                </div>
              </div>
            </section>

            {/* Pipeline */}
            <section className="mb-14">
              <h2
                className={sectionHeading}
                style={{ fontFamily: fonts.ui }}
              >
                <div
                  className={`${accentBar} shrink-0`}
                  style={{ backgroundColor: colors.adversarial }}
                />
                <Workflow className="h-6 w-6 text-gray-500 dark:text-white/50 shrink-0" />
                Pipeline
              </h2>
              <div className="relative pl-8">
                {/* Vertical connector */}
                <div
                  className={`absolute left-[19px] top-12 bottom-12 w-0.5 -translate-x-1/2 ${
                    isDark ? 'bg-white/10' : 'bg-gray-200'
                  }`}
                />
                <div className="space-y-8">
                  {[
                    {
                      step: 1,
                      color: colors.claim,
                      title: 'Parse with Gemini',
                      body: 'Gemini extracts propositions (premises, conclusions, assumptions, evidence, constraints, risks) and relationships (supports, contradicts, assumes, concludes_from). Each proposition gets a formal expression (e.g. P → Q, ¬R). The rest of the pipeline runs on this structure.',
                    },
                    {
                      step: 2,
                      color: colors.evidence,
                      title: 'Verify with SAT & graph algorithms',
                      body: 'Propositions and relationships are converted to CNF. Glucose3 SAT solver: if UNSAT, contradiction is proven (minimal core + formal proof). NetworkX detects circular reasoning, hasty generalization, false dilemma, load-bearing assumptions. Gemini validity checker: argument form and formal fallacies.',
                    },
                    {
                      step: 3,
                      color: colors.bias,
                      title: 'Ambiguities, tensions, reconstruction',
                      body: 'Gemini finds ambiguous terms, practical tensions, and temporal drift. It reconstructs a coherent argument and presentable summary. App pre-generates spoken-style explanation and caches it for “Ask CLARITY” (Gemini Live read-aloud).',
                    },
                  ].map(({ step, color, title, body }) => (
                    <div
                      key={step}
                      className={`relative ${cardBase} ${isDark ? cardDark : cardLight} flex gap-5`}
                    >
                      <div
                        className="absolute -left-8 top-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-lg"
                        style={{ backgroundColor: color }}
                      >
                        {step}
                      </div>
                      <div className="min-w-0 flex-1 pl-2">
                        <h3
                          className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                          style={{ fontFamily: fonts.ui }}
                        >
                          {title}
                        </h3>
                        <p
                          className="text-sm text-gray-600 dark:text-white/70 leading-relaxed"
                          style={{ fontFamily: fonts.ui }}
                        >
                          {body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Analysis Engines */}
            <section className="mb-14">
              <h2
                className={sectionHeading}
                style={{ fontFamily: fonts.ui }}
              >
                <div
                  className={`${accentBar} shrink-0`}
                  style={{ backgroundColor: colors.evidence }}
                />
                <Zap className="h-6 w-6 text-gray-500 dark:text-white/50 shrink-0" />
                Analysis engines
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    color: colors.adversarial,
                    icon: Shield,
                    title: 'Adversarial / tension',
                    desc: 'Gemini tension detector: practical tensions and probing questions.',
                  },
                  {
                    color: colors.assumption,
                    icon: Lightbulb,
                    title: 'Assumption & ambiguity',
                    desc: 'Gemini: ambiguous terms and clarification questions; parser and graph: implicit and load-bearing assumptions.',
                  },
                  {
                    color: colors.evidence,
                    icon: Cpu,
                    title: 'SAT verification',
                    desc: 'CNF + Glucose3: formal proof and minimal core. NetworkX: circular reasoning and structural fallacies.',
                  },
                  {
                    color: colors.claim,
                    icon: Workflow,
                    title: 'Reconstruction',
                    desc: 'Gemini argument reconstructor: presentable argument and summary in insights.',
                  },
                ].map(({ color, icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className={`${cardBase} ${isDark ? cardDark : cardLight} border-l-4 flex gap-3`}
                    style={{ borderLeftColor: color }}
                  >
                    <Icon
                      className="h-5 w-5 shrink-0 opacity-80"
                      style={{ color }}
                    />
                    <div>
                      <h4
                        className="font-semibold text-gray-900 dark:text-white mb-1"
                        style={{ fontFamily: fonts.ui }}
                      >
                        {title}
                      </h4>
                      <p
                        className="text-sm text-gray-600 dark:text-white/70"
                        style={{ fontFamily: fonts.ui }}
                      >
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <div
              className={`rounded-2xl border p-8 text-center transition-colors ${
                isDark
                  ? 'border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent'
                  : 'border-blue-200 bg-gradient-to-br from-blue-50/80 to-gray-50/50'
              }`}
            >
              <h3
                className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
                style={{ fontFamily: fonts.ui }}
              >
                Ready to try it?
              </h3>
              <p
                className="text-gray-600 dark:text-white/70 mb-6"
                style={{ fontFamily: fonts.ui }}
              >
                See CLARITY analyze a real decision in under a minute
              </p>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
                style={{ fontFamily: fonts.system }}
              >
                Start Analyzing
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
