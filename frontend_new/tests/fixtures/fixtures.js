/**
 * Playwright Test Fixtures for Aarya Clothing
 * 
 * This file defines custom fixtures that can be used across all tests:
 * - authenticatedPage: Page with logged-in customer
 * - adminPage: Page with logged-in admin
 * - staffPage: Page with logged-in staff
 * - seededProducts: Products seeded in database
 * - cartWithItems: Cart with items added
 */

import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Load test data from global setup
 */
function getTestData() {
  const testDataPath = process.env.TEST_DATA_PATH || path.join(__dirname, 'data', 'test-data.json');
  if (fs.existsSync(testDataPath)) {
    return JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
  }
  return null;
}

/**
 * Base test fixture with custom extensions
 */
export const test = base.extend({
  /**
   * Test data from global setup
   */
  testData: async ({}, use) => {
    const data = getTestData();
    await use(data);
  },

  /**
   * Authenticated customer page
   * Automatically logs in a test customer before each test
   */
  authenticatedPage: async ({ page, testData }, use) => {
    const customer = testData?.users?.customer;
    
    if (!customer) {
      throw new Error('Test customer data not found. Run global setup first.');
    }
    
    // Navigate to login page
    await page.goto('/auth/login');
    
    // Fill login form
    await page.fill('input[name="email"]', customer.email);
    await page.fill('input[name="password"]', customer.password);
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for successful login (redirect to profile or home)
    await page.waitForURL(/\/(profile|home)?$/, { timeout: 10000 });
    
    // Verify login succeeded
    const profileLink = page.locator('a[href="/profile"]');
    await expect(profileLink).toBeVisible({ timeout: 5000 });
    
    await use(page);
    
    // Optional: Logout after test
    // await page.goto('/auth/logout');
  },

  /**
   * Admin authenticated page
   * Automatically logs in as admin before each test
   */
  adminPage: async ({ page, testData }, use) => {
    const admin = testData?.users?.admin;
    
    if (!admin) {
      throw new Error('Test admin data not found. Run global setup first.');
    }
    
    // Navigate to admin login
    await page.goto('/admin/landing');
    
    // Fill admin login form
    await page.fill('input[name="email"]', admin.email);
    await page.fill('input[name="password"]', admin.password);
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
    
    // Verify admin dashboard loaded
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    
    await use(page);
  },

  /**
   * Staff authenticated page
   * Automatically logs in as staff before each test
   */
  staffPage: async ({ page, testData }, use) => {
    const staff = testData?.users?.staff;
    
    if (!staff) {
      throw new Error('Test staff data not found. Run global setup first.');
    }
    
    // Navigate to staff login
    await page.goto('/admin/landing');
    
    // Fill staff login form
    await page.fill('input[name="email"]', staff.email);
    await page.fill('input[name="password"]', staff.password);
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
    
    await use(page);
  },

  /**
   * Page with products in cart
   * Adds products to cart before each test
   */
  cartWithItems: async ({ page, testData }, use) => {
    const customer = testData?.users?.customer;
    
    // Login first
    if (customer) {
      await page.goto('/auth/login');
      await page.fill('input[name="email"]', customer.email);
      await page.fill('input[name="password"]', customer.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(profile|home)?$/, { timeout: 10000 });
    }
    
    // Navigate to first product
    await page.goto('/products/1');
    
    // Add to cart
    const addToCartButton = page.locator('button:has-text("Add to Cart"), button:has-text("Add to Bag")');
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      await page.waitForTimeout(1000); // Wait for cart to update
    }
    
    // Navigate to second product and add
    await page.goto('/products/2');
    if (await addToCartButton.isVisible()) {
      await addToCartButton.click();
      await page.waitForTimeout(1000);
    }
    
    await use(page);
  },

  /**
   * Mobile viewport fixture
   */
  mobilePage: async ({ page }, use) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await use(page);
  },

  /**
   * Tablet viewport fixture
   */
  tabletPage: async ({ page }, use) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await use(page);
  },

  /**
   * Desktop viewport fixture (default)
   */
  desktopPage: async ({ page }, use) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await use(page);
  },
});

/**
 * Export expect for convenience
 */
export { expect };

/**
 * Export describe for test organization
 */
export const describe = test.describe;
export const it = test;
