import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.PWA_TEST_PORT || 4173);

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  expect: { timeout: 20000 },
  use: {
    baseURL: `http://127.0.0.1:${port}/SV-Mochenwangen-Web/`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    // Prevent external traffic even when a service worker bypasses routing.
    proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: {
    command: `node scripts/serve.mjs --base=/SV-Mochenwangen-Web/ --port=${port}`,
    url: `http://127.0.0.1:${port}/SV-Mochenwangen-Web/`,
    reuseExistingServer: false,
  },
});
