/**
 * Orders Page Object Model
 * 
 * Handles order management including:
 * - View order history
 * - Order details
 * - Track order
 * - Download invoice
 * - Return requests
 */
class OrdersPage {
  constructor(page) {
    this.page = page;
    
    // Orders list
    this.ordersList = page.locator('.orders-list, [class*="orders"], [data-testid="orders-list"]');
    this.orderCards = page.locator('.order-card, [class*="order-item"], [data-testid="order-card"]');
    this.orderNumber = page.locator('.order-number, [class*="order-id"], [data-testid="order-number"]');
    this.orderDate = page.locator('.order-date, [class*="date"]');
    this.orderStatus = page.locator('.order-status, [class*="status"], [data-testid="order-status"]');
    this.orderTotal = page.locator('.order-total, [class*="total"]');
    
    // Order status badges
    this.statusPending = page.locator('.status-pending, text=Pending, text=Processing');
    this.statusConfirmed = page.locator('.status-confirmed, text=Confirmed');
    this.statusShipped = page.locator('.status-shipped, text=Shipped');
    this.statusDelivered = page.locator('.status-delivered, text=Delivered');
    this.statusCancelled = page.locator('.status-cancelled, text=Cancelled');
    this.statusReturned = page.locator('.status-returned, text=Returned');
    
    // Order actions
    this.viewOrderButton = page.locator('button:has-text("View"), button:has-text("View Details"), .view-order');
    this.trackOrderButton = page.locator('button:has-text("Track"), button:has-text("Track Order"), .track-order');
    this.downloadInvoiceButton = page.locator('button:has-text("Invoice"), button:has-text("Download Invoice"), [data-testid="download-invoice"]');
    this.printInvoiceButton = page.locator('button:has-text("Print"), button:has-text("Print Invoice"), [data-testid="print-invoice"]');
    this.reorderButton = page.locator('button:has-text("Reorder"), .reorder');
    this.returnButton = page.locator('button:has-text("Return"), button:has-text("Return Item"), .return-item');
    
    // Order details page
    this.orderDetails = page.locator('.order-details, [class*="order-details"]');
    this.orderItems = page.locator('.order-item, [class*="item"]');
    this.itemName = page.locator('.item-name, [class*="product-name"]');
    this.itemPrice = page.locator('.item-price, [class*="price"]');
    this.itemQuantity = page.locator('.item-quantity, [class*="quantity"]');
    
    // Delivery address
    this.deliveryAddress = page.locator('.delivery-address, [class*="address"], [data-testid="delivery-address"]');
    
    // Payment info
    this.paymentMethod = page.locator('.payment-method, [class*="payment"]');
    this.paymentStatus = page.locator('.payment-status, [class*="payment-status"]');
    
    // Order timeline
    this.orderTimeline = page.locator('.timeline, [class*="timeline"], .order-tracking');
    this.timelineEvents = page.locator('.timeline-event, [class*="event"]');
    
    // Invoice
    this.invoicePreview = page.locator('.invoice-preview, [class*="invoice"], iframe');
    
    // Return modal/form
    this.returnModal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    this.returnReasonSelect = page.locator('select[name="reason"], #reason, .return-reason');
    this.returnReasonOther = page.locator('textarea[name="reason"], #other-reason, .return-reason-other');
    this.returnImages = page.locator('input[type="file"][name="images"], .return-images');
    this.submitReturnButton = page.locator('button:has-text("Submit Return"), .submit-return');
    
    // Filters and search
    this.orderFilters = page.locator('.order-filters, [class*="filter"]');
    this.statusFilter = page.locator('select[name="status"], .status-filter');
    this.dateFilter = page.locator('input[type="date"], .date-filter');
    this.searchOrders = page.locator('input[placeholder*="search" i], .order-search');
    
    // Empty state
    this.emptyOrdersMessage = page.locator('text=No orders, .empty-orders, [class*="empty"]');
    this.shopNowButton = page.locator('a:has-text("Shop Now"), button:has-text("Shop Now")');
    
    // Pagination
    this.pagination = page.locator('.pagination, [class*="pagination"]');
    this.nextPageButton = page.locator('button:has-text("Next"), .pagination-next');
    this.prevPageButton = page.locator('button:has-text("Previous"), .pagination-prev');
  }

