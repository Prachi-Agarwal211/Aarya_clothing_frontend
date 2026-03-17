/**
 * Checkout Page Object Model
 * 
 * Handles checkout flow including:
 * - Delivery address
 * - Payment method selection
 * - Order review
 * - Order confirmation
 */
class CheckoutPage {
  constructor(page) {
    this.page = page;
    
    // Checkout steps
    this.checkoutSteps = page.locator('.checkout-steps, [class*="step"], .stepper');
    this.currentStep = page.locator('.step.active, [class*="current"]');
    
    // Delivery address section
    this.addressSection = page.locator('.address-section, [class*="address"], [data-testid="address"]');
    this.savedAddresses = page.locator('.saved-address, [class*="address-card"]');
    this.addNewAddressButton = page.locator('button:has-text("Add New Address"), .add-address');
    this.addressForm = page.locator('.address-form, [class*="address-form"]');
    
    // Address form fields
    this.nameInput = page.locator('input[name="name"], #name, [placeholder*="name" i]');
    this.phoneInput = page.locator('input[name="phone"], input[type="tel"], #phone');
    this.addressLine1Input = page.locator('input[name="addressLine1"], input[placeholder*="address" i], #address1');
    this.addressLine2Input = page.locator('input[name="addressLine2"], #address2');
    this.cityInput = page.locator('input[name="city"], #city');
    this.stateInput = page.locator('input[name="state"], #state, select[name="state"]');
    this.pincodeInput = page.locator('input[name="pincode"], input[placeholder*="pincode" i], #pincode');
    this.addressType = page.locator('input[name="addressType"], .address-type');
    this.saveAddressButton = page.locator('button:has-text("Save Address"), .save-address');
    
    // Select address
    this.selectAddressButton = page.locator('button:has-text("Deliver Here"), button:has-text("Select"), .select-address');
    
    // Order summary
    this.orderSummary = page.locator('.order-summary, [class*="summary"], [data-testid="order-summary"]');
    this.orderItems = page.locator('.order-item, [class*="order-item"]');
    this.orderSubtotal = page.locator('.order-subtotal, [data-testid="order-subtotal"]');
    this.orderShipping = page.locator('.order-shipping, [data-testid="order-shipping"]');
    this.orderTax = page.locator('.order-tax, [data-testid="order-tax"]');
    this.orderDiscount = page.locator('.order-discount, [data-testid="order-discount"]');
    this.orderTotal = page.locator('.order-total, [data-testid="order-total"]');
    
    // Payment methods
    this.paymentSection = page.locator('.payment-section, [class*="payment"], [data-testid="payment"]');
    this.paymentMethods = page.locator('.payment-method, [class*="payment-option"]');
    
    // COD payment
    this.codOption = page.locator('input[value="cod"], .cod-option, button:has-text("Cash on Delivery")');
    this.codLabel = page.locator('label:has-text("Cash on Delivery"), .cod-label');
    
    // UPI payment
    this.upiOption = page.locator('input[value="upi"], .upi-option, button:has-text("UPI")');
    this.upiLabel = page.locator('label:has-text("UPI"), .upi-label');
    this.upiIdInput = page.locator('input[placeholder*="UPI"], input[name="upiId"], .upi-input');
    
    // Card payment
    this.cardOption = page.locator('input[value="card"], .card-option, button:has-text("Card")');
    this.cardNumberInput = page.locator('input[placeholder*="Card Number"], input[name="cardNumber"]');
    this.cardExpiryInput = page.locator('input[placeholder*="MM/YY"], input[name="expiry"]');
    this.cardCvvInput = page.locator('input[placeholder*="CVV"], input[name="cvv"]');
    this.cardNameInput = page.locator('input[placeholder*="Name on Card"], input[name="cardName"]');
    
    // Net banking
    this.netbankingOption = page.locator('input[value="netbanking"], .netbanking-option');
    this.bankSelector = page.locator('select[name="bank"], .bank-selector');
    
    // Place order
    this.placeOrderButton = page.locator('button:has-text("Place Order"), button:has-text("Confirm Order"), [data-testid="place-order"]');
    this.termsCheckbox = page.locator('input[type="checkbox"][name="terms"], .terms-checkbox');
    
    // Coupon in checkout
    this.couponSection = page.locator('.coupon-section, [class*="coupon"]');
    this.couponInput = page.locator('input[name="coupon"], .coupon-input');
    this.applyCouponButton = page.locator('button:has-text("Apply"), .apply-coupon');
    
    // Contact information
    this.contactEmail = page.locator('input[type="email"][name="email"], #email');
    this.contactPhone = page.locator('input[type="tel"][name="phone"], #phone');
    
    // Delivery options
    this.deliveryOptions = page.locator('.delivery-options, [class*="delivery"]');
    this.standardDelivery = page.locator('input[value="standard"], .standard-delivery');
    this.expressDelivery = page.locator('input[value="express"], .express-delivery');
    
    // Order confirmation
    this.confirmationMessage = page.locator('.confirmation-message, [class*="success"], [data-testid="confirmation"]');
    this.orderNumber = page.locator('.order-number, [class*="order-id"], [data-testid="order-number"]');
    this.orderDate = page.locator('.order-date, [class*="order-date"]');
    this.continueShoppingButton = page.locator('a:has-text("Continue Shopping"), .continue-shopping');
    this.viewOrderButton = page.locator('a:has-text("View Order"), button:has-text("View Order"), .view-order');
    
    // Error messages
    this.errorMessage = page.locator('.error-message, [class*="error"], [role="alert"]');
  }

