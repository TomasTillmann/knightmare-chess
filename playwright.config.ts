import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 4,
  timeout: 20_000,
  expect: { timeout: 4_000 },
  reporter: 'line',
  use: {
    baseURL: process.env.UI_BASE_URL ?? 'http://127.0.0.1:5174', channel: 'chrome',
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1080 } } },
    { name: 'mobile',
      testMatch: process.env.UI_STRESS ? undefined : /(?:presentation|obligations|pointer-inputs|long-flows)\.spec\.ts/,
      use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.UI_BASE_URL ? undefined : {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174', reuseExistingServer: !process.env.CI,
  },
});
