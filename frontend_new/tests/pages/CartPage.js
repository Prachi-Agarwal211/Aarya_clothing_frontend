/**
 * Cart Page Object Model
 * 
 * Handles shopping cart operations including:
 * - View cart items
 * - Update quantities
 * - Remove items
 * - Apply coupons
 * - Proceed to checkout
 */
class CartPage {
  constructor(page) {
    this.page = page;
    
    // Cart items
    this.cartItems = page.locator('.cart-item, [class*="cart-item"], [data-testid="cart-item"]');
    this.cartItemName = page.locator('.item-name, [class*="product-name"]');
    this.cartItemPrice = page.locator('.item-price, [class*="price"]');
    this.cartItemImage = page.locator('.item-image img, [class*="product-image"]');
    
    // Quantity controls
    this.quantitySelector = page.locator('.quantity-selector, [class*="quantity"]');
    this.quantityInput = page.locator('input[type="number"][name="quantity"], .quantity-input');
    this.quantityIncrease = page.locator('button[aria-label*="increase"], .quantity-up, button:has-text("+")');
    this.quantityDecrease = page.locator('button[aria-label*="decrease"], .quantity-down, button:has-text("-")');
    
    // Remove item
    this.removeButton = page.locator('button:has-text("Remove"), button[aria-label*="remove"], .remove-item, [data-testid="remove"]');
    
    // Cart summary
    this.subtotal = page.locator('.subtotal, [class*="subtotal"], [data-testid="subtotal"]');
    this.discount = page.locator('.discount, [class*="discount"], [data-testid="discount"]');
    this.tax = page.locator('.tax, [class*="tax"], [data-testid="tax"]');
    this.total = page.locator('.total, [class*="total"], [data-testid="total"]');
    
    // Coupon section
    this.couponInput = page.locator('input[name="coupon"], input[placeholder*="coupon" i], .coupon-input');
    this.applyCouponButton = page.locator('button:has-text("Apply"), button:has-text("Apply Coupon"), .apply-coupon');
    this.couponErrorMessage = page.locator('.coupon-error, [class*="invalid"], [class*="error"]');
    this.couponSuccessMessage = page.locator('.coupon-success, [class*="applied"]');
    this.removeCouponButton = page.locator('button:has-text("Remove Coupon"), .remove-coupon');
    
    // Cart actions
    this.checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Proceed"), [data-testid="checkout"]');
    this.continueShoppingButton = page.locator('a:has-text("Continue Shopping"), a[href*="products"], .continue-shopping');
    this.clearCartButton = page.locator('button:has-text("Clear Cart"), .clear-cart');
    
    // Empty cart
    this.emptyCartMessage = page.locator('text=Your cart is empty, .empty-cart, [class*="empty"]');
    this.shopNowButton = page.locator('a:has-text("Shop Now"), button:has-text("Shop Now")');
    
    // Cart count
    this.cartCount = page.locator('.cart-count, [class*="cart-count"], [data-testid="cart-count"]');
    
    // Shipping estimator
    this.shippingEstimator = page.locator('.shipping-estimator, [class*="shipping"]');
    this.pincodeInput = page.locator('input[placeholder*="pincode" i], input[name="pincode"]');
    this.checkShippingButton = page.locator('button:has-text("Check"), .check-shipping');
  }

  /**
   * Navigate to cart page
   */
  async goto() {
    await this.page.goto('/cart');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get cart item count
   */
  async getItemCount() {
    return await this.cartItems.count();
  }

  /**
   * Get item name at index
   */
  async getItemName(index = 0) {
    return await this.cartItemName.nth(index).textContent();
  }

  /**
   * Get item price at index
   */
  async getItemPrice(index = 0) {
    const priceText = await this.cartItemPrice.nth(index).textContent();
    return parseFloat(priceText.replace(/[^0-9.]/g, ''));
  }

  /**
   * Update item quantity
   */
  async updateQuantity(index, quantity) {
    const quantityInput = this.quantityInput.nth(index);
    if (await quantityInput.isVisible()) {
      await quantityInput.fill(quantity.toString());
      await this.page.waitForTimeout(1000); // Wait for cart to update
    } else {
      const increaseBtn = this.quantityIncrease.nth(index);
      const decreaseBtn = this.quantityDecrease.nth(index);
      
      // Get current quantity
      const currentQty = await this.page.locator('.quantity-display').nth(index).textContent();
      const diff = quantity - parseInt(currentQty);
      
      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          await increaseBtn.click();
          await this.page.waitForTimeout(300);
        }
      } else {
        for (let i = 0; i < Math.abs(diff); i++) {
          await decreaseBtn.click();
          await this.page.waitForTimeout(300);
        }
      }
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(index = 0) {
    const removeBtn = this.removeButton.nth(index);
    await removeBtn.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Apply coupon code
   */
  async applyCoupon(code) {
    await this.couponInput.fill(code);
    await this.applyCouponButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Remove applied coupon
   */
  async removeCoupon() {
    await this.removeCouponButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get coupon error message
   */
  async getCouponErrorMessage() {
    await this.couponErrorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.couponErrorMessage.textContent();
  }

  /**
   * Verify coupon applied
   */
  async verifyCouponApplied() {
    await this.couponSuccessMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.couponSuccessMessage.isVisible();
  }

  /**
   * Get cart subtotal
   */
  async getSubtotal() {
    const text = await this.subtotal.textContent();
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  /**
   * Get cart total
   */
  async getTotal() {
    const text = await this.total.textContent();
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  /**
   * Proceed to checkout
   */
  async checkout() {
    await this.checkoutButton.click();
    await this.page.waitForURL(/\/checkout/, { timeout: 10000 });
  }

  /**
   * Continue shopping
   */
  async continueShopping() {
    await this.continueShoppingButton.click();
    await this.page.waitForURL(/\/products|\/collections|\/new-arrivals/, { timeout: 10000 });
  }

  /**
   * Clear entire cart
   */
  async clearCart() {
    if (await this.clearCartButton.isVisible()) {
      await this.clearCartButton.click();
      // Confirm if there's a confirmation dialog
      try {
        await this.page.waitForSelector('button:has-text("Confirm")', { timeout: 2000 });
        await this.page.click('button:has-text("Confirm")');
      } catch (e) {
        // No confirmation needed
      }
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Check if cart is empty
   */
  async isEmpty() {
    return await this.emptyCartMessage.isVisible();
  }

  /**
   * Verify cart loaded with items
   */
  async verifyLoaded() {
    await expect(this.cartItems.first()).toBeVisible({ timeout: 10000 });
  }

  /**
   * Verify empty cart state
   */
  async verifyEmpty() {
    await expect(this.emptyCartMessage).toBeVisible();
    await expect(this.shopNowButton).toBeVisible();
  }

  /**
   * Check shipping for pincode
   */
  async checkShipping(pincode) {
    await this.pincodeInput.fill(pincode);
    await this.checkShippingButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get cart summary
   */
  async getCartSummary() {
    return {
      subtotal: await this.getSubtotal(),
      total: await this.getTotal(),
      itemCount: await this.getItemCount(),
    };
  }
}

const expect = require('@playwright/test').expect;
module.exports = CartPage;
