import { defineConfig, devices } from '@playwright/test'

// Readiness probes must reach loopback directly even when a system proxy is set.
process.env.NO_PROXY = [process.env.NO_PROXY, process.env.no_proxy, 'localhost', '127.0.0.1'].filter(Boolean).join(',')
process.env.no_proxy = process.env.NO_PROXY

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/e2e-server.mjs',
      url: 'http://127.0.0.1:3211/api/status',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3000 --strictPort',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: 'http://127.0.0.1:3211' },
    },
  ],
})
