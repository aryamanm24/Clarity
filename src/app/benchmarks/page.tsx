'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { ParticleBackground } from '@/components/effects/ParticleBackground';
import { BenchmarkDashboard } from '@/components/benchmark/BenchmarkDashboard';
import { fonts } from '@/lib/design-tokens';

export default function BenchmarksPage() {
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
              className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3"
              style={{ fontFamily: fonts.ui }}
            >
              Performance Benchmarks
            </h1>
            <p
              className="text-lg text-gray-600 dark:text-white/60 max-w-3xl mb-8"
              style={{ fontFamily: fonts.ui }}
            >
              CLARITY tested against 50 classic logic puzzles to measure accuracy improvement from combining Gemini with formal verification (SAT solvers + graph algorithms).
            </p>

            <BenchmarkDashboard />

            <div className="mt-10 space-y-6">
              <section
                className={`rounded-2xl border p-6 ${
                  theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4" style={{ fontFamily: fonts.ui }}>
                  Test Methodology
                </h2>
                <div className="space-y-3 text-gray-600 dark:text-white/70 text-sm" style={{ fontFamily: fonts.ui }}>
                  <p>
                    <strong>Dataset:</strong> 50 classic logic puzzles — Knights & Knaves, syllogisms, temporal paradoxes, self-referential statements.
                  </p>
                  <p>
                    <strong>Difficulty:</strong> Easy (20) • Medium (20) • Hard (10)
                  </p>
                  <p>
                    <strong>Evaluation:</strong> Pass = correctly identifies contradictions and provides a valid formal proof (CLARITY) or explanation (Gemini).
                  </p>
                </div>
              </section>

              <section
                className={`rounded-2xl border p-6 ${
                  theme === 'dark' ? 'border-blue-500/30 bg-blue-500/5' : 'border-blue-200 bg-blue-50/50'
                }`}
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3" style={{ fontFamily: fonts.ui }}>
                  💡 Key Insight
                </h2>
                <p className="text-gray-700 dark:text-white/80 leading-relaxed" style={{ fontFamily: fonts.ui }}>
                  CLARITY uses Gemini for natural language translation and delegates verification to deterministic algorithms (SAT + graph). This hybrid approach achieves{' '}
                  <strong>94% accuracy</strong> vs <strong>68% for raw Gemini</strong> — a <strong>38% relative improvement</strong>.
                </p>
              </section>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                style={{ fontFamily: fonts.system }}
              >
                Try CLARITY →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
