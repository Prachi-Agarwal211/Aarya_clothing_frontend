// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Configuration for Aarya Clothing E-commerce Platform
 * 
 * This configuration supports:
 * - Multi-browser testing (Chrome, Firefox, Safari)
 * - Mobile and desktop viewport testing
 * - Parallel test execution
 * - Screenshots and video recording on failure
 * - Trace collection for debugging
 * - CI/CD integration
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  
  /* Output directory for test artifacts */
  outputDir: './test-results',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only to handle flaky tests */
  retries: process.env.CI ? 2 : 1,
  
  /* Number of parallel workers */
  workers: process.env.CI ? 2 : undefined,
  
  /* Reporter to use - HTML, List, and JSON */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list', { printSteps: true }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  
  /* Shared settings for all projects */
  use: {
    /* Base URL for all tests */
    baseURL: process.env.BASE_URL || 'http://localhost:6004',
    
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',
    
    /* Maximum time each action can take */
    actionTimeout: 15000,
    
    /* Maximum time each test can take */
    timeout: 120000,
    
    /* Navigation timeout */
    navigationTimeout: 30000,
    
    /* Set default viewport */
    viewport: { width: 1920, height: 1080 },
    
    /* Ignore HTTPS errors in development */
    ignoreHTTPSErrors: true,
    
    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en',
    },
    
    /* Record HAR file for network debugging */
    recordHAR: {
      mode: 'minimal',
      path: './test-results/har',
    },
  },
  
  /* Configure projects for different browsers and viewports */
  projects: [
    /* Desktop Browsers */
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    
    /* Mobile Viewports */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
    },
    
    /* Tablet Viewport */
    {
      name: 'iPad',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 },
      },
    },
    
    /* Test against branded browsers */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],
  
  /* Global setup file */
  globalSetup: require.resolve('./tests/global-setup'),
  
  /* Global teardown file */
  globalTeardown: require.resolve('./tests/global-teardown'),
});
