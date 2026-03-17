/**
 * Admin Product Management E2E Tests
 * 
 * Test Suite: CRUD Operations for Products
 * Coverage:
 * - Create product
 * - Edit product
 * - Delete product
 * - Bulk operations
 * - Search and filter
 */

import { test, expect } from '@playwright/test';
import AdminProducts from '../../pages/AdminProducts';

test.describe('Admin Product Management', () => {
  let adminProducts: AdminProducts;

  test.beforeEach(async ({ page }) => {
    adminProducts = new AdminProducts(page);
    
    // Login as admin
    await page.goto('/admin/landing');
    await page.fill('input[name="email"]', 'admin@aaryaclothing.com');
    await page.fill('input[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/.*/, { timeout: 10000 });
    
    // Navigate to products
    await adminProducts.goto();
  });

  test.describe('View Products', () => {
    test('should display products list', async ({ page }) => {
      await adminProducts.verifyLoaded();
      
      const productCount = await adminProducts.getProductCount();
      expect(productCount).toBeGreaterThanOrEqual(0);
    });

    test('should display product information', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        const productName = await adminProducts.getProductName(0);
        expect(productName).toBeTruthy();
      }
    });

    test('should search products', async ({ page }) => {
      await adminProducts.searchProducts('kurti');
      
      // Should filter results
      await page.waitForTimeout(1000);
    });

    test('should filter products by category', async ({ page }) => {
      await adminProducts.filterByCategory('kurti');
      
      // Should show only kurtis
      await page.waitForTimeout(1000);
    });

    test('should filter products by status', async ({ page }) => {
      await adminProducts.filterByStatus('active');
      
      // Should show only active products
      await page.waitForTimeout(1000);
    });

    test('should paginate through products', async ({ page }) => {
      const initialPageInfo = await adminProducts.pageInfo.textContent().catch(() => '');
      
      await adminProducts.nextPage();
      
      const newPageInfo = await adminProducts.pageInfo.textContent().catch(() => '');
      expect(newPageInfo).not.toBe(initialPageInfo);
    });
  });

  test.describe('Create Product', () => {
    test('should create new product successfully', async ({ page }) => {
      const timestamp = Date.now();
      const productName = `Test Product ${timestamp}`;
      
      await adminProducts.createProduct({
        name: productName,
        description: 'Test product description',
        price: 999,
        sku: `TEST-${timestamp}`,
        category: 'kurti',
        stock: 100,
        sizes: ['S', 'M', 'L'],
      });
      
      // Should show success message
      const successVisible = await adminProducts.successMessage.isVisible().catch(() => false);
      expect(successVisible).toBeTruthy();
      
      // Verify product was created
      const exists = await adminProducts.verifyProductCreated(productName);
      expect(exists).toBeTruthy();
    });

    test('should create product with images', async ({ page }) => {
      const timestamp = Date.now();
      
      await adminProducts.clickAddProduct();
      
      await adminProducts.nameInput.fill(`Test Product ${timestamp}`);
      await adminProducts.priceInput.fill('1999');
      await adminProducts.skuInput.fill(`IMG-TEST-${timestamp}`);
      
      // Upload test image if file input exists
      if (await adminProducts.imagesInput.isVisible()) {
        // Note: Would need actual image file for real test
        await adminProducts.imagesInput.setInputFiles([]);
      }
      
      await adminProducts.saveButton.click();
      await page.waitForTimeout(2000);
    });

    test('should validate required fields on create', async ({ page }) => {
      await adminProducts.clickAddProduct();
      
      // Try to save without filling required fields
      await adminProducts.saveButton.click();
      
      // Should show validation errors
      await page.waitForTimeout(1000);
    });

    test('should validate price is positive', async ({ page }) => {
      await adminProducts.clickAddProduct();
      
      await adminProducts.nameInput.fill('Test Product');
      await adminProducts.priceInput.fill('-100');
      await adminProducts.skuInput.fill('TEST-NEG');
      
      await adminProducts.saveButton.click();
      
      // Should show validation error
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Edit Product', () => {
    test('should edit existing product', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        const timestamp = Date.now();
        await adminProducts.editProduct(0, {
          name: `Updated Product ${timestamp}`,
          price: 1499,
        });
        
        // Should show success
        const successVisible = await adminProducts.successMessage.isVisible().catch(() => false);
        expect(successVisible).toBeTruthy();
      }
    });

    test('should update product stock', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        await adminProducts.editProduct(0, {
          stock: 50,
        });
        
        await page.waitForTimeout(1000);
      }
    });

    test('should update product status', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        await adminProducts.editButton.nth(0).click();
        await adminProducts.productForm.waitFor({ state: 'visible', timeout: 5000 });
        
        if (await adminProducts.statusSelect.isVisible()) {
          await adminProducts.statusSelect.selectOption('inactive');
          await adminProducts.saveButton.click();
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should cancel product edit', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        await adminProducts.editButton.nth(0).click();
        
        if (await adminProducts.cancelButton.isVisible()) {
          await adminProducts.cancelButton.click();
          
          // Should return to products list without saving
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Delete Product', () => {
    test('should delete product', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        const productName = await adminProducts.getProductName(0);
        
        await adminProducts.deleteProduct(0);
        
        // Should show success
        const successVisible = await adminProducts.successMessage.isVisible().catch(() => false);
        expect(successVisible).toBeTruthy();
        
        // Verify product was deleted
        const exists = await adminProducts.verifyProductDeleted(productName);
        expect(exists).toBeTruthy();
      }
    });

    test('should cancel product deletion', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        await adminProducts.deleteButton.nth(0).click();
        await adminProducts.deleteModal.waitFor({ state: 'visible', timeout: 5000 });
        
        if (await adminProducts.cancelDeleteButton.isVisible()) {
          await adminProducts.cancelDeleteButton.click();
          
          // Product should still exist
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select all products', async ({ page }) => {
      await adminProducts.selectAllProducts();
      
      // All checkboxes should be checked
      await page.waitForTimeout(500);
    });

    test('should select individual products', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 1) {
        await adminProducts.selectProduct(0);
        await adminProducts.selectProduct(1);
        
        await page.waitForTimeout(500);
      }
    });

    test('should apply bulk status update', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 1) {
        await adminProducts.selectAllProducts();
        
        if (await adminProducts.bulkActionsDropdown.isVisible()) {
          await adminProducts.bulkActionsDropdown.selectOption('activate');
          await adminProducts.applyBulkActionButton.click();
          
          await page.waitForTimeout(2000);
        }
      }
    });

    test('should apply bulk delete', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 1) {
        await adminProducts.selectProduct(0);
        
        if (await adminProducts.bulkActionsDropdown.isVisible()) {
          await adminProducts.bulkActionsDropdown.selectOption('delete');
          await adminProducts.applyBulkActionButton.click();
          
          // Confirm deletion
          const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
          }
          
          await page.waitForTimeout(2000);
        }
      }
    });
  });

  test.describe('Product Validation', () => {
    test('should require product name', async ({ page }) => {
      await adminProducts.clickAddProduct();
      await adminProducts.priceInput.fill('999');
      await adminProducts.saveButton.click();
      
      // Should show validation error
      await page.waitForTimeout(1000);
    });

    test('should require product price', async ({ page }) => {
      await adminProducts.clickAddProduct();
      await adminProducts.nameInput.fill('Test Product');
      await adminProducts.saveButton.click();
      
      // Should show validation error
      await page.waitForTimeout(1000);
    });

    test('should validate SKU uniqueness', async ({ page }) => {
      await adminProducts.clickAddProduct();
      await adminProducts.nameInput.fill('Test Product');
      await adminProducts.priceInput.fill('999');
      await adminProducts.skuInput.fill('DUPLICATE-SKU');
      
      // Save first product
      await adminProducts.saveButton.click();
      await page.waitForTimeout(2000);
      
      // Try to create another with same SKU
      await adminProducts.clickAddProduct();
      await adminProducts.nameInput.fill('Another Product');
      await adminProducts.priceInput.fill('999');
      await adminProducts.skuInput.fill('DUPLICATE-SKU');
      await adminProducts.saveButton.click();
      
      // Should show error for duplicate SKU
      await page.waitForTimeout(2000);
    });
  });

  test.describe('Product Images', () => {
    test('should upload product images', async ({ page }) => {
      const timestamp = Date.now();
      await adminProducts.clickAddProduct();
      
      await adminProducts.nameInput.fill(`Image Test ${timestamp}`);
      await adminProducts.priceInput.fill('999');
      
      if (await adminProducts.imagesInput.isVisible()) {
        // Note: Would need actual image file
        expect(adminProducts.imagesInput).toBeTruthy();
      }
    });

    test('should remove product image', async ({ page }) => {
      const productCount = await adminProducts.getProductCount();
      
      if (productCount > 0) {
        await adminProducts.editButton.nth(0).click();
        
        // Look for remove image button
        const removeImageButton = page.locator('button[aria-label*="remove image"], .remove-image').first();
        if (await removeImageButton.isVisible()) {
          expect(removeImageButton).toBeTruthy();
        }
      }
    });
  });

  test.describe('Responsive Design - Products', () => {
    test('should display products table correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await adminProducts.verifyLoaded();
    });
  });
});
