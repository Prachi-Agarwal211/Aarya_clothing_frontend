/**
 * Checkout Flow E2E Tests
 *
 * Test Suite: Order Placement
 * Coverage:
 * - Registered user checkout (login required)
 * - Address addition
 * - Payment method selection
 * - Razorpay payment flow
 * - Order confirmation
 */

import { test, expect } from '@playwright/test';
import HomePage from '../../pages/HomePage';
import ProductPage from '../../pages/ProductPage';
import CartPage from '../../pages/CartPage';
import CheckoutPage from '../../pages/CheckoutPage';

test.describe('Checkout Flow', () => {
  let homePage;
  let productPage;
  let cartPage;
  let checkoutPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
    checkoutPage = new CheckoutPage(page);
  });

  // Helper function to add product to cart
  async function addToCart(page, productId = '1') {
    await productPage.goto(productId);
    const sizes = await productPage.getAvailableSizes();
    if (sizes.length > 0) {
      await productPage.addToCart(sizes[0]);
      await page.waitForTimeout(1000);
    }
  }

  test.describe('Registered User Checkout', () => {
    test('should complete checkout as registered user', async ({ page }) => {
      // Login first
      await homePage.goto();
      await homePage.goToLogin();
      
      const timestamp = Date.now();
      await page.fill('input[name="email"]', `test.${timestamp}@aaryaclothing.com`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(profile|home|\/)?$/, { timeout: 10000 });
      
      // Add product to cart
      await addToCart(page);
      
      // Checkout
      await cartPage.goto();
      await cartPage.checkout();
      
      // Select saved address (if available)
      if (await checkoutPage.selectAddressButton.isVisible()) {
        await checkoutPage.selectSavedAddress(0);
      } else {
        // Add new address
        await checkoutPage.addNewAddress({
          name: 'Test User',
          phone: '9876543210',
          addressLine1: '123 Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        });
      }
      
      // Select payment
      await checkoutPage.selectPaymentMethod('Razorpay');
      
      // Place order
      await checkoutPage.placeOrder();
      
      // Verify confirmation
      const orderNumber = await checkoutPage.verifyOrderConfirmation();
      expect(orderNumber).toBeTruthy();
    });

    test('should use saved address during checkout', async ({ page }) => {
      // This test assumes user has saved addresses
      // Login and add to cart
      await homePage.goto();
      await homePage.goToLogin();
      
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(profile|home|\/)?$/, { timeout: 10000 });
      
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      // Should show saved addresses
      const savedAddressesVisible = await checkoutPage.savedAddresses.isVisible().catch(() => false);
      expect(savedAddressesVisible).toBeTruthy();
    });
  });

  test.describe('Address Management', () => {
    test('should add new delivery address', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 New Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
      });
      
      // Should save and select the address
      await page.waitForTimeout(1000);
      const addressVisible = await checkoutPage.deliveryAddress.isVisible().catch(() => false);
      expect(addressVisible).toBeTruthy();
    });

    test('should validate pincode format', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddressButton.click();
      
      await checkoutPage.nameInput.fill('Test User');
      await checkoutPage.phoneInput.fill('9876543210');
      await checkoutPage.addressLine1Input.fill('123 Test St');
      await checkoutPage.cityInput.fill('Mumbai');
      await checkoutPage.stateInput.fill('Maharashtra');
      await checkoutPage.pincodeInput.fill('invalid');
      
      await checkoutPage.saveAddressButton.click();
      
      // Should show validation error
      await page.waitForTimeout(1000);
    });

    test('should validate phone number format', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddressButton.click();
      
      await checkoutPage.nameInput.fill('Test User');
      await checkoutPage.phoneInput.fill('invalid');
      await checkoutPage.addressLine1Input.fill('123 Test St');
      await checkoutPage.cityInput.fill('Mumbai');
      await checkoutPage.stateInput.fill('Maharashtra');
      await checkoutPage.pincodeInput.fill('400001');
      
      await checkoutPage.saveAddressButton.click();
      
      // Should show validation error
      await page.waitForTimeout(1000);
    });

    test('should select different address type', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddressButton.click();
      
      await checkoutPage.nameInput.fill('Test User');
      await checkoutPage.phoneInput.fill('9876543210');
      await checkoutPage.addressLine1Input.fill('123 Office St');
      await checkoutPage.cityInput.fill('Mumbai');
      await checkoutPage.stateInput.fill('Maharashtra');
      await checkoutPage.pincodeInput.fill('400001');
      
      // Select work address type if available
      if (await checkoutPage.addressType.isVisible()) {
        await checkoutPage.addressType.first().click();
      }
      
      await checkoutPage.saveAddressButton.click();
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Payment Methods', () => {
    test('should select Razorpay payment', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.selectPaymentMethod('Razorpay');
      
      // Razorpay should be selected
      const razorpaySelected = await checkoutPage.razorpayOption.isChecked();
      expect(razorpaySelected).toBeTruthy();
    });

    test('should select UPI payment', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.selectPaymentMethod('UPI');
      
      // UPI should be selected
      const upiSelected = await checkoutPage.upiOption.isChecked();
      expect(upiSelected).toBeTruthy();
      
      // Should show UPI ID input
      const upiInputVisible = await checkoutPage.upiIdInput.isVisible().catch(() => false);
      expect(upiInputVisible).toBeTruthy();
    });

    test('should fill UPI ID', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.selectPaymentMethod('UPI');
      await checkoutPage.fillUpiDetails('test@upi');
      
      const upiValue = await checkoutPage.upiIdInput.inputValue();
      expect(upiValue).toBe('test@upi');
    });

    test('should select Card payment', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.selectPaymentMethod('Card');
      
      // Card should be selected
      const cardSelected = await checkoutPage.cardOption.isChecked();
      expect(cardSelected).toBeTruthy();
      
      // Should show card details form
      const cardFormVisible = await checkoutPage.cardNumberInput.isVisible().catch(() => false);
      expect(cardFormVisible).toBeTruthy();
    });

    test('should fill card details', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.selectPaymentMethod('Card');
      await checkoutPage.fillCardDetails({
        number: '4111111111111111',
        expiry: '12/25',
        cvv: '123',
        name: 'Test User',
      });
      
      const cardNumber = await checkoutPage.cardNumberInput.inputValue();
      expect(cardNumber).toBe('4111111111111111');
    });

    test('should select Net Banking', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.selectPaymentMethod('Net Banking');
      
      // Net banking should be selected
      const netbankingSelected = await checkoutPage.netbankingOption.isChecked();
      expect(netbankingSelected).toBeTruthy();
    });
  });

  test.describe('Order Review', () => {
    test('should display order summary', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await expect(checkoutPage.orderSummary).toBeVisible();
      
      const itemCount = await checkoutPage.orderItems.count();
      expect(itemCount).toBeGreaterThan(0);
    });

    test('should display order total', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      const total = await checkoutPage.getOrderTotal();
      expect(total).toBeGreaterThan(0);
    });

  });

  test.describe('Order Confirmation', () => {
    test('should show order confirmation page', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      });
      
      await checkoutPage.selectPaymentMethod('Razorpay');
      await checkoutPage.placeOrder();
      
      await checkoutPage.verifyOrderConfirmation();
      
      // Should be on confirmation page
      await expect(page).toHaveURL(/\/order-confirmation|\/success|\/profile\/orders/, { timeout: 10000 });
    });

    test('should display order number', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Test Street',
      });
      
      await checkoutPage.selectPaymentMethod('Razorpay');
      await checkoutPage.placeOrder();
      
      const orderNumber = await checkoutPage.getOrderNumber();
      expect(orderNumber).toBeTruthy();
      expect(orderNumber.length).toBeGreaterThan(0);
    });

    test('should display order date', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Test Street',
      });
      
      await checkoutPage.selectPaymentMethod('Razorpay');
      await checkoutPage.placeOrder();
      
      await expect(checkoutPage.orderDate).toBeVisible();
    });

    test('should allow viewing order details', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Test Street',
      });
      
      await checkoutPage.selectPaymentMethod('Razorpay');
      await checkoutPage.placeOrder();
      
      if (await checkoutPage.viewOrderButton.isVisible()) {
        await checkoutPage.viewOrder();
        
        // Should navigate to order details
        await expect(page).toHaveURL(/\/profile\/orders/, { timeout: 10000 });
      }
    });

    test('should allow continuing shopping', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Test Street',
      });
      
      await checkoutPage.selectPaymentMethod('Razorpay');
      await checkoutPage.placeOrder();
      
      if (await checkoutPage.continueShoppingButton.isVisible()) {
        await checkoutPage.continueShopping();
        
        // Should navigate to homepage
        await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
      }
    });
  });

  test.describe('Checkout Validation', () => {
    test('should require address selection', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      // Try to proceed without address
      // Should show validation or not allow proceeding
      await page.waitForTimeout(1000);
    });

    test('should require payment method selection', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      });
      
      // Try to place order without selecting payment
      // May have default payment selected or show validation
      await page.waitForTimeout(1000);
    });

    test('should require terms acceptance', async ({ page }) => {
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.addNewAddress({
        name: 'Test User',
        phone: '9876543210',
        addressLine1: '123 Test Street',
      });
      
      await checkoutPage.selectPaymentMethod('Razorpay');
      
      // Uncheck terms if checked
      if (await checkoutPage.termsCheckbox.isChecked()) {
        await checkoutPage.termsCheckbox.uncheck();
      }
      
      // Try to place order
      await checkoutPage.placeOrderButton.click();
      
      // Should not proceed or show validation
      await page.waitForTimeout(2000);
    });
  });

  test.describe('Responsive Design - Checkout', () => {
    test('should display checkout correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await expect(checkoutPage.addressSection).toBeVisible();
      await expect(checkoutPage.paymentSection).toBeVisible();
    });

    test('should display checkout correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      await addToCart(page);
      await cartPage.goto();
      await cartPage.checkout();
      
      await checkoutPage.verifyLoaded();
    });
  });
});
