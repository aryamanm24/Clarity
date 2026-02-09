'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { ParticleBackground } from '@/components/effects/ParticleBackground';
import { fonts, colors } from '@/lib/design-tokens';

export default function HowItWorksPage() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0e10] flex flex-col transition-colors relative overflow-x-hidden">
      <Header />

      <div className="flex-1 flex items-center justify-center p-6 py-12">
        {theme === 'dark' && <ParticleBackground />}
        {theme === 'dark' && (
          <>
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
          </>
        )}

        <div
          className={`relative w-full max-w-4xl rounded-[32px] overflow-hidden shadow-2xl z-10 ${
            theme === 'dark'
              ? 'bg-white/[0.03] backdrop-blur-xl border border-white/10'
              : 'bg-white border border-gray-200'
          }`}
        >
          <div className="px-8 sm:px-12 py-12">
            <h1
              className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4"
              style={{ fontFamily: fonts.proposition }}
            >
              How CLARITY Works
            </h1>
            <p
              className="text-lg text-gray-600 dark:text-white/60 leading-relaxed mb-12 max-w-2xl"
              style={{ fontFamily: fonts.ui }}
            >
              A multi-step pipeline: Gemini parses natural language into formal logic, then Python SAT solvers and graph algorithms verify it and surface contradictions.
            </p>

            {/* Pipeline Steps */}
            <section className="mb-12">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6" style={{ fontFamily: fonts.ui }}>
                Pipeline
              </h2>
              <div className="space-y-6">
                <div
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white"
                    style={{ backgroundColor: colors.claim }}
                  >
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                    Parse with Gemini
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed" style={{ fontFamily: fonts.ui }}>
                    Gemini extracts propositions (claims, evidence, assumptions) and relationships from your natural language. It translates them into formal logic notation (e.g., P → Q, ¬R) and identifies premises, conclusions, and implicit assumptions.
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white"
                    style={{ backgroundColor: colors.evidence }}
                  >
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                    Verify with SAT & Graph Algorithms
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed" style={{ fontFamily: fonts.ui }}>
                    Python engines run formal verification: a SAT solver (pysat/Glucose3) detects logical contradictions with formal proofs. A graph analyzer (NetworkX) finds circular reasoning, load-bearing assumptions, and structural fallacies. The validity checker validates argument form.
                  </p>
                </div>

                <div
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white"
                    style={{ backgroundColor: colors.bias }}
                  >
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                    Detect Ambiguities & Reconstruct
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-white/70 leading-relaxed" style={{ fontFamily: fonts.ui }}>
                    CLARITY detects ambiguous terms, tensions between claims, and temporal drift across turns. Gemini then reconstructs a coherent argument and generates insights and probing questions.
                  </p>
                </div>
              </div>
            </section>

            {/* Analysis Engines */}
            <section className="mb-12">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6" style={{ fontFamily: fonts.ui }}>
                Analysis Engines
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div
                  className={`rounded-2xl border-l-4 p-5 ${
                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                  }`}
                  style={{ borderLeftColor: colors.adversarial }}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                    ⚔️ Adversarial / Tension Detection
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-white/70" style={{ fontFamily: fonts.ui }}>
                    Surfaces tensions between propositions and generates probing questions to stress-test your reasoning.
                  </p>
                </div>
                <div
                  className={`rounded-2xl border-l-4 p-5 ${
                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                  }`}
                  style={{ borderLeftColor: colors.assumption }}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                    ⚓ Assumption & Ambiguity Detection
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-white/70" style={{ fontFamily: fonts.ui }}>
                    Excavates implicit assumptions, load-bearing claims, and ambiguous terms that could undermine your argument.
                  </p>
                </div>
                <div
                  className={`rounded-2xl border-l-4 p-5 ${
                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                  }`}
                  style={{ borderLeftColor: colors.evidence }}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                    🎯 Precision / SAT Verification
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-white/70" style={{ fontFamily: fonts.ui }}>
                    Translates propositions to CNF and runs SAT solvers to detect contradictions with formal proofs.
                  </p>
                </div>
                <div
                  className={`rounded-2xl border-l-4 p-5 ${
                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                  }`}
                  style={{ borderLeftColor: colors.claim }}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                    💡 Signal / Reconstruction
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-white/70" style={{ fontFamily: fonts.ui }}>
                    Reconstructs a coherent argument and extracts the most critical insights from the full analysis.
                  </p>
                </div>
              </div>
            </section>

            {/* CTA */}
            <div
              className={`rounded-2xl border p-8 text-center ${
                theme === 'dark' ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50/50'
              }`}
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: fonts.ui }}>
                Ready to try it?
              </h3>
              <p className="text-gray-600 dark:text-white/70 mb-6" style={{ fontFamily: fonts.ui }}>
                See CLARITY analyze a real decision in under a minute
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                style={{ fontFamily: fonts.system }}
              >
                Start Analyzing →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