  /**
   * Navigate to orders page
   */
  async goto() {
    await this.page.goto('/profile/orders');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get order count
   */
  async getOrderCount() {
    return await this.orderCards.count();
  }

  /**
   * Get order number at index
   */
  async getOrderNumber(index = 0) {
    const text = await this.orderNumber.nth(index).textContent();
    return text.replace(/[^A-Z0-9]/gi, '');
  }

  /**
   * Get order status at index
   */
  async getOrderStatus(index = 0) {
    return await this.orderStatus.nth(index).textContent();
  }

  /**
   * View order details
   */
  async viewOrder(index = 0) {
    await this.viewOrderButton.nth(index).click();
    await this.page.waitForURL(/\/profile\/orders\/.*/, { timeout: 10000 });
  }

  /**
   * Track order
   */
  async trackOrder(index = 0) {
    await this.trackOrderButton.nth(index).click();
    await this.orderTimeline.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Download invoice
   */
  async downloadInvoice(index = 0) {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadInvoiceButton.nth(index).click();
    const download = await downloadPromise;
    return download;
  }

  /**
   * Print invoice
   */
  async printInvoice(index = 0) {
    await this.printInvoiceButton.nth(index).click();
    // Handle print dialog or new window
    await this.page.waitForTimeout(2000);
  }

  /**
   * Reorder
   */
  async reorder(index = 0) {
    await this.reorderButton.nth(index).click();
    await this.page.waitForTimeout(2000);
    // Should redirect to cart or show confirmation
  }

  /**
   * Initiate return
   */
  async initiateReturn(index = 0) {
    await this.returnButton.nth(index).click();
    await this.returnModal.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Submit return request
   */
  async submitReturn(reason, additionalInfo = null) {
    await this.returnReasonSelect.selectOption(reason);
    
    if (additionalInfo) {
      await this.returnReasonOther.fill(additionalInfo);
    }
    
    await this.submitReturnButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Filter orders by status
   */
  async filterByStatus(status) {
    await this.statusFilter.selectOption(status);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Search orders
   */
  async searchOrders(query) {
    await this.searchOrders.fill(query);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify order is delivered
   */
  async verifyOrderDelivered(index = 0) {
    const status = await this.getOrderStatus(index);
    return status.toLowerCase().includes('delivered');
  }

  /**
   * Verify invoice button exists
   */
  async verifyInvoiceButton(index = 0) {
    return await this.downloadInvoiceButton.nth(index).isVisible();
  }

  /**
   * Verify orders loaded
   */
  async verifyLoaded() {
    await expect(this.ordersList).toBeVisible();
  }

  /**
   * Verify empty orders state
   */
  async verifyEmpty() {
    await expect(this.emptyOrdersMessage).toBeVisible();
    await expect(this.shopNowButton).toBeVisible();
  }

  /**
   * Get order details
   */
  async getOrderDetails(index = 0) {
    return {
      orderNumber: await this.getOrderNumber(index),
      status: await this.getOrderStatus(index),
      total: await this.orderTotal.nth(index).textContent(),
      date: await this.orderDate.nth(index).textContent(),
    };
  }

  /**
   * Verify timeline events
   */
  async verifyTimelineEvents() {
    const events = [];
    const count = await this.timelineEvents.count();
    for (let i = 0; i < count; i++) {
      events.push(await this.timelineEvents.nth(i).textContent());
    }
    return events;
  }

  /**
   * Go to next page
   */
  async nextPage() {
    if (await this.nextPageButton.isVisible()) {
      await this.nextPageButton.click();
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Go to previous page
   */
  async previousPage() {
    if (await this.prevPageButton.isVisible()) {
      await this.prevPageButton.click();
      await this.page.waitForTimeout(1000);
    }
  }
}

const expect = require('@playwright/test').expect;
module.exports = OrdersPage;
