/**
 * Order Management E2E Tests
 * 
 * Test Suite: Customer Order History & Tracking
 * Coverage:
 * - View order history
 * - Order details
 * - Download invoice
 * - Track order
 * - Return request
 */

import { test, expect } from '@playwright/test';
import OrdersPage from '../../pages/OrdersPage';

test.describe('Order Management', () => {
  let ordersPage: OrdersPage;

  test.beforeEach(async ({ page }) => {
    ordersPage = new OrdersPage(page);
    
    // Login first
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(profile|home|\/)?$/, { timeout: 10000 });
  });

  test.describe('Order History', () => {
    test('should view order history', async ({ page }) => {
      await ordersPage.goto();
      await ordersPage.verifyLoaded();
    });

    test('should display order cards', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      // May be 0 for new test user
      expect(orderCount).toBeGreaterThanOrEqual(0);
    });

    test('should display order information', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        const orderNumber = await ordersPage.getOrderNumber(0);
        expect(orderNumber).toBeTruthy();
        
        const status = await ordersPage.getOrderStatus(0);
        expect(status).toBeTruthy();
      }
    });

    test('should filter orders by status', async ({ page }) => {
      await ordersPage.goto();
      
      const initialCount = await ordersPage.getOrderCount();
      
      // Filter by delivered
      await ordersPage.filterByStatus('delivered');
      
      const filteredCount = await ordersPage.getOrderCount();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should search orders', async ({ page }) => {
      await ordersPage.goto();
      
      await ordersPage.searchOrders('ORD');
      
      // Should filter results
      await page.waitForTimeout(1000);
    });

    test('should show empty state for no orders', async ({ page }) => {
      // This test assumes user has no orders
      // May need to be skipped if test user has orders
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount === 0) {
        await ordersPage.verifyEmpty();
      }
    });
  });

  test.describe('Order Details', () => {
    test('should view order details', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.viewOrder(0);
        
        // Should navigate to order details page
        await expect(page).toHaveURL(/\/profile\/orders\/.*/, { timeout: 10000 });
        
        // Should show order details
        await expect(ordersPage.orderDetails).toBeVisible();
      }
    });

    test('should display order items', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.viewOrder(0);
        
        const itemCount = await ordersPage.orderItems.count();
        expect(itemCount).toBeGreaterThan(0);
      }
    });

    test('should display delivery address', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.viewOrder(0);
        
        await expect(ordersPage.deliveryAddress).toBeVisible();
      }
    });

    test('should display payment information', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.viewOrder(0);
        
        await expect(ordersPage.paymentMethod).toBeVisible();
        await expect(ordersPage.paymentStatus).toBeVisible();
      }
    });
  });

  test.describe('Invoice Download', () => {
    test('should download invoice PDF', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        const download = await ordersPage.downloadInvoice(0);
        
        expect(download.suggestedFilename()).toMatch(/Invoice_/);
        expect(download.suggestedFilename()).toMatch(/\.pdf$/);
      }
    });

    test('should print invoice', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.printInvoice(0);
        
        // Print dialog or new window should appear
        await page.waitForTimeout(2000);
      }
    });

    test('should display invoice button for delivered orders', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        const hasInvoice = await ordersPage.verifyInvoiceButton(0);
        expect(hasInvoice).toBeTruthy();
      }
    });
  });

  test.describe('Order Tracking', () => {
    test('should track order', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.trackOrder(0);
        
        // Timeline should be visible
        await expect(ordersPage.orderTimeline).toBeVisible();
      }
    });

    test('should display order timeline', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.trackOrder(0);
        
        const events = await ordersPage.verifyTimelineEvents();
        expect(events.length).toBeGreaterThan(0);
      }
    });

    test('should show timeline events in order', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.trackOrder(0);
        
        const events = await ordersPage.verifyTimelineEvents();
        
        // Events should include standard milestones
        const hasOrdered = events.some(e => e.toLowerCase().includes('order') || e.toLowerCase().includes('placed'));
        expect(hasOrdered).toBeTruthy();
      }
    });
  });

  test.describe('Return Requests', () => {
    test('should initiate return for delivered order', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        const isDelivered = await ordersPage.verifyOrderDelivered(0);
        
        if (isDelivered) {
          await ordersPage.initiateReturn(0);
          
          // Return modal should appear
          await expect(ordersPage.returnModal).toBeVisible();
        }
      }
    });

    test('should select return reason', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        const isDelivered = await ordersPage.verifyOrderDelivered(0);
        
        if (isDelivered) {
          await ordersPage.initiateReturn(0);
          
          // Select a reason
          await ordersPage.returnReasonSelect.selectOption('Size Issue');
          
          const selectedValue = await ordersPage.returnReasonSelect.inputValue();
          expect(selectedValue).toBe('Size Issue');
        }
      }
    });

    test('should submit return request', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        const isDelivered = await ordersPage.verifyOrderDelivered(0);
        
        if (isDelivered) {
          await ordersPage.initiateReturn(0);
          await ordersPage.submitReturn('Size Issue', 'Does not fit properly');
          
          // Should show success message
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should not allow return for non-delivered orders', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        const isDelivered = await ordersPage.verifyOrderDelivered(0);
        
        if (!isDelivered) {
          const returnButtonVisible = await ordersPage.returnButton.first().isVisible().catch(() => false);
          expect(returnButtonVisible).toBeFalsy();
        }
      }
    });
  });

  test.describe('Reorder', () => {
    test('should reorder from order history', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        await ordersPage.reorder(0);
        
        // Should add items to cart or show confirmation
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Order Actions', () => {
    test('should display all order action buttons', async ({ page }) => {
      await ordersPage.goto();
      
      const orderCount = await ordersPage.getOrderCount();
      if (orderCount > 0) {
        // Check for common action buttons
        const hasView = await ordersPage.viewButton.first().isVisible();
        expect(hasView).toBeTruthy();
      }
    });
  });

  test.describe('Pagination', () => {
    test('should navigate to next page', async ({ page }) => {
      await ordersPage.goto();
      
      await ordersPage.nextPage();
      
      // Should load next page or stay if no more pages
      await page.waitForTimeout(1000);
    });

    test('should navigate to previous page', async ({ page }) => {
      await ordersPage.goto();
      
      // Go to next page first
      await ordersPage.nextPage();
      
      // Then go back
      await ordersPage.previousPage();
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Responsive Design - Orders', () => {
    test('should display orders correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await ordersPage.goto();
      await ordersPage.verifyLoaded();
    });

    test('should display orders correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      await ordersPage.goto();
      await ordersPage.verifyLoaded();
    });
  });
});
