'use client';

import { Header } from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { ParticleBackground } from '@/components/effects/ParticleBackground';
import { fonts } from '@/lib/design-tokens';
import Link from 'next/link';

export default function About() {
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
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6" style={{ fontFamily: fonts.ui }}>
              About CLARITY
            </h1>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4" style={{ fontFamily: fonts.ui }}>
                What is CLARITY?
              </h2>
              <p className="text-gray-700 dark:text-white/80 leading-relaxed" style={{ fontFamily: fonts.ui }}>
                CLARITY is a <strong>formal logic verification engine</strong> that brings mathematical rigor to human reasoning. It uses Gemini for natural language translation and Python SAT solvers + graph algorithms for deterministic verification.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4" style={{ fontFamily: fonts.ui }}>
                Technical Stack
              </h2>
              <div className="space-y-2 text-sm text-gray-700 dark:text-white/70" style={{ fontFamily: fonts.ui }}>
                <p><strong>Backend:</strong> Python, FastAPI, pysat (Glucose3), NetworkX</p>
                <p><strong>Frontend:</strong> Next.js, React Flow, Framer Motion</p>
                <p><strong>AI:</strong> Gemini (translation and insight generation)</p>
                <p><strong>Algorithms:</strong> SAT solving, graph cycle detection, fallacy detection</p>
              </div>
            </section>

            <div className="pt-4">
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
