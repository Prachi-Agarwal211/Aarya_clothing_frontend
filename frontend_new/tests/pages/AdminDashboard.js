/**
 * Admin Dashboard Page Object Model
 * 
 * Handles admin dashboard including:
 * - Dashboard widgets
 * - Quick stats
 * - Recent orders
 * - AI assistant
 */
class AdminDashboard {
  constructor(page) {
    this.page = page;
    
    // Dashboard header
    this.dashboardTitle = page.locator('h1, .dashboard-title, [data-testid="dashboard-title"]');
    this.adminProfile = page.locator('.admin-profile, [class*="admin-avatar"]');
    this.logoutButton = page.locator('button:has-text("Logout"), .logout, [data-testid="logout"]');
    
    // Navigation
    this.sidebar = page.locator('.sidebar, .admin-nav, [class*="sidebar"]');
    this.dashboardLink = page.locator('a[href*="dashboard"], a:has-text("Dashboard")');
    this.ordersLink = page.locator('a[href*="orders"], a:has-text("Orders")');
    this.productsLink = page.locator('a[href*="products"], a:has-text("Products")');
    this.customersLink = page.locator('a[href*="customers"], a:has-text("Customers")');
    this.inventoryLink = page.locator('a[href*="inventory"], a:has-text("Inventory")');
    this.staffLink = page.locator('a[href*="staff"], a:has-text("Staff")');
    this.settingsLink = page.locator('a[href*="settings"], a:has-text("Settings")');
    this.aiAssistantLink = page.locator('a[href*="ai"], a:has-text("AI")');
    
    // Dashboard widgets
    this.statsWidgets = page.locator('.stats-widgets, [class*="stats"], [class*="widget"]');
    this.totalOrdersWidget = page.locator('[class*="total-orders"], [data-testid="total-orders"]');
    this.totalRevenueWidget = page.locator('[class*="revenue"], [data-testid="revenue"]');
    this.totalCustomersWidget = page.locator('[class*="customers"], [data-testid="total-customers"]');
    this.pendingOrdersWidget = page.locator('[class*="pending"], [data-testid="pending-orders"]');
    
    // Charts
    this.salesChart = page.locator('.sales-chart, [class*="chart"], canvas');
    this.ordersChart = page.locator('.orders-chart, [class*="orders-graph"]');
    
    // Recent orders table
    this.recentOrders = page.locator('.recent-orders, [class*="recent"], [data-testid="recent-orders"]');
    this.ordersTable = page.locator('table, [class*="table"]');
    this.orderRows = page.locator('tbody tr, [class*="table-row"]');
    
    // Quick actions
    this.quickActions = page.locator('.quick-actions, [class*="quick"]');
    this.addProductButton = page.locator('button:has-text("Add Product"), .add-product');
    
    // Notifications
    this.notificationsButton = page.locator('button[aria-label*="notification"], .notifications, [data-testid="notifications"]');
    this.notificationsDropdown = page.locator('.notifications-dropdown, [class*="notifications"]');
    
    // Low stock alerts
    this.lowStockAlerts = page.locator('.low-stock, [class*="stock-alert"], [data-testid="low-stock"]');
    
    // AI Dashboard widgets
    this.aiQueries = page.locator('.ai-queries, [class*="ai-queries"]');
    this.aiQueryInput = page.locator('input[placeholder*="AI"], .ai-query-input, textarea[name="query"]');
    this.aiSubmitButton = page.locator('button:has-text("Ask AI"), .ai-submit');
    this.aiResponse = page.locator('.ai-response, [class*="ai-response"]');
  }

  /**
   * Navigate to admin dashboard
   */
  async goto() {
    await this.page.goto('/admin/landing');
    await this.dashboardTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Navigate to orders section
   */
  async goToOrders() {
    await this.ordersLink.click();
    await this.page.waitForURL(/\/admin\/orders/, { timeout: 10000 });
  }

  /**
   * Navigate to products section
   */
  async goToProducts() {
    await this.productsLink.click();
    await this.page.waitForURL(/\/admin\/products/, { timeout: 10000 });
  }

  /**
   * Navigate to customers section
   */
  async goToCustomers() {
    await this.customersLink.click();
    await this.page.waitForURL(/\/admin\/customers/, { timeout: 10000 });
  }

  /**
   * Navigate to inventory section
   */
  async goToInventory() {
    await this.inventoryLink.click();
    await this.page.waitForURL(/\/admin\/inventory/, { timeout: 10000 });
  }

  /**
   * Navigate to staff section
   */
  async goToStaff() {
    await this.staffLink.click();
    await this.page.waitForURL(/\/admin\/staff/, { timeout: 10000 });
  }

  /**
   * Navigate to AI assistant
   */
  async goToAIAssistant() {
    await this.aiAssistantLink.click();
    await this.page.waitForURL(/\/admin\/ai/, { timeout: 10000 });
  }

  /**
   * Get total orders count
   */
  async getTotalOrders() {
    const text = await this.totalOrdersWidget.textContent();
    return parseInt(text.replace(/[^0-9]/g, ''));
  }

  /**
   * Get total revenue
   */
  async getTotalRevenue() {
    const text = await this.totalRevenueWidget.textContent();
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  /**
   * Get pending orders count
   */
  async getPendingOrders() {
    const text = await this.pendingOrdersWidget.textContent();
    return parseInt(text.replace(/[^0-9]/g, ''));
  }

  /**
   * Get recent orders count
   */
  async getRecentOrdersCount() {
    return await this.orderRows.count();
  }

  /**
   * Click add product
   */
  async clickAddProduct() {
    await this.addProductButton.click();
    await this.page.waitForURL(/\/admin\/products\/.*\/new/, { timeout: 10000 });
  }

  /**
   * Ask AI a question
   */
  async askAI(question) {
    await this.aiQueryInput.fill(question);
    await this.aiSubmitButton.click();
    await this.aiResponse.waitFor({ state: 'visible', timeout: 15000 });
    return await this.aiResponse.textContent();
  }

  /**
   * Verify dashboard loaded
   */
  async verifyLoaded() {
    await expect(this.dashboardTitle).toBeVisible();
    await expect(this.statsWidgets.first()).toBeVisible();
    await expect(this.recentOrders).toBeVisible();
  }

  /**
   * Logout
   */
  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL(/\/admin\/login|\/admin\/landing/, { timeout: 10000 });
  }

  /**
   * View notifications
   */
  async viewNotifications() {
    await this.notificationsButton.click();
    await this.notificationsDropdown.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get low stock alert count
   */
  async getLowStockAlertCount() {
    return await this.lowStockAlerts.count();
  }
}

const expect = require('@playwright/test').expect;
module.exports = AdminDashboard;
