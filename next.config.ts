import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16 default bundler)
  // Pin root to this project so module resolution doesn't climb to parent package.json
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Webpack fallback for WASM support
  webpack: (config) => {
    // Pin context to this package so resolution doesn't climb to parent (GEMINI_UPD)
    const projectRoot = path.resolve(__dirname);
    config.context = projectRoot;
    config.resolve = config.resolve ?? {};
    config.resolve.modules = [
      path.join(projectRoot, 'node_modules'),
      ...(Array.isArray(config.resolve.modules) ? config.resolve.modules : ['node_modules']),
    ];
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },

  // Headers for SSE streaming
  async headers() {
    return [
      {
        source: '/api/analyze',
        headers: [
          { key: 'Content-Type', value: 'text/event-stream' },
          { key: 'Cache-Control', value: 'no-cache, no-transform' },
          { key: 'Connection', value: 'keep-alive' },
        ],
      },
    ];
  },
};

export default nextConfig;
