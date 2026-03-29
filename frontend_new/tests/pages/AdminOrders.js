/**
 * Admin Orders Page Object Model
 * 
 * Handles order management including:
 * - View all orders
 * - Update order status
 * - Process returns
 * - Filter and search orders
 */
class AdminOrders {
  constructor(page) {
    this.page = page;
    
    // Page header
    this.pageTitle = page.locator('h1, .page-title, [data-testid="page-title"]');
    
    // Orders table
    this.ordersTable = page.locator('table, [class*="orders-table"]');
    this.orderRows = page.locator('tbody tr, [class*="table-row"], [data-testid="order-row"]');
    this.orderNumber = page.locator('.order-number, [class*="order-id"]');
    this.customerName = page.locator('.customer-name, [class*="customer"]');
    this.orderDate = page.locator('.order-date, [class*="date"]');
    this.orderTotal = page.locator('.order-total, [class*="total"]');
    this.orderStatus = page.locator('.order-status, [class*="status"], .badge');
    this.paymentStatus = page.locator('.payment-status, [class*="payment"]');
    
    // Order actions
    this.viewButton = page.locator('button:has-text("View"), .view-order, [data-testid="view"]');
    this.editButton = page.locator('button:has-text("Edit"), .edit-order');
    this.statusDropdown = page.locator('select[name="status"], .status-dropdown');
    
    // Filters and search
    this.searchInput = page.locator('input[placeholder*="search" i], .search-orders');
    this.statusFilter = page.locator('select[name="status"], .status-filter');
    this.paymentFilter = page.locator('select[name="payment"], .payment-filter');
    this.dateFromInput = page.locator('input[name="dateFrom"], .date-from, input[type="date"]').first();
    this.dateToInput = page.locator('input[name="dateTo"], .date-to, input[type="date"]').last();
    this.filterButton = page.locator('button:has-text("Filter"), .filter-button');
    this.resetFilterButton = page.locator('button:has-text("Reset"), .reset-filters');
    
    // Bulk actions
    this.bulkSelectCheckbox = page.locator('input[type="checkbox"].bulk-select, th input[type="checkbox"]');
    this.rowCheckbox = page.locator('td input[type="checkbox"], [class*="row-checkbox"]');
    this.bulkActionsDropdown = page.locator('select[name="bulk-action"], .bulk-actions');
    this.applyBulkActionButton = page.locator('button:has-text("Apply"), .apply-bulk-action');
    
    // Order details modal/page
    this.orderDetails = page.locator('.order-details, [class*="order-details"]');
    this.orderInfo = page.locator('.order-info, [class*="order-info"]');
    this.customerInfo = page.locator('.customer-info, [class*="customer-info"]');
    this.shippingAddress = page.locator('.shipping-address, [class*="shipping"]');
    this.billingAddress = page.locator('.billing-address, [class*="billing"]');
    this.orderItems = page.locator('.order-item, [class*="item"]');
    
    // Status update
    this.updateStatusButton = page.locator('button:has-text("Update Status"), .update-status');
    this.statusSelect = page.locator('select[name="status"], #status');
    this.confirmStatusButton = page.locator('button:has-text("Confirm"), button:has-text("Update")');
    
    // Return management
    this.returnsTab = page.locator('button:has-text("Returns"), .returns-tab');
    this.returnRequests = page.locator('.return-requests, [class*="return"]');
    this.approveReturnButton = page.locator('button:has-text("Approve"), .approve-return');
    this.rejectReturnButton = page.locator('button:has-text("Reject"), .reject-return');
    this.returnReason = page.locator('.return-reason, [class*="reason"]');
    
    // Invoice actions
    this.downloadInvoiceButton = page.locator('button:has-text("Invoice"), .download-invoice');
    this.printInvoiceButton = page.locator('button:has-text("Print"), .print-invoice');
    
    // Pagination
    this.pagination = page.locator('.pagination, [class*="pagination"]');
    this.pageInfo = page.locator('.page-info, [class*="page-info"]');
    this.nextPageButton = page.locator('button:has-text("Next"), .pagination-next');
    this.prevPageButton = page.locator('button:has-text("Previous"), .pagination-prev');
    
    // Success/error messages
    this.successMessage = page.locator('[class*="success"], .success-message');
    this.errorMessage = page.locator('[class*="error"], .error-message');
    
    // Close modal
    this.closeModalButton = page.locator('button[aria-label*="close"], .close-modal, button:has-text("Close")');
  }

  /**
   * Navigate to orders page
   */
  async goto() {
    await this.page.goto('/admin/orders');
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get order count
   */
  async getOrderCount() {
    return await this.orderRows.count();
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
   * Search orders
   */
  async searchOrders(query) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Filter by status
   */
  async filterByStatus(status) {
    await this.statusFilter.selectOption(status);
    await this.filterButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Filter by payment status
   */
  async filterByPayment(status) {
    await this.paymentFilter.selectOption(status);
    await this.filterButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * View order details
   */
  async viewOrder(index = 0) {
    await this.viewButton.nth(index).click();
    await this.orderDetails.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(index, status) {
    await this.viewOrder(index);
    await this.updateStatusButton.click();
    await this.statusSelect.selectOption(status);
    await this.confirmStatusButton.click();
    await this.page.waitForTimeout(2000);
    await this.closeModal();
  }

  /**
   * Update order status from dropdown (inline)
   */
  async updateOrderStatusInline(index, status) {
    await this.statusDropdown.nth(index).selectOption(status);
    await this.page.waitForTimeout(2000);
  }

  /**
   * Approve return request
   */
  async approveReturn(index = 0) {
    await this.returnsTab.click();
    await this.approveReturnButton.nth(index).click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Reject return request
   */
  async rejectReturn(index = 0, reason = '') {
    await this.returnsTab.click();
    await this.rejectReturnButton.nth(index).click();
    
    if (reason) {
      const reasonInput = this.page.locator('textarea[name="reason"]');
      await reasonInput.fill(reason);
    }
    
    await this.confirmStatusButton.click();
    await this.page.waitForTimeout(2000);
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
   * Select all orders (bulk)
   */
  async selectAllOrders() {
    await this.bulkSelectCheckbox.check();
  }

  /**
   * Select order at index (bulk)
   */
  async selectOrder(index = 0) {
    await this.rowCheckbox.nth(index).check();
  }

  /**
   * Apply bulk action
   */
  async applyBulkAction(action) {
    await this.bulkActionsDropdown.selectOption(action);
    await this.applyBulkActionButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Close modal
   */
  async closeModal() {
    if (await this.closeModalButton.isVisible()) {
      await this.closeModalButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Verify order status updated
   */
  async verifyOrderStatusUpdated(index, expectedStatus) {
    const status = await this.getOrderStatus(index);
    return status.toLowerCase().includes(expectedStatus.toLowerCase());
  }

  /**
   * Verify orders loaded
   */
  async verifyLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.ordersTable).toBeVisible();
  }

  /**
   * Get success message
   */
  async getSuccessMessage() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.successMessage.textContent();
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
   * Get order details
   */
  async getOrderDetails(index = 0) {
    return {
      orderNumber: await this.getOrderNumber(index),
      status: await this.getOrderStatus(index),
      total: await this.orderTotal.nth(index).textContent(),
      customer: await this.customerName.nth(index).textContent(),
    };
  }
}

const expect = require('@playwright/test').expect;
module.exports = AdminOrders;
