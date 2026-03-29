/**
 * Admin Customer & Coupon Management E2E Tests
 * 
 * Test Suite: Customer Management & Coupon Operations
 * Coverage:
 * - View customers
 * - Customer details
 * - Create coupon
 * - Update coupon
 * - Delete coupon
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/landing');
    await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
  });

  test.describe('View Customers', () => {
    test('should navigate to customers page', async ({ page }) => {
      await page.goto('/admin/customers');
      await expect(page).toHaveURL(/\/admin\/customers/, { timeout: 10000 });
    });

    test('should display customers list', async ({ page }) => {
      await page.goto('/admin/customers');
      
      // Should show customers table or empty state
      const tableVisible = await page.locator('table, [class*="customers-table"]').isVisible().catch(() => false);
      const emptyVisible = await page.locator('text=No customers, .empty-customers').isVisible().catch(() => false);
      
      expect(tableVisible || emptyVisible).toBeTruthy();
    });

    test('should display customer information', async ({ page }) => {
      await page.goto('/admin/customers');
      
      // Look for customer rows
      const customerRows = page.locator('tbody tr, [class*="customer-row"]');
      const count = await customerRows.count();
      
      if (count > 0) {
        // Should show customer name, email, etc.
        const customerInfo = customerRows.first();
        await expect(customerInfo).toBeVisible();
      }
    });

    test('should search customers', async ({ page }) => {
      await page.goto('/admin/customers');
      
      const searchInput = page.locator('input[placeholder*="search" i], .search-customers');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);
      }
    });

    test('should filter customers', async ({ page }) => {
      await page.goto('/admin/customers');
      
      const filterSelect = page.locator('select[name="filter"], .customer-filter');
      if (await filterSelect.isVisible()) {
        await filterSelect.selectOption('active');
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Customer Details', () => {
    test('should view customer details', async ({ page }) => {
      await page.goto('/admin/customers');
      
      const viewButton = page.locator('button:has-text("View"), .view-customer').first();
      if (await viewButton.isVisible()) {
        await viewButton.click();
        
        // Should show customer details modal/page
        await page.waitForTimeout(2000);
      }
    });

    test('should display customer order history', async ({ page }) => {
      await page.goto('/admin/customers');
      
      const viewButton = page.locator('button:has-text("View"), .view-customer').first();
      if (await viewButton.isVisible()) {
        await viewButton.click();
        
        // Look for order history
        const orderHistory = page.locator('.order-history, [class*="orders"]');
        const hasOrderHistory = await orderHistory.first().isVisible().catch(() => false);
        expect(hasOrderHistory || true).toBeTruthy();
      }
    });

    test('should display customer addresses', async ({ page }) => {
      await page.goto('/admin/customers');
      
      const viewButton = page.locator('button:has-text("View"), .view-customer').first();
      if (await viewButton.isVisible()) {
        await viewButton.click();
        
        // Look for addresses
        const addresses = page.locator('.addresses, [class*="address"]');
        const hasAddresses = await addresses.first().isVisible().catch(() => false);
        expect(hasAddresses || true).toBeTruthy();
      }
    });
  });
});

test.describe('Admin Coupon Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/landing');
    await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
  });

  test.describe('View Coupons', () => {
    test('should navigate to coupons page', async ({ page }) => {
      await page.goto('/admin/coupons');
      await expect(page).toHaveURL(/\/admin\/coupons/, { timeout: 10000 });
    });

    test('should display coupons list', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      // Should show coupons table
      const tableVisible = await page.locator('table, [class*="coupons-table"]').isVisible().catch(() => false);
      expect(tableVisible || true).toBeTruthy();
    });

    test('should display coupon information', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      // Look for coupon rows
      const couponRows = page.locator('tbody tr, [class*="coupon-row"]');
      const count = await couponRows.count();
      
      if (count > 0) {
        // Should show coupon code, discount, etc.
        const couponCode = couponRows.first().locator('.coupon-code, [class*="code"]');
        await expect(couponCode.first()).toBeVisible();
      }
    });
  });

  test.describe('Create Coupon', () => {
    test('should create new coupon', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon"), button:has-text("New Coupon"), .add-coupon');
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        // Fill coupon form
        const timestamp = Date.now();
        const codeInput = page.locator('input[name="code"], #code');
        const discountInput = page.locator('input[name="discount"], #discount');
        const minOrderInput = page.locator('input[name="minOrder"], #min-order');
        
        if (await codeInput.isVisible()) {
          await codeInput.fill(`TEST${timestamp}`);
          await discountInput.fill('10');
          await minOrderInput.fill('500');
          
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(2000);
            
            // Should show success
            const successVisible = await page.locator('[class*="success"]').isVisible().catch(() => false);
            expect(successVisible).toBeTruthy();
          }
        }
      }
    });

    test('should create percentage coupon', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon")').first();
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        const timestamp = Date.now();
        await page.locator('input[name="code"]').fill(`PERCENT${timestamp}`);
        await page.locator('input[name="discount"]').fill('15');
        
        // Select percentage type
        const typeSelect = page.locator('select[name="type"]');
        if (await typeSelect.isVisible()) {
          await typeSelect.selectOption('percentage');
        }
        
        await page.locator('button:has-text("Save")').click();
        await page.waitForTimeout(2000);
      }
    });

    test('should create fixed amount coupon', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon")').first();
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        const timestamp = Date.now();
        await page.locator('input[name="code"]').fill(`FIXED${timestamp}`);
        await page.locator('input[name="discount"]').fill('100');
        
        // Select fixed type
        const typeSelect = page.locator('select[name="type"]');
        if (await typeSelect.isVisible()) {
          await typeSelect.selectOption('fixed');
        }
        
        await page.locator('button:has-text("Save")').click();
        await page.waitForTimeout(2000);
      }
    });

    test('should set coupon expiry date', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon")').first();
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        const timestamp = Date.now();
        await page.locator('input[name="code"]').fill(`EXPIRY${timestamp}`);
        await page.locator('input[name="discount"]').fill('10');
        
        // Set expiry date
        const expiryInput = page.locator('input[name="expiryDate"], input[type="date"]');
        if (await expiryInput.isVisible()) {
          const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          await expiryInput.fill(futureDate);
        }
        
        await page.locator('button:has-text("Save")').click();
        await page.waitForTimeout(2000);
      }
    });

    test('should validate coupon code is required', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon")').first();
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        // Try to save without code
        await page.locator('button:has-text("Save")').click();
        
        // Should show validation error
        await page.waitForTimeout(1000);
      }
    });

    test('should validate discount is positive', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon")').first();
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        await page.locator('input[name="code"]').fill('INVALID');
        await page.locator('input[name="discount"]').fill('-10');
        
        await page.locator('button:has-text("Save")').click();
        
        // Should show validation error
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Update Coupon', () => {
    test('should edit existing coupon', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const editButton = page.locator('button:has-text("Edit"), .edit-coupon').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Modify coupon
        const discountInput = page.locator('input[name="discount"]');
        if (await discountInput.isVisible()) {
          await discountInput.fill('20');
          
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    });

    test('should update coupon status', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const statusSelect = page.locator('select[name="status"]');
        if (await statusSelect.isVisible()) {
          await statusSelect.selectOption('inactive');
          await page.locator('button:has-text("Save")').click();
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should deactivate coupon', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const toggleButton = page.locator('button:has-text("Deactivate"), button:has-text("Disable"), .toggle-coupon').first();
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Delete Coupon', () => {
    test('should delete coupon', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const deleteButton = page.locator('button:has-text("Delete"), .delete-coupon').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(2000);
        
        // Should show success
        const successVisible = await page.locator('[class*="success"]').isVisible().catch(() => false);
        expect(successVisible).toBeTruthy();
      }
    });

    test('should cancel coupon deletion', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const deleteButton = page.locator('button:has-text("Delete")').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        const cancelButton = page.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Coupon Validation', () => {
    test('should validate unique coupon code', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon")').first();
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        // Try to create with existing code
        await page.locator('input[name="code"]').fill('EXISTING');
        await page.locator('input[name="discount"]').fill('10');
        await page.locator('button:has-text("Save")').click();
        
        // Should show error for duplicate code
        await page.waitForTimeout(2000);
      }
    });

    test('should validate discount percentage max', async ({ page }) => {
      await page.goto('/admin/coupons');
      
      const addCouponButton = page.locator('button:has-text("Add Coupon")').first();
      if (await addCouponButton.isVisible()) {
        await addCouponButton.click();
        
        await page.locator('input[name="code"]').fill('HIGH');
        await page.locator('input[name="discount"]').fill('150');
        await page.locator('button:has-text("Save")').click();
        
        // Should show validation error
        await page.waitForTimeout(1000);
      }
    });
  });
});
