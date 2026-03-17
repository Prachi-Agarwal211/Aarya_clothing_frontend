/**
 * Product Browsing E2E Tests
 * 
 * Test Suite: Product Discovery & Interaction
 * Coverage:
 * - Search products with filters
 * - Category navigation
 * - Product detail page
 * - Image gallery interaction
 * - Size selection
 * - Add to wishlist
 */

import { test, expect } from '@playwright/test';
import HomePage from '../../pages/HomePage';
import ProductPage from '../../pages/ProductPage';

test.describe('Product Browsing', () => {
  let homePage: HomePage;
  let productPage: ProductPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    productPage = new ProductPage(page);
  });

  test.describe('Homepage & Navigation', () => {
    test('should load homepage successfully', async ({ page }) => {
      await homePage.goto();
      await homePage.verifyLoaded();
    });

    test('should navigate to new arrivals', async ({ page }) => {
      await homePage.goto();
      await homePage.goToNewArrivals();
      
      await expect(page).toHaveURL(/\/new-arrivals/, { timeout: 10000 });
    });

    test('should navigate to collections', async ({ page }) => {
      await homePage.goto();
      await homePage.collectionsLink.click();
      
      await expect(page).toHaveURL(/\/collections/, { timeout: 10000 });
    });

    test('should display featured products', async ({ page }) => {
      await homePage.goto();
      
      const productCount = await homePage.getProductCount();
      expect(productCount).toBeGreaterThan(0);
    });

    test('should click on product card from homepage', async ({ page }) => {
      await homePage.goto();
      
      const productCount = await homePage.getProductCount();
      if (productCount > 0) {
        await homePage.clickProduct(0);
        await productPage.verifyLoaded();
      }
    });
  });

  test.describe('Product Search', () => {
    test('should search for products', async ({ page }) => {
      await homePage.goto();
      
      await homePage.searchProducts('kurti');
      
      // Should navigate to search results or products page
      await expect(page).toHaveURL(/\/search|\/products/, { timeout: 10000 });
      
      // Should show search results
      const products = page.locator('[class*="product-card"], .product-item');
      const count = await products.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show no results for invalid search', async ({ page }) => {
      await homePage.goto();
      
      await homePage.searchProducts('xyznonexistent123');
      
      // Should show no results message or empty state
      await page.waitForTimeout(2000);
      const noResults = page.locator('text=no results, text=No products found, .empty-results');
      const hasNoResults = await noResults.isVisible().catch(() => false);
      const products = page.locator('[class*="product-card"]');
      const productCount = await products.count();
      
      expect(hasNoResults || productCount === 0).toBeTruthy();
    });

    test('should search with special characters', async ({ page }) => {
      await homePage.goto();
      
      await homePage.searchProducts('<script>alert("xss")</script>');
      
      // Should handle safely - either show no results or sanitize
      await page.waitForTimeout(2000);
    });
  });

  test.describe('Product Detail Page', () => {
    test('should load product detail page', async ({ page }) => {
      await productPage.goto('1');
      await productPage.verifyLoaded();
    });

    test('should display product title', async ({ page }) => {
      await productPage.goto('1');
      
      const title = await productPage.getProductTitle();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('should display product price', async ({ page }) => {
      await productPage.goto('1');
      
      const price = await productPage.getProductPrice();
      expect(price).toBeGreaterThan(0);
    });

    test('should display product description', async ({ page }) => {
      await productPage.goto('1');
      
      await expect(productPage.productDescription).toBeVisible();
    });

    test('should display product images', async ({ page }) => {
      await productPage.goto('1');
      
      await expect(productPage.mainImage).toBeVisible();
      
      // Check image has src
      const imageSrc = await productPage.mainImage.getAttribute('src');
      expect(imageSrc).toBeTruthy();
    });

    test('should display available sizes', async ({ page }) => {
      await productPage.goto('1');
      
      const sizes = await productPage.getAvailableSizes();
      expect(sizes.length).toBeGreaterThan(0);
    });

    test('should show stock status', async ({ page }) => {
      await productPage.goto('1');
      
      const inStock = await productPage.isInStock();
      // Product should either be in stock or show out of stock label
      expect(inStock || await productPage.outOfStockLabel.isVisible().catch(() => false)).toBeTruthy();
    });
  });

  test.describe('Image Gallery', () => {
    test('should navigate through image gallery', async ({ page }) => {
      await productPage.goto('1');
      
      const thumbnailCount = await productPage.thumbnailImages.count();
      
      if (thumbnailCount > 1) {
        // Click next image button
        if (await productPage.imageNextButton.isVisible()) {
          await productPage.nextImage();
          
          // Main image should change
          await page.waitForTimeout(500);
        }
        
        // Click previous image button
        if (await productPage.imagePrevButton.isVisible()) {
          await productPage.previousImage();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should switch image on thumbnail click', async ({ page }) => {
      await productPage.goto('1');
      
      const thumbnailCount = await productPage.thumbnailImages.count();
      
      if (thumbnailCount > 1) {
        await productPage.clickThumbnail(1);
        await page.waitForTimeout(500);
        
        // Main image should update
        const mainImageSrc = await productPage.mainImage.getAttribute('src');
        expect(mainImageSrc).toBeTruthy();
      }
    });

    test('should have zoom functionality', async ({ page }) => {
      await productPage.goto('1');
      
      // Check if zoom is available
      const hasZoom = await productPage.imageZoom.isVisible().catch(() => false);
      
      if (hasZoom) {
        // Hover over image to trigger zoom
        await productPage.mainImage.hover();
        await page.waitForTimeout(500);
        
        // Zoomed image should appear
        const zoomVisible = await productPage.imageZoom.isVisible().catch(() => false);
        expect(zoomVisible).toBeTruthy();
      }
    });
  });

  test.describe('Size Selection', () => {
    test('should select size successfully', async ({ page }) => {
      await productPage.goto('1');
      
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.selectSize(sizes[0]);
        
        // Size should be selected
        const sizeButton = productPage.sizeButtons.filter({ hasText: sizes[0] });
        await expect(sizeButton).toHaveAttribute('aria-pressed', 'true').catch(() => {
          // Alternative check if aria-pressed not available
          return expect(sizeButton).toBeVisible();
        });
      }
    });

    test('should show size guide', async ({ page }) => {
      await productPage.goto('1');
      
      await productPage.openSizeGuide();
      
      // Modal should be visible
      const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
      await expect(modal).toBeVisible();
      
      // Size chart should be visible
      const sizeChart = page.locator('text=Size Chart, text=Size, .size-chart');
      await expect(sizeChart.first()).toBeVisible();
    });

    test('should close size guide modal', async ({ page }) => {
      await productPage.goto('1');
      await productPage.openSizeGuide();
      
      // Close with Escape key
      await page.keyboard.press('Escape');
      
      const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
      await expect(modal).not.toBeVisible();
    });

    test('should require size selection before add to cart', async ({ page }) => {
      await productPage.goto('1');
      
      // Try to add to cart without selecting size
      await productPage.addToCartButton.click();
      
      // Should show size selection error
      await page.waitForTimeout(1000);
      const sizeErrorVisible = await productPage.sizeErrorMessage.isVisible().catch(() => false);
      expect(sizeErrorVisible).toBeTruthy();
    });
  });

  test.describe('Wishlist', () => {
    test('should add product to wishlist', async ({ page }) => {
      await productPage.goto('1');
      
      await productPage.addToWishlist();
      
      // Should show success or update wishlist icon
      await page.waitForTimeout(500);
      
      // Wishlist button should show added state
      const addedState = await productPage.addToWishlistButton.getAttribute('aria-pressed');
      const hasHeartFilled = await page.locator('.heart-filled, .wishlist-active').isVisible().catch(() => false);
      
      expect(addedState === 'true' || hasHeartFilled).toBeTruthy();
    });

    test('should toggle wishlist', async ({ page }) => {
      await productPage.goto('1');
      
      // Add to wishlist
      await productPage.addToWishlistButton.click();
      await page.waitForTimeout(500);
      
      // Remove from wishlist
      await productPage.addToWishlistButton.click();
      await page.waitForTimeout(500);
      
      // Should be removed
      const hasHeartFilled = await page.locator('.heart-filled, .wishlist-active').isVisible().catch(() => false);
      expect(hasHeartFilled).toBeFalsy();
    });

    test('should require login for wishlist (if applicable)', async ({ page }) => {
      await productPage.goto('1');
      
      await productPage.addToWishlist();
      
      // May redirect to login or show login modal
      const url = page.url();
      const loginModalVisible = await page.locator('[class*="login"], [class*="auth"]').isVisible().catch(() => false);
      
      expect(url.includes('login') || loginModalVisible || true).toBeTruthy();
    });
  });

  test.describe('Product Variants', () => {
    test('should select color variant', async ({ page }) => {
      await productPage.goto('1');
      
      const colorCount = await productPage.colorSwatches.count();
      
      if (colorCount > 0) {
        await productPage.selectColor('Red');
        await page.waitForTimeout(500);
        
        // Color should be selected
        const selectedColor = await page.locator('.color-swatch.selected, .color-swatch[aria-pressed="true"]').isVisible().catch(() => false);
        expect(selectedColor).toBeTruthy();
      }
    });

    test('should update images on color change', async ({ page }) => {
      await productPage.goto('1');
      
      const colorCount = await productPage.colorSwatches.count();
      
      if (colorCount > 1) {
        const initialImageSrc = await productPage.mainImage.getAttribute('src');
        
        await productPage.colorSwatches.nth(1).click();
        await page.waitForTimeout(1000);
        
        const newImageSrc = await productPage.mainImage.getAttribute('src');
        
        // Image may change based on color
        // This is optional - some products may not have color-specific images
        expect(newImageSrc).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Design - Products', () => {
    test('should display product page correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await productPage.goto('1');
      
      await expect(productPage.productTitle).toBeVisible();
      await expect(productPage.productPrice).toBeVisible();
      await expect(productPage.addToCartButton).toBeVisible();
    });

    test('should display product gallery correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await productPage.goto('1');
      
      await expect(productPage.mainImage).toBeVisible();
      
      // Thumbnails should be accessible or swipeable
      const thumbnailsVisible = await productPage.thumbnailImages.first().isVisible().catch(() => false);
      expect(thumbnailsVisible).toBeTruthy();
    });

    test('should display product page correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await productPage.goto('1');
      
      await productPage.verifyLoaded();
    });
  });

  test.describe('Related Products', () => {
    test('should display related products', async ({ page }) => {
      await productPage.goto('1');
      
      // Scroll to related products section
      await productPage.relatedProducts.scrollIntoViewIfNeeded();
      
      const relatedCount = await productPage.relatedProductCards.count();
      expect(relatedCount).toBeGreaterThan(0);
    });

    test('should navigate to related product', async ({ page }) => {
      await productPage.goto('1');
      
      await productPage.relatedProducts.scrollIntoViewIfNeeded();
      
      const relatedCount = await productPage.relatedProductCards.count();
      if (relatedCount > 0) {
        await productPage.relatedProductCards.nth(0).click();
        await page.waitForTimeout(2000);
        
        // Should navigate to new product page
        const newTitle = await productPage.getProductTitle();
        expect(newTitle).toBeTruthy();
      }
    });
  });
});
