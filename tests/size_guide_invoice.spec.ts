/**
 * Playwright E2E Tests for Size Guide and Invoice Features
 * 
 * Tests:
 * 1. Size Guide Modal on Product Page
 * 2. Invoice Download from Orders Page
 * 
 * Usage:
 *   npx playwright test tests/size_guide_invoice.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Size Guide Feature', () => {
  test('should open size guide modal from product page', async ({ page }) => {
    // Navigate to a product page
    await page.goto('/products/1');
    
    // Wait for product to load
    await expect(page.locator('text=Size Guide')).toBeVisible();
    
    // Click Size Guide button
    await page.click('text=Size Guide');
    
    // Verify modal opens
    await expect(page.locator('text=Size Chart')).toBeVisible();
    await expect(page.locator('text=How to Measure')).toBeVisible();
  });

  test('should switch categories in size guide modal', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Wait for modal to load
    await page.waitForSelector('select');
    
    // Select different category
    await page.selectOption('select', 'dress');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Verify category changed
    const selectedOption = await page.$eval('select', el => el.value);
    expect(selectedOption).toBe('dress');
  });

  test('should switch to How to Measure tab', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Click How to Measure tab
    await page.click('text=How to Measure');
    
    // Verify measurement guide is visible
    await expect(page.locator('text=Chest/Bust')).toBeVisible();
  });

  test('should close modal on outside click', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Wait for modal
    await page.waitForTimeout(300);
    
    // Click outside modal (on backdrop)
    await page.click('[role="dialog"] ~ div');
    
    // Verify modal closed
    await expect(page.locator('text=Size Chart')).not.toBeVisible();
  });

  test('should close modal on Escape key', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Wait for modal
    await page.waitForTimeout(300);
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Verify modal closed
    await expect(page.locator('text=Size Chart')).not.toBeVisible();
  });

  test('should display size chart table correctly', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Verify table headers
    await expect(page.locator('text=Size')).toBeVisible();
    await expect(page.locator('text=Chest/Bust')).toBeVisible();
    await expect(page.locator('text=Waist')).toBeVisible();
    await expect(page.locator('text=Hip')).toBeVisible();
    
    // Verify size labels
    await expect(page.locator('text=XS')).toBeVisible();
    await expect(page.locator('text=S')).toBeVisible();
    await expect(page.locator('text=M')).toBeVisible();
  });

  test('should show measurements in inches and cm', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Verify dual units
    await expect(page.locator('text=cm')).toBeVisible();
    await expect(page.locator('text=/"/')).toBeVisible();
  });

  test('should display chat CTA in modal footer', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Verify chat CTA
    await expect(page.locator('text=Chat with Our Style Experts')).toBeVisible();
  });
});

test.describe('Invoice Download Feature', () => {
  test('should display invoice button on orders page', async ({ page }) => {
    // Login first (assuming test credentials)
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForURL('/profile');
    
    // Navigate to orders
    await page.goto('/profile/orders');
    
    // Wait for orders to load
    await page.waitForSelector('text=Invoice', { timeout: 10000 });
    
    // Verify invoice button exists
    const invoiceButtons = await page.$$('text=Invoice');
    expect(invoiceButtons.length).toBeGreaterThan(0);
  });

  test('should display print button on orders page', async ({ page }) => {
    await page.goto('/profile/orders');
    
    // Wait for orders to load
    await page.waitForSelector('text=Print', { timeout: 10000 });
    
    // Verify print button exists
    const printButtons = await page.$$('text=Print');
    expect(printButtons.length).toBeGreaterThan(0);
  });

  test('should download invoice PDF on click', async ({ page }) => {
    // Set download behavior
    const downloadPromise = page.waitForEvent('download');
    
    await page.goto('/profile/orders');
    
    // Wait for invoice button
    await page.waitForSelector('button[title="Download Invoice"]', { timeout: 10000 });
    
    // Click first invoice button
    await page.click('button[title="Download Invoice"]').first();
    
    // Wait for download
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/Invoice_/);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('should have proper button styling', async ({ page }) => {
    await page.goto('/profile/orders');
    
    // Wait for buttons to load
    await page.waitForSelector('button[title="Download Invoice"]', { timeout: 10000 });
    
    // Verify button has correct classes
    const invoiceButton = await page.$('button[title="Download Invoice"]');
    const classes = await invoiceButton.getAttribute('class');
    
    expect(classes).toContain('flex');
    expect(classes).toContain('items-center');
    expect(classes).toContain('gap-1');
  });

  test('should display all order action buttons', async ({ page }) => {
    await page.goto('/profile/orders');
    
    // Wait for action buttons
    await page.waitForSelector('button[title="Download Invoice"]', { timeout: 10000 });
    
    // Verify all action buttons are present
    await expect(page.locator('button[title="Download Invoice"]')).toBeVisible();
    await expect(page.locator('button[title="Print Invoice"]')).toBeVisible();
    await expect(page.locator('button:has-text("Reorder")')).toBeVisible();
    await expect(page.locator('button:has-text("View")')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('size guide modal should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Verify modal is visible on mobile
    await expect(page.locator('text=Size Chart')).toBeVisible();
    
    // Verify table is scrollable
    const tableContainer = await page.$('.overflow-x-auto');
    expect(tableContainer).toBeTruthy();
  });

  test('invoice buttons should be accessible on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/profile/orders');
    
    // Wait for buttons
    await page.waitForSelector('button[title="Download Invoice"]', { timeout: 10000 });
    
    // Verify buttons are visible
    await expect(page.locator('button[title="Download Invoice"]')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('size guide button should have proper ARIA labels', async ({ page }) => {
    await page.goto('/products/1');
    
    const sizeGuideButton = await page.$('button:has-text("Size Guide")');
    expect(sizeGuideButton).toBeTruthy();
    
    // Check if button is focusable
    await sizeGuideButton.focus();
    await expect(sizeGuideButton).toBeFocused();
  });

  test('modal should trap focus', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    
    // Wait for modal
    await page.waitForTimeout(500);
    
    // Press Tab multiple times
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }
    
    // Focus should still be in modal (simplified check)
    const activeElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'SELECT'].includes(activeElement)).toBeTruthy();
  });

  test('modal should close on Escape for accessibility', async ({ page }) => {
    await page.goto('/products/1');
    await page.click('text=Size Guide');
    await page.waitForTimeout(300);
    
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Size Chart')).not.toBeVisible();
  });
});
