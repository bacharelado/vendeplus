import {defineConfig, devices} from '@playwright/test';

const externalUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {timeout: 10_000},
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', {open: 'never', outputFolder: 'playwright-report'}]
  ],
  outputDir: 'test-results',
  use: {
    baseURL: externalUrl || 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000
  },
  projects: [
    {name: 'desktop-chromium', use: {...devices['Desktop Chrome']}},
    {name: 'mobile-chromium', use: {...devices['Pixel 7'], defaultBrowserType: 'chromium'}}
  ],
  ...(externalUrl ? {} : {
    webServer: {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  })
});
