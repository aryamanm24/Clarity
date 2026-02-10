'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { fonts } from '@/lib/design-tokens';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/analyze', label: 'Analyze' },
  { href: '/how-it-works', label: 'How It Works' },
];

export const Header = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 dark:backdrop-blur shrink-0 transition-colors">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="group">
          <span
            className="text-2xl font-bold tracking-wider text-gray-900 dark:text-white group-hover:text-clarity-claim dark:group-hover:text-blue-400 transition-all duration-200"
            style={{ 
              fontFamily: 'var(--font-space-grotesk)',
              letterSpacing: '0.05em',
              fontWeight: 700
            }}
          >
            CLARITY
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                }`}
                style={{ fontFamily: fonts.ui }}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          {/* Theme toggle — replaces About, sophisticated compact design */}
          <button
            onClick={toggleTheme}
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-all duration-200"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Moon className="h-4 w-4 text-slate-300" />
            ) : (
              <Sun className="h-4 w-4 text-amber-600" />
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
