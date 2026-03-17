/**
 * Admin Products Page Object Model
 * 
 * Handles product management including:
 * - View all products
 * - Create product
 * - Edit product
 * - Delete product
 * - Bulk operations
 */
class AdminProducts {
  constructor(page) {
    this.page = page;
    
    // Page header
    this.pageTitle = page.locator('h1, .page-title, [data-testid="page-title"]');
    this.addProductButton = page.locator('button:has-text("Add Product"), button:has-text("New Product"), .add-product');
    
    // Products table
    this.productsTable = page.locator('table, [class*="products-table"]');
    this.productRows = page.locator('tbody tr, [class*="table-row"], [data-testid="product-row"]');
    this.productName = page.locator('.product-name, [class*="name"]');
    this.productSKU = page.locator('.product-sku, [class*="sku"]');
    this.productPrice = page.locator('.product-price, [class*="price"]');
    this.productStock = page.locator('.product-stock, [class*="stock"]');
    this.productStatus = page.locator('.product-status, [class*="status"]');
    this.productImage = page.locator('.product-image img, [class*="thumbnail"]');
    
    // Product actions
    this.editButton = page.locator('button:has-text("Edit"), .edit-product, [data-testid="edit"]');
    this.deleteButton = page.locator('button:has-text("Delete"), .delete-product, [data-testid="delete"]');
    this.viewButton = page.locator('button:has-text("View"), .view-product');
    
    // Bulk actions
    this.bulkSelectCheckbox = page.locator('input[type="checkbox"].bulk-select, th input[type="checkbox"]');
    this.rowCheckbox = page.locator('td input[type="checkbox"], [class*="row-checkbox"]');
    this.bulkActionsDropdown = page.locator('select[name="bulk-action"], .bulk-actions');
    this.applyBulkActionButton = page.locator('button:has-text("Apply"), .apply-bulk-action');
    
    // Filters and search
    this.searchInput = page.locator('input[placeholder*="search" i], .search-products');
    this.categoryFilter = page.locator('select[name="category"], .category-filter');
    this.statusFilter = page.locator('select[name="status"], .status-filter');
    this.filterButton = page.locator('button:has-text("Filter"), .filter-button');
    
    // Pagination
    this.pagination = page.locator('.pagination, [class*="pagination"]');
    this.pageInfo = page.locator('.page-info, [class*="page-info"]');
    this.nextPageButton = page.locator('button:has-text("Next"), .pagination-next');
    this.prevPageButton = page.locator('button:has-text("Previous"), .pagination-prev');
    
    // Product form (create/edit)
    this.productForm = page.locator('.product-form, [class*="form"]');
    this.nameInput = page.locator('input[name="name"], #name');
    this.descriptionInput = page.locator('textarea[name="description"], #description');
    this.priceInput = page.locator('input[name="price"], #price');
    this.comparePriceInput = page.locator('input[name="comparePrice"], #compare-price');
    this.skuInput = page.locator('input[name="sku"], #sku');
    this.categorySelect = page.locator('select[name="category"], #category');
    this.imagesInput = page.locator('input[type="file"][name="images"], .image-upload');
    this.sizesCheckboxes = page.locator('input[type="checkbox"][name="sizes"], .size-checkbox');
    this.colorsInput = page.locator('input[name="colors"], .color-input');
    this.stockInput = page.locator('input[name="stock"], #stock');
    this.statusSelect = page.locator('select[name="status"], #status');
    
    // Form actions
    this.saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), .save-product');
    this.cancelButton = page.locator('button:has-text("Cancel"), .cancel');
    
    // Delete confirmation
    this.deleteModal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    this.confirmDeleteButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
    this.cancelDeleteButton = page.locator('button:has-text("Cancel")');
    
    // Success/error messages
    this.successMessage = page.locator('[class*="success"], .success-message');
    this.errorMessage = page.locator('[class*="error"], .error-message');
  }

  /**
   * Navigate to products page
   */
  async goto() {
    await this.page.goto('/admin/products');
    await this.pageTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get product count
   */
  async getProductCount() {
    return await this.productRows.count();
  }

  /**
   * Get product name at index
   */
  async getProductName(index = 0) {
    return await this.productName.nth(index).textContent();
  }

  /**
   * Search products
   */
  async searchProducts(query) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Filter by category
   */
  async filterByCategory(category) {
    await this.categoryFilter.selectOption(category);
    await this.filterButton.click();
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
   * Click add product
   */
  async clickAddProduct() {
    await this.addProductButton.click();
    await this.productForm.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Create new product
   */
  async createProduct(product) {
    await this.clickAddProduct();
    
    await this.nameInput.fill(product.name);
    await this.descriptionInput.fill(product.description || '');
    await this.priceInput.fill(product.price.toString());
    await this.skuInput.fill(product.sku || `SKU-${Date.now()}`);
    
    if (product.category) {
      await this.categorySelect.selectOption(product.category);
    }
    
    if (product.stock !== undefined) {
      await this.stockInput.fill(product.stock.toString());
    }
    
    // Upload images if provided
    if (product.images && product.images.length > 0) {
      await this.imagesInput.setInputFiles(product.images);
    }
    
    // Select sizes if provided
    if (product.sizes) {
      for (const size of product.sizes) {
        const checkbox = this.sizesCheckboxes.filter({ hasText: size });
        await checkbox.check();
      }
    }
    
    await this.saveButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Edit product at index
   */
  async editProduct(index = 0, updates) {
    await this.editButton.nth(index).click();
    await this.productForm.waitFor({ state: 'visible', timeout: 5000 });
    
    if (updates.name) {
      await this.nameInput.fill(updates.name);
    }
    
    if (updates.price) {
      await this.priceInput.fill(updates.price.toString());
    }
    
    if (updates.stock !== undefined) {
      await this.stockInput.fill(updates.stock.toString());
    }
    
    await this.saveButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Delete product at index
   */
  async deleteProduct(index = 0) {
    await this.deleteButton.nth(index).click();
    await this.deleteModal.waitFor({ state: 'visible', timeout: 5000 });
    await this.confirmDeleteButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Select all products (bulk)
   */
  async selectAllProducts() {
    await this.bulkSelectCheckbox.check();
  }

  /**
   * Select product at index (bulk)
   */
  async selectProduct(index = 0) {
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
   * Verify product created
   */
  async verifyProductCreated(productName) {
    await this.page.waitForTimeout(1000);
    const productExists = await this.productName.filter({ hasText: productName }).isVisible();
    return productExists;
  }

  /**
   * Verify product deleted
   */
  async verifyProductDeleted(productName) {
    await this.page.waitForTimeout(1000);
    const productExists = await this.productName.filter({ hasText: productName }).isVisible().catch(() => false);
    return !productExists;
  }

  /**
   * Verify products loaded
   */
  async verifyLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.productsTable).toBeVisible();
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
   * Get success message
   */
  async getSuccessMessage() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.successMessage.textContent();
  }
}

const expect = require('@playwright/test').expect;
module.exports = AdminProducts;
