import type { Metadata } from 'next';
import { Inter, Merriweather, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from '@/contexts/ThemeContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-merriweather',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CLARITY — Formal Reasoning Infrastructure',
  description: 'Translate natural language thinking into verifiable logical structures',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${merriweather.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('clarity-theme') === 'dark' ||
                    (!localStorage.getItem('clarity-theme') && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-gray-50 dark:bg-[#0d0e10] font-inter antialiased transition-colors" suppressHydrationWarning>
        {/* SVG Grain Filter for cinematic effect */}
        <svg style={{ display: 'none' }} aria-hidden="true">
          <defs>
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.60" numOctaves="3" stitchTiles="stitch"/>
              <feColorMatrix type="saturate" values="0"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.1"/>
              </feComponentTransfer>
              <feComposite operator="in" in2="SourceGraphic"/>
            </filter>
          </defs>
        </svg>
        
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
