import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import securityHeaders from './scripts/security-headers.mjs';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://rablo.store',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  outDir: process.env.CUMID_E2E === '1' ? './dist-e2e' : './dist',
  trailingSlash: 'never',
  server: { host: true, port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare'],
    },
  },
  integrations: [
    react(),
    securityHeaders(),
  ],
});
