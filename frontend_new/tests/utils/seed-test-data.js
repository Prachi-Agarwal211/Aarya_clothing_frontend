/**
 * Test Data Seeding Script
 * 
 * This script seeds the database with test data for E2E tests.
 * Run this before executing the test suite.
 * 
 * Usage:
 *   node tests/utils/seed-test-data.js
 *   npm run test:seed
 */

const fs = require('fs');
const path = require('path');

// Test data configuration
const testData = {
  users: {
    customer: {
      email: `test.customer.${Date.now()}@aaryaclothing.com`,
      password: 'TestPassword123!',
      phone: '9876543210',
      firstName: 'Test',
      lastName: 'Customer',
      addresses: [
        {
          name: 'Test Customer',
          phone: '9876543210',
          addressLine1: '123 Test Street',
          addressLine2: 'Test Area',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          type: 'home',
          isDefault: true,
        },
      ],
    },
    admin: {
      email: `test.admin.${Date.now()}@aaryaclothing.com`,
      password: 'AdminPassword123!',
      role: 'admin',
      firstName: 'Test',
      lastName: 'Admin',
    },
    staff: {
      email: `test.staff.${Date.now()}@aaryaclothing.com`,
      password: 'StaffPassword123!',
      role: 'staff',
      firstName: 'Test',
      lastName: 'Staff',
      permissions: ['products:read', 'products:write', 'orders:read'],
    },
  },
  products: [
    {
      name: 'Test Kurti - Blue',
      description: 'Beautiful blue kurti for testing',
      category: 'kurti',
      price: 1999,
      comparePrice: 2499,
      sku: 'TEST-KURTI-BLU-001',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      colors: ['Blue'],
      stock: 100,
      status: 'active',
      images: [],
    },
    {
      name: 'Test Dress - Red',
      description: 'Elegant red dress for testing',
      category: 'dress',
      price: 2999,
      comparePrice: 3999,
      sku: 'TEST-DRESS-RED-001',
      sizes: ['S', 'M', 'L'],
      colors: ['Red'],
      stock: 50,
      status: 'active',
      images: [],
    },
    {
      name: 'Test Lehenga - Green',
      description: 'Traditional green lehenga for testing',
      category: 'lehenga',
      price: 4999,
      comparePrice: 6999,
      sku: 'TEST-LEHENG-GRN-001',
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Green'],
      stock: 25,
      status: 'active',
      images: [],
    },
  ],
  orders: [
    {
      orderNumber: 'TEST-ORD-001',
      customerId: null, // Will be set after customer creation
      items: [
        {
          productId: null, // Will be set after product creation
          name: 'Test Kurti - Blue',
          size: 'M',
          color: 'Blue',
          quantity: 1,
          price: 1999,
        },
      ],
      subtotal: 1999,
      tax: 360,
      shipping: 0,
      total: 2359,
      status: 'delivered',
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      shippingAddress: {
        name: 'Test Customer',
        phone: '9876543210',
        addressLine1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      orderNumber: 'TEST-ORD-002',
      customerId: null,
      items: [
        {
          productId: null,
          name: 'Test Dress - Red',
          size: 'L',
          color: 'Red',
          quantity: 1,
          price: 2999,
        },
      ],
      subtotal: 2999,
      tax: 540,
      shipping: 50,
      total: 3589,
      status: 'processing',
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      shippingAddress: {
        name: 'Test Customer',
        phone: '9876543210',
        addressLine1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  categories: [
    { name: 'Kurti', slug: 'kurti', description: 'Traditional kurtis' },
    { name: 'Dress', slug: 'dress', description: 'Western dresses' },
    { name: 'Lehenga', slug: 'lehenga', description: 'Traditional lehengas' },
    { name: 'Saree', slug: 'saree', description: 'Elegant sarees' },
  ],
};

/**
 * Seed test data to file
 */
function seedTestData() {
  console.log('🌱 Starting test data seeding...');
  
  const testDataDir = path.join(__dirname, '..', 'data');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
  
  // Write test data to file
  const testDataPath = path.join(testDataDir, 'test-data.json');
  fs.writeFileSync(testDataPath, JSON.stringify(testData, null, 2));
  
  console.log(`✅ Test data saved to: ${testDataPath}`);
  
  // Also write to root tests/data directory
  const rootTestDataDir = path.join(__dirname, '..', '..', 'tests', 'data');
  if (!fs.existsSync(rootTestDataDir)) {
    fs.mkdirSync(rootTestDataDir, { recursive: true });
  }
  
  const rootTestDataPath = path.join(rootTestDataDir, 'test-data.json');
  fs.writeFileSync(rootTestDataPath, JSON.stringify(testData, null, 2));
  
  console.log(`✅ Test data saved to: ${rootTestDataPath}`);
  
  // Print summary
  console.log('\n📊 Test Data Summary:');
  console.log(`   - Users: ${Object.keys(testData.users).length}`);
  console.log(`   - Products: ${testData.products.length}`);
  console.log(`   - Orders: ${testData.orders.length}`);
  console.log(`   - Categories: ${testData.categories.length}`);
  
  console.log('\n📝 Test Credentials:');
  console.log(`   Customer: ${testData.users.customer.email} / ${testData.users.customer.password}`);
  console.log(`   Admin: ${testData.users.admin.email} / ${testData.users.admin.password}`);
  console.log(`   Staff: ${testData.users.staff.email} / ${testData.users.staff.password}`);
  
  console.log('\n✅ Test data seeding completed successfully!');
  
  return testData;
}

/**
 * Clear test data
 */
function clearTestData() {
  console.log('🧹 Clearing test data...');
  
  const testDataPaths = [
    path.join(__dirname, '..', 'data', 'test-data.json'),
    path.join(__dirname, '..', '..', 'tests', 'data', 'test-data.json'),
  ];
  
  for (const testDataPath of testDataPaths) {
    if (fs.existsSync(testDataPath)) {
      fs.unlinkSync(testDataPath);
      console.log(`✅ Deleted: ${testDataPath}`);
    }
  }
  
  console.log('✅ Test data cleared successfully!');
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--clear') || args.includes('-c')) {
    clearTestData();
  } else {
    seedTestData();
  }
}

module.exports = { seedTestData, clearTestData, testData };
