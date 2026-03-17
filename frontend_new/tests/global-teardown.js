/**
 * Global Teardown for Playwright Tests
 * 
 * This file runs once after all tests and is used for:
 * - Cleaning up test data
 * - Removing temporary files
 * - Stopping test servers
 * - Generating test reports
 */

const fs = require('fs');
const path = require('path');

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  const testDataPath = path.join(__dirname, 'data', 'test-data.json');
  
  // Optionally remove test data file
  // Uncomment if you want to clean up after tests
  // if (fs.existsSync(testDataPath)) {
  //   fs.unlinkSync(testDataPath);
  // }
  
  console.log('✅ Test data cleanup complete');
}

/**
 * Clean up test artifacts (optional - you might want to keep them for debugging)
 */
async function cleanupArtifacts() {
  console.log('🧹 Cleaning up test artifacts...');
  
  const artifactsDir = path.join(__dirname, '..', 'test-results');
  
  // Only clean up if not in CI (keep artifacts for debugging in CI)
  if (!process.env.CI && fs.existsSync(artifactsDir)) {
    // Remove old artifacts (older than 7 days)
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    const files = fs.readdirSync(artifactsDir);
    for (const file of files) {
      const filePath = path.join(artifactsDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Removed old artifact: ${file}`);
      }
    }
  }
  
  console.log('✅ Artifacts cleanup complete');
}

/**
 * Generate summary report
 */
async function generateSummaryReport() {
  console.log('📊 Generating test summary report...');
  
  const resultsPath = path.join(__dirname, '..', 'test-results', 'results.json');
  
  if (fs.existsSync(resultsPath)) {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    
    const summary = {
      total: results.stats.total,
      passed: results.stats.expected,
      failed: results.stats.unexpected,
      skipped: results.stats.skipped,
      duration: results.stats.duration,
      timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync(
      path.join(__dirname, '..', 'test-results', 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log('✅ Summary report generated');
    console.log(`   Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
  }
}

/**
 * Global teardown function
 */
async function globalTeardown() {
  console.log('🛑 Starting global teardown...');
  
  // Run cleanup tasks
  await cleanupTestData();
  await cleanupArtifacts();
  await generateSummaryReport();
  
  // If you started a test server in globalSetup, stop it here
  // Example: await stopTestServer();
  
  console.log('✅ Global teardown complete');
}

module.exports = globalTeardown;
