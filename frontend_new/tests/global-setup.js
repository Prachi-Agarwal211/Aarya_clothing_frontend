/**
 * Global Setup for Playwright Tests
 * 
 * This file runs once before all tests and is used for:
 * - Database seeding
 * - Test user creation
 * - Setting up test data
 * - Starting test servers if needed
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Seed test data into the database
 * This would typically call your backend API to create test data
 */
async function seedTestData() {
  console.log('🌱 Seeding test data...');
  
  // Create test data directory if it doesn't exist
  const testDataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Sample test data
  const testData = {
    users: {
      customer: {
        email: `test.customer.${Date.now()}@aaryaclothing.com`,
        password: 'TestPassword123!',
        phone: '9876543210',
        firstName: 'Test',
        lastName: 'Customer',
      },
      admin: {
        email: `test.admin.${Date.now()}@aaryaclothing.com`,
        password: 'AdminPassword123!',
        role: 'admin',
      },
      staff: {
        email: `test.staff.${Date.now()}@aaryaclothing.com`,
        password: 'StaffPassword123!',
        role: 'staff',
      },
    },
    products: [
      {
        name: 'Test Product - Kurti',
        category: 'kurti',
        price: 1999,
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['Red', 'Blue'],
      },
      {
        name: 'Test Product - Dress',
        category: 'dress',
        price: 2999,
        sizes: ['S', 'M', 'L'],
        colors: ['Black', 'White'],
      },
    ],
  };
  
  // Save test data to file for use in tests
  fs.writeFileSync(
    path.join(testDataDir, 'test-data.json'),
    JSON.stringify(testData, null, 2)
  );
  
  console.log('✅ Test data seeded successfully');
  return testData;
}

/**
 * Global setup function
 */
async function globalSetup() {
  console.log('🚀 Starting global setup...');
  
  // Seed test data
  const testData = await seedTestData();
  
  // Store test data path for use in tests
  const testDataPath = path.join(__dirname, 'data', 'test-data.json');
  process.env.TEST_DATA_PATH = testDataPath;
  
  // If you have a test database, you might want to reset it here
  // Example: await resetTestDatabase();
  
  // If you need to start a test server, do it here
  // Example: const server = await startTestServer();
  // process.env.TEST_SERVER_URL = server.url;
  
  console.log('✅ Global setup complete');
  console.log(`📁 Test data saved to: ${testDataPath}`);
}

module.exports = globalSetup;