  /**
   * Navigate to checkout
   */
  async goto() {
    await this.page.goto('/checkout');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Select saved address
   */
  async selectSavedAddress(index = 0) {
    await this.selectAddressButton.nth(index).click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Add new address
   */
  async addNewAddress(address) {
    await this.addNewAddressButton.click();
    await this.addressForm.waitFor({ state: 'visible', timeout: 5000 });
    
    await this.nameInput.fill(address.name);
    await this.phoneInput.fill(address.phone);
    await this.addressLine1Input.fill(address.addressLine1);
    
    if (address.addressLine2) {
      await this.addressLine2Input.fill(address.addressLine2);
    }
    
    await this.cityInput.fill(address.city);
    await this.stateInput.fill(address.state);
    await this.pincodeInput.fill(address.pincode);
    
    await this.saveAddressButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Select payment method
   */
  async selectPaymentMethod(method) {
    switch (method.toLowerCase()) {
      case 'cod':
      case 'cash on delivery':
        await this.codOption.click();
        break;
      case 'upi':
        await this.upiOption.click();
        break;
      case 'card':
        await this.cardOption.click();
        break;
      case 'netbanking':
        await this.netbankingOption.click();
        break;
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Fill UPI details
   */
  async fillUpiDetails(upiId) {
    await this.upiIdInput.fill(upiId);
  }

  /**
   * Fill card details (test mode)
   */
  async fillCardDetails(cardDetails) {
    await this.cardNumberInput.fill(cardDetails.number || '4111111111111111');
    await this.cardExpiryInput.fill(cardDetails.expiry || '12/25');
    await this.cardCvvInput.fill(cardDetails.cvv || '123');
    await this.cardNameInput.fill(cardDetails.name || 'Test User');
  }

  /**
   * Check terms and conditions
   */
  async acceptTerms() {
    if (await this.termsCheckbox.isVisible()) {
      await this.termsCheckbox.check();
    }
  }

  /**
   * Place order
   */
  async placeOrder() {
    await this.acceptTerms();
    await this.placeOrderButton.click();
    await this.page.waitForTimeout(3000); // Wait for order processing
  }

  /**
   * Verify order confirmation
   */
  async verifyOrderConfirmation() {
    await this.confirmationMessage.waitFor({ state: 'visible', timeout: 15000 });
    await this.orderNumber.waitFor({ state: 'visible', timeout: 5000 });
    return await this.orderNumber.textContent();
  }

  /**
   * Get order number
   */
  async getOrderNumber() {
    const text = await this.orderNumber.textContent();
    return text.replace(/[^A-Z0-9]/gi, '');
  }

  /**
   * View order details
   */
  async viewOrder() {
    await this.viewOrderButton.click();
    await this.page.waitForURL(/\/profile\/orders/, { timeout: 10000 });
  }

  /**
   * Continue shopping
   */
  async continueShopping() {
    await this.continueShoppingButton.click();
    await this.page.waitForURL(/\/$/, { timeout: 10000 });
  }

  /**
   * Apply coupon in checkout
   */
  async applyCoupon(code) {
    await this.couponInput.fill(code);
    await this.applyCouponButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get order total
   */
  async getOrderTotal() {
    const text = await this.orderTotal.textContent();
    return parseFloat(text.replace(/[^0-9.]/g, ''));
  }

  /**
   * Get order summary
   */
  async getOrderSummary() {
    return {
      subtotal: await this.getOrderTotal(),
      itemCount: await this.orderItems.count(),
    };
  }

  /**
   * Verify checkout loaded
   */
  async verifyLoaded() {
    await expect(this.addressSection).toBeVisible();
    await expect(this.paymentSection).toBeVisible();
    await expect(this.orderSummary).toBeVisible();
  }

  /**
   * Select delivery option
   */
  async selectDeliveryOption(option) {
    if (option.toLowerCase() === 'express') {
      await this.expressDelivery.click();
    } else {
      await this.standardDelivery.click();
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Fill contact information
   */
  async fillContactInfo(email, phone) {
    await this.contactEmail.fill(email);
    await this.contactPhone.fill(phone);
  }
}

const expect = require('@playwright/test').expect;
module.exports = CheckoutPage;
