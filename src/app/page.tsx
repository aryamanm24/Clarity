'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { ParticleBackground } from '@/components/effects/ParticleBackground';

const EXAMPLES = [
  {
    label: 'Medical Dilemma',
    text: "I'm allergic to penicillin - I had a severe anaphylactic reaction when I was 12 and my doctor confirmed I should never take it again. Last month, my new doctor prescribed amoxicillin. I've been taking it daily for three weeks with no issues. I trust both doctors completely.",
  },
  {
    label: 'Career Decision',
    text: "My cousin dropped out of college and started a tech company that sold for $50 million. Therefore, college is a waste of time and money for anyone interested in entrepreneurship. The path to startup success is to drop out and start coding immediately.",
  },
  {
    label: 'Business Strategy',
    text: "We need to hire 20 more engineers to meet our product deadline, but we also need to cut operating costs by 30% this quarter. I believe we can achieve both goals simultaneously without any trade-offs.",
  },
];

export default function HomePage() {
  const [input, setInput] = useState('');
  const router = useRouter();
  const { theme } = useTheme();

  const handleSubmit = (text?: string) => {
    const query = text || input;
    if (!query.trim()) return;
    const encoded = encodeURIComponent(query.trim());
    router.push(`/analyze?q=${encoded}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0e10] flex flex-col transition-colors relative overflow-hidden">
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {/* Particle background (dark mode only) */}
        {theme === 'dark' && <ParticleBackground />}

        {/* Background glows (dark mode) */}
        {theme === 'dark' && (
          <>
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
          </>
        )}

        <div className="relative w-full max-w-3xl space-y-8 z-10">
          {/* Header — minimal, tool-like */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              What are you thinking about?
            </h1>
          </div>

          {/* Input bar — THE focal point, large and inviting */}
          <div className="relative">
            <div
              className={`
                flex items-center gap-2 rounded-2xl px-4 py-4 transition-all
                bg-gray-50 dark:bg-white/[0.04]
                border border-gray-200 dark:border-white/[0.1]
                focus-within:border-blue-500/40 focus-within:ring-1 focus-within:ring-blue-500/20
              `}
            >
              {/* Mic button */}
              <button
                onClick={() => router.push('/analyze?mode=voice')}
                className="p-2 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors shrink-0"
                title="Use voice input"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-4-18a3 3 0 00-3 3v8a3 3 0 006 0V7a3 3 0 00-3-3z"
                  />
                </svg>
              </button>

              {/* Text input — multiline for longer arguments */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Share an argument, decision, or dilemma..."
                rows={1}
                className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 text-base resize-none focus:outline-none leading-relaxed"
                style={{ minHeight: '24px', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = '24px';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />

              {/* Submit */}
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                className="p-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>

            {/* Subtle helper text */}
            <p className="text-xs text-gray-600 dark:text-gray-500 mt-2 text-center">
              Press Enter to analyze · Shift+Enter for new line · 🎤 for voice
            </p>
          </div>

          {/* Subtitle */}
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-lg mx-auto">
            Type or speak an argument, decision, or dilemma. CLARITY will map your reasoning and find the gaps.
          </p>

          {/* Example cards — interactive, show what CLARITY can do */}
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider text-center">
              Try an example
            </p>

            <div className="grid gap-3">
              {EXAMPLES.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleSubmit(example.text)}
                  className={`
                    group w-full text-left rounded-xl p-4 transition-all
                    bg-gray-50 dark:bg-white/[0.02]
                    border border-gray-200 dark:border-white/[0.06]
                    hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.12]
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors mb-1">
                        {example.label}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors line-clamp-2 leading-relaxed">
                        {example.text}
                      </p>
                    </div>
                    <svg
                      className="w-4 h-4 text-gray-500 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors shrink-0 mt-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer caption */}
          <p className="text-xs text-gray-600 dark:text-gray-500 text-center">
            Powered by formal verification · SAT solvers · Graph algorithms · Gemini
          </p>
        </div>
      </div>
    </div>
  );
}
