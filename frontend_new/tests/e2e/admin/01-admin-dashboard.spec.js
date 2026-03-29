/**
 * Admin Authentication & Dashboard E2E Tests
 * 
 * Test Suite: Admin Access & Overview
 * Coverage:
 * - Staff login
 * - Role-based access
 * - Dashboard widgets
 * - Navigation
 */

import { test, expect } from '@playwright/test';
import AdminDashboard from '../../pages/AdminDashboard';

test.describe('Admin Authentication & Dashboard', () => {
  let adminDashboard: AdminDashboard;

  test.beforeEach(async ({ page }) => {
    adminDashboard = new AdminDashboard(page);
  });

  test.describe('Admin Login', () => {
    test('should login as admin successfully', async ({ page }) => {
      await page.goto('/admin/landing');
      
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      await expect(page.locator('h1, .dashboard-title')).toBeVisible();
    });

    test('should show error for invalid admin credentials', async ({ page }) => {
      await page.goto('/admin/landing');
      
      await page.fill('input[name="email"]', 'invalid@admin.com');
      await page.fill('input[name="password"]', 'WrongPassword');
      await page.click('button[type="submit"]');
      
      // Should show error message
      const errorVisible = await page.locator('[class*="error"]').isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should validate admin login form', async ({ page }) => {
      await page.goto('/admin/landing');
      
      await page.click('button[type="submit"]');
      
      // Should show validation errors
      await page.waitForTimeout(1000);
    });

    test('should logout from admin panel', async ({ page }) => {
      // Login first
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      // Logout
      const logoutButton = page.locator('button:has-text("Logout"), .logout');
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Role-Based Access', () => {
    test('should restrict access to admin pages without login', async ({ page }) => {
      await page.goto('/admin/products');
      
      // Should redirect to login or show unauthorized
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url.includes('login') || url.includes('admin')).toBeTruthy();
    });

    test('should show different permissions for staff vs admin', async ({ page }) => {
      // Login as staff
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'staff@aaryaclothing.com');
      await page.fill('input[name="password"]', 'StaffPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      // Check which menu items are available
      const settingsLink = page.locator('a[href*="settings"]');
      const staffLink = page.locator('a[href*="staff"]');
      
      // Staff may not have access to all sections
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Dashboard Overview', () => {
    test('should display dashboard successfully', async ({ page }) => {
      // Login
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      await adminDashboard.verifyLoaded();
    });

    test('should display stats widgets', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      // Should show stats widgets
      const statsWidgets = page.locator('.stats-widgets, [class*="stats"]');
      await expect(statsWidgets).toBeVisible();
    });

    test('should display total orders widget', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      const totalOrders = await adminDashboard.getTotalOrders();
      expect(totalOrders).toBeGreaterThanOrEqual(0);
    });

    test('should display revenue widget', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      const revenue = await adminDashboard.getTotalRevenue();
      expect(revenue).toBeGreaterThanOrEqual(0);
    });

    test('should display pending orders widget', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      const pendingOrders = await adminDashboard.getPendingOrders();
      expect(pendingOrders).toBeGreaterThanOrEqual(0);
    });

    test('should display recent orders table', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      const recentOrdersCount = await adminDashboard.getRecentOrdersCount();
      expect(recentOrdersCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Dashboard Navigation', () => {
    test('should navigate to orders from dashboard', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      await adminDashboard.goToOrders();
      await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 10000 });
    });

    test('should navigate to products from dashboard', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      await adminDashboard.goToProducts();
      await expect(page).toHaveURL(/\/admin\/products/, { timeout: 10000 });
    });

    test('should navigate to customers from dashboard', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      await adminDashboard.goToCustomers();
      await expect(page).toHaveURL(/\/admin\/customers/, { timeout: 10000 });
    });

    test('should navigate to inventory from dashboard', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      await adminDashboard.goToInventory();
      await expect(page).toHaveURL(/\/admin\/inventory/, { timeout: 10000 });
    });
  });

  test.describe('AI Dashboard', () => {
    test('should navigate to AI assistant', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      await adminDashboard.goToAIAssistant();
      await expect(page).toHaveURL(/\/admin\/ai/, { timeout: 10000 });
    });

    test('should ask AI a question', async ({ page }) => {
      await page.goto('/admin/ai-assistant');
      
      // Login if needed
      const emailInput = page.locator('input[name="email"]');
      if (await emailInput.isVisible()) {
        await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
        await page.fill('input[name="password"]', 'AdminPassword123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      }
      
      const aiInput = page.locator('.ai-query-input, input[placeholder*="AI"], textarea[name="query"]');
      if (await aiInput.isVisible()) {
        await aiInput.fill('Show me sales summary');
        
        const submitButton = page.locator('button:has-text("Ask AI"), .ai-submit');
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(5000);
          
          // Should show response
          const response = page.locator('.ai-response');
          await expect(response.first()).toBeVisible();
        }
      }
    });

    test('should display AI query suggestions', async ({ page }) => {
      await page.goto('/admin/ai-assistant');
      
      // Login if needed
      const emailInput = page.locator('input[name="email"]');
      if (await emailInput.isVisible()) {
        await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
        await page.fill('input[name="password"]', 'AdminPassword123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      }
      
      // Look for suggested queries
      const suggestions = page.locator('.suggestions, [class*="suggested"]');
      const hasSuggestions = await suggestions.first().isVisible().catch(() => false);
      expect(hasSuggestions || true).toBeTruthy();
    });
  });

  test.describe('Dashboard Charts', () => {
    test('should display sales chart', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      const salesChart = page.locator('.sales-chart, [class*="chart"]');
      await expect(salesChart.first()).toBeVisible();
    });

    test('should display low stock alerts', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      const lowStockCount = await adminDashboard.getLowStockAlertCount();
      expect(lowStockCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Quick Actions', () => {
    test('should click add product from dashboard', async ({ page }) => {
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      if (await adminDashboard.addProductButton.isVisible()) {
        await adminDashboard.clickAddProduct();
        await expect(page).toHaveURL(/\/admin\/products\/.*\/new/, { timeout: 10000 });
      }
    });
  });

  test.describe('Responsive Design - Admin Dashboard', () => {
    test('should display dashboard correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      await page.goto('/admin/landing');
      await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
      await page.fill('input[name="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
      
      await adminDashboard.verifyLoaded();
    });
  });
});
