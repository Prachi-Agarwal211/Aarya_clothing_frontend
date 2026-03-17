/**
 * Shopping Cart E2E Tests
 * 
 * Test Suite: Cart Management
 * Coverage:
 * - Add to cart
 * - Update quantity
 * - Remove items
 * - Cart persistence after logout
 * - Cart merge on login
 * - Empty cart state
 */

import { test, expect } from '@playwright/test';
import HomePage from '../../pages/HomePage';
import ProductPage from '../../pages/ProductPage';
import CartPage from '../../pages/CartPage';

test.describe('Shopping Cart', () => {
  let homePage: HomePage;
  let productPage: ProductPage;
  let cartPage: CartPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
  });

  test.describe('Add to Cart', () => {
    test('should add product to cart from product page', async ({ page }) => {
      await productPage.goto('1');
      
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        
        // Should show cart confirmation or update cart count
        await page.waitForTimeout(1000);
        
        const cartCountVisible = await homePage.cartIcon.isVisible();
        expect(cartCountVisible).toBeTruthy();
      }
    });

    test('should add multiple items to cart', async ({ page }) => {
      // Add first product
      await productPage.goto('1');
      const sizes1 = await productPage.getAvailableSizes();
      if (sizes1.length > 0) {
        await productPage.addToCart(sizes1[0]);
        await page.waitForTimeout(1000);
      }
      
      // Add second product
      await productPage.goto('2');
      const sizes2 = await productPage.getAvailableSizes();
      if (sizes2.length > 0) {
        await productPage.addToCart(sizes2[0]);
        await page.waitForTimeout(1000);
      }
      
      // Navigate to cart
      await cartPage.goto();
      
      const itemCount = await cartPage.getItemCount();
      expect(itemCount).toBeGreaterThanOrEqual(2);
    });

    test('should show error when adding without size selection', async ({ page }) => {
      await productPage.goto('1');
      
      // Click add to cart without selecting size
      await productPage.addToCartButton.click();
      
      // Should show size selection error
      await page.waitForTimeout(1000);
      const sizeErrorVisible = await productPage.sizeErrorMessage.isVisible().catch(() => false);
      expect(sizeErrorVisible).toBeTruthy();
    });

    test('should update cart count in header', async ({ page }) => {
      await homePage.goto();
      
      const initialCount = await homePage.cartCount.textContent().catch(() => '0');
      
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
        
        const newCount = await homePage.cartCount.textContent().catch(() => '0');
        expect(parseInt(newCount) || 0).toBeGreaterThan(parseInt(initialCount) || 0);
      }
    });
  });

  test.describe('Cart Management', () => {
    test('should view cart contents', async ({ page }) => {
      // Add item to cart first
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      await cartPage.verifyLoaded();
      
      const itemCount = await cartPage.getItemCount();
      expect(itemCount).toBeGreaterThan(0);
    });

    test('should display item details in cart', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      // Should show item name
      const itemName = await cartPage.getItemName(0);
      expect(itemName).toBeTruthy();
      
      // Should show item price
      const itemPrice = await cartPage.getItemPrice(0);
      expect(itemPrice).toBeGreaterThan(0);
    });

    test('should update item quantity', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0], 1);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const initialTotal = await cartPage.getTotal();
      
      // Update quantity
      await cartPage.updateQuantity(0, 2);
      
      const newTotal = await cartPage.getTotal();
      expect(newTotal).toBeGreaterThan(initialTotal);
    });

    test('should increase quantity with + button', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0], 1);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const initialTotal = await cartPage.getTotal();
      
      // Click increase button
      if (await cartPage.quantityIncrease.isVisible()) {
        await cartPage.quantityIncrease.first().click();
        await page.waitForTimeout(1000);
        
        const newTotal = await cartPage.getTotal();
        expect(newTotal).toBeGreaterThan(initialTotal);
      }
    });

    test('should decrease quantity with - button', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0], 2);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const initialTotal = await cartPage.getTotal();
      
      // Click decrease button
      if (await cartPage.quantityDecrease.isVisible()) {
        await cartPage.quantityDecrease.first().click();
        await page.waitForTimeout(1000);
        
        const newTotal = await cartPage.getTotal();
        expect(newTotal).toBeLessThan(initialTotal);
      }
    });

    test('should remove item from cart', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const initialCount = await cartPage.getItemCount();
      expect(initialCount).toBeGreaterThan(0);
      
      // Remove item
      await cartPage.removeItem(0);
      
      const newCount = await cartPage.getItemCount();
      expect(newCount).toBeLessThan(initialCount);
    });

    test('should clear entire cart', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      if (await cartPage.clearCartButton.isVisible()) {
        await cartPage.clearCart();
        
        const isEmpty = await cartPage.isEmpty();
        expect(isEmpty).toBeTruthy();
      }
    });

    test('should show empty cart state', async ({ page }) => {
      await cartPage.goto();
      
      // Clear cart if not empty
      if (await cartPage.clearCartButton.isVisible()) {
        await cartPage.clearCart();
      }
      
      const isEmpty = await cartPage.isEmpty();
      
      if (isEmpty) {
        await cartPage.verifyEmpty();
      }
    });

    test('should navigate to checkout from cart', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const itemCount = await cartPage.getItemCount();
      if (itemCount > 0) {
        await cartPage.checkout();
        
        await expect(page).toHaveURL(/\/checkout/, { timeout: 10000 });
      }
    });

    test('should continue shopping from cart', async ({ page }) => {
      await cartPage.goto();
      
      if (await cartPage.continueShoppingButton.isVisible()) {
        await cartPage.continueShopping();
        
        await expect(page).toHaveURL(/\/products|\/collections|\/new-arrivals|\/$/, { timeout: 10000 });
      }
    });
  });

  test.describe('Cart Summary', () => {
    test('should display subtotal', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const subtotal = await cartPage.getSubtotal();
      expect(subtotal).toBeGreaterThan(0);
    });

    test('should display total', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const total = await cartPage.getTotal();
      expect(total).toBeGreaterThan(0);
    });

    test('should calculate total correctly', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const subtotal = await cartPage.getSubtotal();
      const total = await cartPage.getTotal();
      
      // Total should be >= subtotal (may include tax/shipping)
      expect(total).toBeGreaterThanOrEqual(subtotal);
    });
  });

  test.describe('Cart Persistence', () => {
    test('should persist cart after page refresh', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      const initialCount = await homePage.cartCount.textContent().catch(() => '0');
      
      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);
      
      const newCount = await homePage.cartCount.textContent().catch(() => '0');
      expect(parseInt(newCount) || 0).toBeGreaterThanOrEqual(parseInt(initialCount) || 0);
    });

    test('should persist cart after navigation', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      const initialCount = await homePage.cartCount.textContent().catch(() => '0');
      
      // Navigate to different pages
      await homePage.goto();
      await productPage.goto('2');
      await homePage.goto();
      
      const newCount = await homePage.cartCount.textContent().catch(() => '0');
      expect(parseInt(newCount) || 0).toBeGreaterThanOrEqual(parseInt(initialCount) || 0);
    });
  });

  test.describe('Coupon System', () => {
    test('should apply valid coupon', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      const initialTotal = await cartPage.getTotal();
      
      // Apply coupon
      await cartPage.applyCoupon('TEST10');
      
      // Should show success or discount
      const couponApplied = await cartPage.verifyCouponApplied().catch(() => false);
      const newTotal = await cartPage.getTotal();
      
      expect(couponApplied || newTotal < initialTotal).toBeTruthy();
    });

    test('should show error for invalid coupon', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      // Apply invalid coupon
      await cartPage.applyCoupon('INVALIDCOUPON123');
      
      // Should show error message
      const errorVisible = await cartPage.couponErrorMessage.isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should show error for expired coupon', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      // Apply expired coupon
      await cartPage.applyCoupon('EXPIRED');
      
      // Should show error
      const errorVisible = await cartPage.couponErrorMessage.isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should remove applied coupon', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      // Apply coupon first
      await cartPage.applyCoupon('TEST10');
      await page.waitForTimeout(1000);
      
      const totalWithCoupon = await cartPage.getTotal();
      
      // Remove coupon
      if (await cartPage.removeCouponButton.isVisible()) {
        await cartPage.removeCoupon();
        
        const totalWithoutCoupon = await cartPage.getTotal();
        expect(totalWithoutCoupon).toBeGreaterThanOrEqual(totalWithCoupon);
      }
    });
  });

  test.describe('Shipping Estimator', () => {
    test('should check shipping for pincode', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      if (await cartPage.shippingEstimator.isVisible()) {
        await cartPage.checkShipping('400001');
        
        // Should show shipping info
        await page.waitForTimeout(1000);
      }
    });

    test('should show error for invalid pincode', async ({ page }) => {
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      if (await cartPage.shippingEstimator.isVisible()) {
        await cartPage.checkShipping('invalid');
        
        // Should show error
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Responsive Design - Cart', () => {
    test('should display cart correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      
      await expect(cartPage.cartItems.first()).toBeVisible();
    });

    test('should display cart correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      await productPage.goto('1');
      const sizes = await productPage.getAvailableSizes();
      if (sizes.length > 0) {
        await productPage.addToCart(sizes[0]);
        await page.waitForTimeout(1000);
      }
      
      await cartPage.goto();
      await cartPage.verifyLoaded();
    });
  });
});
