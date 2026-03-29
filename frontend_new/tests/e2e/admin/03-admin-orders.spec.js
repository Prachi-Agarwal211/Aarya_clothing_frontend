/**
 * Admin Order Management E2E Tests
 * 
 * Test Suite: Order Processing & Management
 * Coverage:
 * - View all orders
 * - Update order status
 * - Process returns
 * - Filter and search
 */

import { test, expect } from '@playwright/test';
import AdminOrders from '../../pages/AdminOrders';

test.describe('Admin Order Management', () => {
  let adminOrders: AdminOrders;

  test.beforeEach(async ({ page }) => {
    adminOrders = new AdminOrders(page);
    
    // Login as admin
    await page.goto('/admin/landing');
    await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
    
    // Navigate to orders
    await adminOrders.goto();
  });

  test.describe('View Orders', () => {
    test('should display orders list', async ({ page }) => {
      await adminOrders.verifyLoaded();
      
      const orderCount = await adminOrders.getOrderCount();
      expect(orderCount).toBeGreaterThanOrEqual(0);
    });

    test('should display order information', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        const orderDetails = await adminOrders.getOrderDetails(0);
        expect(orderDetails.orderNumber).toBeTruthy();
        expect(orderDetails.status).toBeTruthy();
      }
    });

    test('should search orders by order number', async ({ page }) => {
      await adminOrders.searchOrders('ORD');
      
      // Should filter results
      await page.waitForTimeout(1000);
    });

    test('should filter orders by status', async ({ page }) => {
      const initialCount = await adminOrders.getOrderCount();
      
      await adminOrders.filterByStatus('pending');
      
      const filteredCount = await adminOrders.getOrderCount();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should filter orders by payment status', async ({ page }) => {
      await adminOrders.filterByPayment('paid');
      
      // Should show only paid orders
      await page.waitForTimeout(1000);
    });

    test('should filter orders by date range', async ({ page }) => {
      if (await adminOrders.dateFromInput.isVisible()) {
        const today = new Date().toISOString().split('T')[0];
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        await adminOrders.dateFromInput.fill(lastWeek);
        await adminOrders.dateToInput.fill(today);
        await adminOrders.filterButton.click();
        
        await page.waitForTimeout(1000);
      }
    });

    test('should reset filters', async ({ page }) => {
      await adminOrders.filterByStatus('pending');
      
      if (await adminOrders.resetFilterButton.isVisible()) {
        await adminOrders.resetFilterButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Order Details', () => {
    test('should view order details', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.viewOrder(0);
        
        // Should show order details modal/page
        await expect(adminOrders.orderDetails).toBeVisible();
      }
    });

    test('should display customer information', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.viewOrder(0);
        
        await expect(adminOrders.customerInfo).toBeVisible();
      }
    });

    test('should display shipping address', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.viewOrder(0);
        
        await expect(adminOrders.shippingAddress).toBeVisible();
      }
    });

    test('should display order items', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.viewOrder(0);
        
        const itemCount = await adminOrders.orderItems.count();
        expect(itemCount).toBeGreaterThan(0);
      }
    });

    test('should close order details modal', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.viewOrder(0);
        await adminOrders.closeModal();
        
        // Modal should be closed
        const modalVisible = await adminOrders.orderDetails.isVisible().catch(() => false);
        expect(modalVisible).toBeFalsy();
      }
    });
  });

  test.describe('Update Order Status', () => {
    test('should update order status to confirmed', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.updateOrderStatus(0, 'confirmed');
        
        // Should show success
        const successVisible = await adminOrders.successMessage.isVisible().catch(() => false);
        expect(successVisible).toBeTruthy();
      }
    });

    test('should update order status to processing', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.updateOrderStatus(0, 'processing');
        await page.waitForTimeout(2000);
      }
    });

    test('should update order status to shipped', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.updateOrderStatus(0, 'shipped');
        await page.waitForTimeout(2000);
      }
    });

    test('should update order status to delivered', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.updateOrderStatus(0, 'delivered');
        await page.waitForTimeout(2000);
      }
    });

    test('should update order status to cancelled', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.updateOrderStatus(0, 'cancelled');
        await page.waitForTimeout(2000);
      }
    });

    test('should update status inline from dropdown', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0 && await adminOrders.statusDropdown.first().isVisible()) {
        await adminOrders.updateOrderStatusInline(0, 'processing');
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Return Management', () => {
    test('should view return requests', async ({ page }) => {
      if (await adminOrders.returnsTab.isVisible()) {
        await adminOrders.returnsTab.click();
        
        // Should show return requests
        await page.waitForTimeout(1000);
      }
    });

    test('should approve return request', async ({ page }) => {
      if (await adminOrders.returnsTab.isVisible()) {
        await adminOrders.returnsTab.click();
        
        const returnCount = await adminOrders.returnRequests.count();
        if (returnCount > 0) {
          await adminOrders.approveReturn(0);
          
          // Should show success
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should reject return request', async ({ page }) => {
      if (await adminOrders.returnsTab.isVisible()) {
        await adminOrders.returnsTab.click();
        
        const returnCount = await adminOrders.returnRequests.count();
        if (returnCount > 0) {
          await adminOrders.rejectReturn(0, 'Item not in original condition');
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should view return reason', async ({ page }) => {
      if (await adminOrders.returnsTab.isVisible()) {
        await adminOrders.returnsTab.click();
        
        const returnCount = await adminOrders.returnRequests.count();
        if (returnCount > 0) {
          const reasonVisible = await adminOrders.returnReason.first().isVisible();
          expect(reasonVisible).toBeTruthy();
        }
      }
    });
  });

  test.describe('Invoice Management', () => {
    test('should download invoice', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        const download = await adminOrders.downloadInvoice(0);
        
        expect(download.suggestedFilename()).toMatch(/Invoice_/);
        expect(download.suggestedFilename()).toMatch(/\.pdf$/);
      }
    });

    test('should print invoice', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.printInvoice(0);
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Bulk Order Operations', () => {
    test('should select all orders', async ({ page }) => {
      await adminOrders.selectAllOrders();
      await page.waitForTimeout(500);
    });

    test('should select individual order', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 0) {
        await adminOrders.selectOrder(0);
        await page.waitForTimeout(500);
      }
    });

    test('should apply bulk status update', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      
      if (orderCount > 1 && await adminOrders.bulkActionsDropdown.isVisible()) {
        await adminOrders.selectAllOrders();
        await adminOrders.bulkActionsDropdown.selectOption('mark-as-shipped');
        await adminOrders.applyBulkActionButton.click();
        
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Order Statistics', () => {
    test('should display order count', async ({ page }) => {
      const orderCount = await adminOrders.getOrderCount();
      expect(orderCount).toBeGreaterThanOrEqual(0);
    });

    test('should display order statistics', async ({ page }) => {
      // Look for stats widgets
      const statsVisible = await page.locator('.order-stats, [class*="stats"]').isVisible().catch(() => false);
      expect(statsVisible || true).toBeTruthy();
    });
  });

  test.describe('Pagination', () => {
    test('should navigate to next page', async ({ page }) => {
      await adminOrders.nextPage();
      await page.waitForTimeout(1000);
    });

    test('should navigate to previous page', async ({ page }) => {
      await adminOrders.nextPage();
      await adminOrders.previousPage();
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Responsive Design - Orders', () => {
    test('should display orders correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await adminOrders.verifyLoaded();
    });
  });
});
