import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import securityHeaders from './scripts/security-headers.mjs';
import cloudflare from '@astrojs/cloudflare';

const BUILD_ID =
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  process.env.BUILD_ID ||
  Date.now().toString(36);

// https://astro.build/config
export default defineConfig({
  site: 'https://rijlo.com',
  adapter: cloudflare({ imageService: 'passthrough' }),
  build: {
    inlineStylesheets: 'always',
  },
  session: false,
  outDir: process.env.CUMID_E2E === '1' ? './dist-e2e' : './dist',
  trailingSlash: 'never',
  server: { host: true, port: 4321 },
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lucide-react')) {
              return 'lucide-icons';
            }
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare'],
    },
  },
  integrations: [
    react(),
    securityHeaders(),
  ],
});
