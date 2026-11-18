import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4322',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx astro dev --port 4322 --force',
    url: 'http://localhost:4322',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      XDG_CONFIG_HOME: './.wrangler-config',
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      ALL_PROXY: '',
    },
  },
  projects: [
    {
      name: 'msedge',
      use: { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' },
    },
  ],
});
