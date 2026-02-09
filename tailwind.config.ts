import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        clarity: {
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
          'surface-hover': '#F3F4F6',
          'surface-dark': '#1F2937',
          
          // Dark mode specific
          'dark-bg': '#0d0e10',
          'dark-card': '#16171b',
          'dark-surface': '#1a1c20',

          // Text
          text: '#1A1A1A',
          'text-secondary': '#6B7280',
          'text-muted': '#9CA3AF',
          'text-on-dark': '#F9FAFB',

          // Status
          verified: '#22C55E',
          unverified: '#F59E0B',
          contradicted: '#EF4444',

          // Edges
          'edge-support': '#22C55E',
          'edge-contradiction': '#EF4444',
          'edge-dependency': '#9CA3AF',
          'edge-adversarial': '#F97316',
        },
      },
      fontFamily: {
        merriweather: ['var(--font-merriweather)', 'Georgia', 'serif'],
        'jetbrains-mono': ['var(--font-jetbrains-mono)', 'monospace'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'contradiction-pulse': 'contradiction-pulse 2s ease-in-out infinite',
        'breathing': 'breathing 3s ease-in-out infinite',
        'edge-draw': 'edge-draw 600ms ease-out forwards',
        'node-glow': 'node-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'contradiction-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'breathing': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'edge-draw': {
          from: { strokeDashoffset: '1000' },
          to: { strokeDashoffset: '0' },
        },
        'node-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
