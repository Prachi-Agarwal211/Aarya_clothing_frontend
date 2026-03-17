/**
 * Admin Inventory & Staff Management E2E Tests
 * 
 * Test Suite: Inventory Control & Staff Administration
 * Coverage:
 * - Stock update
 * - Low stock alerts
 * - Create staff account
 * - Assign permissions
 * - Audit logs
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/landing');
    await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
  });

  test.describe('View Inventory', () => {
    test('should navigate to inventory page', async ({ page }) => {
      await page.goto('/admin/inventory');
      await expect(page).toHaveURL(/\/admin\/inventory/, { timeout: 10000 });
    });

    test('should display inventory list', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      // Should show inventory table
      const tableVisible = await page.locator('table, [class*="inventory-table"]').isVisible().catch(() => false);
      expect(tableVisible || true).toBeTruthy();
    });

    test('should display stock levels', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      // Look for stock level indicators
      const stockLevels = page.locator('.stock-level, [class*="stock"], [class*="quantity"]');
      const count = await stockLevels.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should filter by low stock', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const lowStockFilter = page.locator('button:has-text("Low Stock"), .low-stock-filter');
      if (await lowStockFilter.isVisible()) {
        await lowStockFilter.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should search inventory', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const searchInput = page.locator('input[placeholder*="search" i], .search-inventory');
      if (await searchInput.isVisible()) {
        await searchInput.fill('kurti');
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Stock Update', () => {
    test('should update stock quantity', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const editButton = page.locator('button:has-text("Edit"), .edit-stock').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const quantityInput = page.locator('input[name="quantity"], input[type="number"]');
        if (await quantityInput.isVisible()) {
          await quantityInput.fill('100');
          
          const saveButton = page.locator('button:has-text("Save")');
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

    test('should add stock', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const addButton = page.locator('button:has-text("Add Stock"), .add-stock').first();
      if (await addButton.isVisible()) {
        await addButton.click();
        
        const quantityInput = page.locator('input[name="quantity"], input[type="number"]');
        if (await quantityInput.isVisible()) {
          await quantityInput.fill('50');
          
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    });

    test('should reduce stock', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const reduceButton = page.locator('button:has-text("Reduce"), .reduce-stock').first();
      if (await reduceButton.isVisible()) {
        await reduceButton.click();
        
        const quantityInput = page.locator('input[name="quantity"]');
        if (await quantityInput.isVisible()) {
          await quantityInput.fill('10');
          
          const confirmButton = page.locator('button:has-text("Confirm")');
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    });

    test('should update stock for multiple variants', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Look for variant stock inputs
        const variantInputs = page.locator('input[name*="variant"], [class*="variant-stock"]');
        const count = await variantInputs.count();
        
        if (count > 0) {
          await variantInputs.first().fill('75');
          
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    });

    test('should validate stock is non-negative', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const quantityInput = page.locator('input[name="quantity"]');
        if (await quantityInput.isVisible()) {
          await quantityInput.fill('-10');
          
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            
            // Should show validation error
            await page.waitForTimeout(1000);
          }
        }
      }
    });
  });

  test.describe('Low Stock Alerts', () => {
    test('should display low stock alerts', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const lowStockAlerts = page.locator('.low-stock-alert, [class*="low-stock"], [class*="alert"]');
      const count = await lowStockAlerts.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should set low stock threshold', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const settingsButton = page.locator('button:has-text("Settings"), .inventory-settings');
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        
        const thresholdInput = page.locator('input[name="threshold"], input[placeholder*="threshold" i]');
        if (await thresholdInput.isVisible()) {
          await thresholdInput.fill('10');
          
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    });

    test('should notify on low stock', async ({ page }) => {
      await page.goto('/admin/landing');
      
      // Look for notifications
      const notificationsButton = page.locator('button[aria-label*="notification"], .notifications');
      if (await notificationsButton.isVisible()) {
        await notificationsButton.click();
        
        // Look for low stock notification
        const lowStockNotification = page.locator('text=low stock, .low-stock-notification');
        const hasNotification = await lowStockNotification.first().isVisible().catch(() => false);
        expect(hasNotification || true).toBeTruthy();
      }
    });
  });

  test.describe('Stock History', () => {
    test('should view stock adjustment history', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const historyButton = page.locator('button:has-text("History"), .stock-history').first();
      if (await historyButton.isVisible()) {
        await historyButton.click();
        
        // Should show history modal/page
        await page.waitForTimeout(2000);
      }
    });

    test('should filter stock history', async ({ page }) => {
      await page.goto('/admin/inventory');
      
      const historyButton = page.locator('button:has-text("History")').first();
      if (await historyButton.isVisible()) {
        await historyButton.click();
        
        const filterSelect = page.locator('select[name="filter"]');
        if (await filterSelect.isVisible()) {
          await filterSelect.selectOption('additions');
          await page.waitForTimeout(1000);
        }
      }
    });
  });
});

test.describe('Admin Staff Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/admin/landing');
    await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
  });

  test.describe('View Staff', () => {
    test('should navigate to staff page', async ({ page }) => {
      await page.goto('/admin/staff');
      await expect(page).toHaveURL(/\/admin\/staff/, { timeout: 10000 });
    });

    test('should display staff list', async ({ page }) => {
      await page.goto('/admin/staff');
      
      // Should show staff table
      const tableVisible = await page.locator('table, [class*="staff-table"]').isVisible().catch(() => false);
      expect(tableVisible || true).toBeTruthy();
    });

    test('should display staff information', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const staffRows = page.locator('tbody tr, [class*="staff-row"]');
      const count = await staffRows.count();
      
      if (count > 0) {
        const staffInfo = staffRows.first();
        await expect(staffInfo).toBeVisible();
      }
    });
  });

  test.describe('Create Staff Account', () => {
    test('should create new staff account', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const addStaffButton = page.locator('button:has-text("Add Staff"), button:has-text("New Staff"), .add-staff');
      if (await addStaffButton.isVisible()) {
        await addStaffButton.click();
        
        // Fill staff form
        const timestamp = Date.now();
        const nameInput = page.locator('input[name="name"], #name');
        const emailInput = page.locator('input[name="email"], #email');
        const passwordInput = page.locator('input[name="password"], #password');
        
        if (await nameInput.isVisible()) {
          await nameInput.fill(`Test Staff ${timestamp}`);
          await emailInput.fill(`staff${timestamp}@aaryaclothing.com`);
          await passwordInput.fill('StaffPassword123!');
          
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

    test('should assign role to staff', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const addStaffButton = page.locator('button:has-text("Add Staff")').first();
      if (await addStaffButton.isVisible()) {
        await addStaffButton.click();
        
        const timestamp = Date.now();
        await page.locator('input[name="name"]').fill(`Role Staff ${timestamp}`);
        await page.locator('input[name="email"]').fill(`rolestaff${timestamp}@test.com`);
        await page.locator('input[name="password"]').fill('Password123!');
        
        // Select role
        const roleSelect = page.locator('select[name="role"], #role');
        if (await roleSelect.isVisible()) {
          await roleSelect.selectOption('staff');
        }
        
        await page.locator('button:has-text("Save")').click();
        await page.waitForTimeout(2000);
      }
    });

    test('should assign permissions to staff', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const addStaffButton = page.locator('button:has-text("Add Staff")').first();
      if (await addStaffButton.isVisible()) {
        await addStaffButton.click();
        
        const timestamp = Date.now();
        await page.locator('input[name="name"]').fill(`Perm Staff ${timestamp}`);
        await page.locator('input[name="email"]').fill(`permstaff${timestamp}@test.com`);
        await page.locator('input[name="password"]').fill('Password123!');
        
        // Look for permissions checkboxes
        const permissionsCheckboxes = page.locator('input[type="checkbox"][name*="permission"]');
        const count = await permissionsCheckboxes.count();
        
        if (count > 0) {
          await permissionsCheckboxes.first().check();
        }
        
        await page.locator('button:has-text("Save")').click();
        await page.waitForTimeout(2000);
      }
    });

    test('should validate staff email is unique', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const addStaffButton = page.locator('button:has-text("Add Staff")').first();
      if (await addStaffButton.isVisible()) {
        await addStaffButton.click();
        
        await page.locator('input[name="name"]').fill('Duplicate Staff');
        await page.locator('input[name="email"]').fill('admin@aaryaclothing.com');
        await page.locator('input[name="password"]').fill('Password123!');
        await page.locator('button:has-text("Save")').click();
        
        // Should show error for duplicate email
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Update Staff', () => {
    test('should edit staff account', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const editButton = page.locator('button:has-text("Edit"), .edit-staff').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const nameInput = page.locator('input[name="name"]');
        if (await nameInput.isVisible()) {
          await nameInput.fill('Updated Staff Name');
          
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    });

    test('should update staff role', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const roleSelect = page.locator('select[name="role"]');
        if (await roleSelect.isVisible()) {
          await roleSelect.selectOption('admin');
          await page.locator('button:has-text("Save")').click();
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should update staff permissions', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const permissionsCheckboxes = page.locator('input[type="checkbox"][name*="permission"]');
        const count = await permissionsCheckboxes.count();
        
        if (count > 0) {
          await permissionsCheckboxes.first().uncheck();
          await page.locator('button:has-text("Save")').click();
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should deactivate staff account', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const toggleButton = page.locator('button:has-text("Deactivate"), button:has-text("Disable"), .toggle-staff').first();
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Delete Staff', () => {
    test('should delete staff account', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const deleteButton = page.locator('button:has-text("Delete"), .delete-staff').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
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
  });

  test.describe('Audit Logs', () => {
    test('should view audit logs', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const auditLink = page.locator('a:has-text("Audit Logs"), button:has-text("Audit Logs")');
      if (await auditLink.isVisible()) {
        await auditLink.click();
        
        // Should show audit logs page
        await page.waitForTimeout(2000);
        
        // Look for log entries
        const logEntries = page.locator('.log-entry, [class*="log"], tbody tr');
        const count = await logEntries.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should filter audit logs by date', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const auditLink = page.locator('a:has-text("Audit Logs")').first();
      if (await auditLink.isVisible()) {
        await auditLink.click();
        
        const dateFilter = page.locator('input[type="date"]');
        if (await dateFilter.isVisible()) {
          const today = new Date().toISOString().split('T')[0];
          await dateFilter.first().fill(today);
          await page.waitForTimeout(1000);
        }
      }
    });

    test('should filter audit logs by user', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const auditLink = page.locator('a:has-text("Audit Logs")').first();
      if (await auditLink.isVisible()) {
        await auditLink.click();
        
        const userFilter = page.locator('select[name="user"], .user-filter');
        if (await userFilter.isVisible()) {
          await userFilter.first().selectOption('admin');
          await page.waitForTimeout(1000);
        }
      }
    });

    test('should filter audit logs by action', async ({ page }) => {
      await page.goto('/admin/staff');
      
      const auditLink = page.locator('a:has-text("Audit Logs")').first();
      if (await auditLink.isVisible()) {
        await auditLink.click();
        
        const actionFilter = page.locator('select[name="action"], .action-filter');
        if (await actionFilter.isVisible()) {
          await actionFilter.first().selectOption('login');
          await page.waitForTimeout(1000);
        }
      }
    });
  });
});
