import type { Metadata } from 'next';
import { ThemeProvider } from '@/contexts/ThemeContext';
import './globals.css';

// Fonts loaded at runtime via link (avoids build-time fetch; fixes Railway/sandbox builds)
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&family=Merriweather:wght@400;700&family=Space+Grotesk:wght@700&display=swap';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONTS_URL} rel="stylesheet" />
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
