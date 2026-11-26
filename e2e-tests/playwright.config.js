// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { MONGO_URI, JWT_SECRET, API_URL, APP_URL } = require('./utils/env');

module.exports = defineConfig({
  testDir: './tests',
  // Tests share one database and server, so run them one at a time for
  // deterministic results.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: require.resolve('./utils/global-setup'),
  projects: [
    // UI tests run in all three browser engines.
    { name: 'chromium', testIgnore: /api\//, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testIgnore: /api\//, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testIgnore: /api\//, use: { ...devices['Desktop Safari'] } },
    // API-level tests (no browser) run once.
    { name: 'api', testMatch: /api\/.*\.spec\.js/ },
  ],
  // Start the API and the React dev server. If they are already running
  // locally they are reused.
  webServer: [
    {
      command: 'npm start',
      cwd: '../app',
      url: API_URL,
      reuseExistingServer: true,
      timeout: 60_000,
      env: { PORT: '5000', MONGO_URI, JWT_SECRET },
    },
    // The React app is tested as a production build (no dev-server hot reload,
    // which reacts to offline mode and made network tests flaky).
    {
      command: 'npm run build --prefix ../app/blog-client && npx serve -s ../app/blog-client/build -l 3000 --no-request-logging',
      url: APP_URL,
      reuseExistingServer: true,
      timeout: 240_000,
    },
  ],
});
