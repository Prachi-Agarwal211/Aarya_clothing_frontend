# Aarya Clothing - Playwright E2E Test Suite

Comprehensive End-to-End test suite for the Aarya Clothing e-commerce platform using Playwright.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Coverage](#test-coverage)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Page Object Model](#page-object-model)
- [Fixtures](#fixtures)
- [Test Data](#test-data)
- [CI/CD](#cicd)
- [Reporting](#reporting)
- [Debugging](#debugging)
- [Best Practices](#best-practices)

## 🎯 Overview

This test suite provides comprehensive E2E testing for all critical user flows on the Aarya Clothing platform, including:

- **Customer Flows**: Registration, login, browsing, cart, checkout, orders, returns
- **Admin Flows**: Dashboard, product management, order management, staff management
- **Responsive Testing**: Mobile, tablet, and desktop viewports
- **Cross-browser Testing**: Chrome, Firefox, Safari

## 📊 Test Coverage

### Customer Flows (10 Test Suites)

1. **Authentication** (`01-auth.spec.js`)
   - Email registration with OTP
   - Phone OTP login
   - Password reset
   - Social login
   - Session management

2. **Product Browsing** (`02-product-browsing.spec.js`)
   - Search with filters
   - Category navigation
   - Product details
   - Image gallery
   - Size selection
   - Wishlist

3. **Shopping Cart** (`03-shopping-cart.spec.js`)
   - Add/remove items
   - Update quantity
   - Cart persistence
   - Coupon application

4. **Checkout** (`04-checkout.spec.js`)
   - Guest checkout
   - Registered user checkout
   - Address management
   - Payment methods (COD, UPI, Card)
   - Order confirmation

5. **Order Management** (`05-order-management.spec.js`)
   - Order history
   - Order tracking
   - Invoice download
   - Return requests

6. **Profile Management** (`06-profile-management.spec.js`)
   - Update profile
   - Change password
   - Address management
   - Notification preferences
   - Wishlist

7. **AI Chatbot** (`07-ai-chatbot.spec.js`)
   - Product search via chat
   - Order status queries
   - FAQ questions

### Admin Flows (5 Test Suites)

1. **Admin Dashboard** (`01-admin-dashboard.spec.js`)
   - Admin login
   - Role-based access
   - Dashboard widgets
   - Navigation
   - AI assistant

2. **Product Management** (`02-admin-products.spec.js`)
   - Create/Edit/Delete products
   - Bulk operations
   - Search and filter
   - Inventory management

3. **Order Management** (`03-admin-orders.spec.js`)
   - View all orders
   - Update order status
   - Process returns
   - Invoice management

4. **Customers & Coupons** (`04-admin-customers-coupons.spec.js`)
   - Customer management
   - Coupon CRUD operations

5. **Inventory & Staff** (`05-admin-inventory-staff.spec.js`)
   - Stock management
   - Low stock alerts
   - Staff account management
   - Audit logs

## 🔧 Prerequisites

- Node.js 18+ 
- npm or yarn
- Playwright (installed automatically)
- Modern web browser (Chrome, Firefox, or Safari)

## 📦 Installation

1. **Install dependencies:**

```bash
cd frontend_new
npm install
```

2. **Install Playwright browsers:**

```bash
npx playwright install
```

3. **Install system dependencies (Linux only):**

```bash
npx playwright install-deps
```

## ⚙️ Configuration

The Playwright configuration is located in `playwright.config.js`:

```javascript
{
  testDir: './tests',
  timeout: 120000,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: 'http://localhost:6004',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', ... },
    { name: 'firefox', ... },
    { name: 'webkit', ... },
    { name: 'Mobile Chrome', ... },
    { name: 'Mobile Safari', ... },
    { name: 'iPad', ... },
  ],
}
```

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in headed mode (visible browser)
npm run test:headed

# Run tests with UI mode
npm run test:ui

# Run tests in debug mode
npm run test:debug
```

### By Browser

```bash
# Run on Chromium only
npm run test:chromium

# Run on Firefox only
npm run test:firefox

# Run on WebKit only
npm run test:webkit
```

### By Test Suite

```bash
# Run customer flow tests
npm run test:customer

# Run admin flow tests
npm run test:admin

# Run mobile tests only
npm run test:mobile

# Run specific test file
npx playwright test tests/e2e/customer/01-auth.spec.js

# Run tests matching pattern
npx playwright test -g "login"
```

### With Options

```bash
# Run with specific project
npx playwright test --project=chromium

# Run with retries
npx playwright test --retries=3

# Run in parallel
npx playwright test --workers=4

# Run specific test by line number
npx playwright test tests/e2e/customer/01-auth.spec.js:10
```

## 📁 Test Structure

```
tests/
├── e2e/
│   ├── customer/           # Customer flow tests
│   │   ├── 01-auth.spec.js
│   │   ├── 02-product-browsing.spec.js
│   │   ├── 03-shopping-cart.spec.js
│   │   ├── 04-checkout.spec.js
│   │   ├── 05-order-management.spec.js
│   │   ├── 06-profile-management.spec.js
│   │   └── 07-ai-chatbot.spec.js
│   ├── admin/              # Admin flow tests
│   │   ├── 01-admin-dashboard.spec.js
│   │   ├── 02-admin-products.spec.js
│   │   ├── 03-admin-orders.spec.js
│   │   ├── 04-admin-customers-coupons.spec.js
│   │   └── 05-admin-inventory-staff.spec.js
│   └── api/                # API tests (future)
├── fixtures/               # Test fixtures
│   └── fixtures.js
├── pages/                  # Page Object Models
│   ├── HomePage.js
│   ├── LoginPage.js
│   ├── ProductPage.js
│   ├── CartPage.js
│   ├── CheckoutPage.js
│   ├── OrdersPage.js
│   ├── AdminDashboard.js
│   ├── AdminProducts.js
│   └── AdminOrders.js
├── utils/                  # Utility functions
│   ├── seed-test-data.js
│   └── test-utils.js
├── data/                   # Test data
│   └── test-data.json
├── global-setup.js         # Global test setup
└── global-teardown.js      # Global test cleanup
```

## 🧩 Page Object Model

Page Objects provide a clean abstraction for interacting with pages:

```javascript
// Example: Using LoginPage
import LoginPage from '../pages/LoginPage';

test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await loginPage.goto();
  await loginPage.loginWithEmail('test@example.com', 'Password123!');
  await loginPage.verifyLoginSuccess();
});
```

### Available Page Objects

- `HomePage` - Homepage navigation and search
- `LoginPage` - Authentication flows
- `RegistrationPage` - User registration
- `ProductPage` - Product details and interactions
- `CartPage` - Shopping cart operations
- `CheckoutPage` - Checkout flow
- `OrdersPage` - Order history and tracking
- `AdminDashboard` - Admin dashboard
- `AdminProducts` - Product management
- `AdminOrders` - Order management

## 🔧 Fixtures

Custom fixtures extend Playwright's test functionality:

```javascript
import { test, expect } from '../fixtures/fixtures';

test('should work with authenticated user', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in
  await authenticatedPage.goto('/profile');
});

test('should work with admin', async ({ adminPage }) => {
  // adminPage is logged in as admin
  await adminPage.goto('/admin/products');
});
```

### Available Fixtures

- `authenticatedPage` - Logged-in customer
- `adminPage` - Logged-in admin
- `staffPage` - Logged-in staff
- `cartWithItems` - Cart with products added
- `mobilePage` - Mobile viewport
- `tabletPage` - Tablet viewport
- `desktopPage` - Desktop viewport

## 📊 Test Data

Test data is seeded before test execution:

```bash
# Seed test data
npm run test:seed

# Clear test data
npm run test:clear
```

### Test Credentials

After seeding, check the console output for test credentials or view `tests/data/test-data.json`.

## 🔄 CI/CD

Tests run automatically on:

- Push to `main`, `develop`, `staging` branches
- Pull requests
- Manual trigger via GitHub Actions

### GitHub Actions Workflow

The workflow (`.github/workflows/playwright-tests.yml`) includes:

- Parallel test execution (sharding)
- Multi-browser testing
- Mobile testing
- Admin testing
- Test report generation
- Artifact upload
- Slack notifications

### Manual Trigger

```yaml
# In GitHub Actions, click "Run workflow"
# Select environment: staging or production
```

## 📈 Reporting

### HTML Report

```bash
# Generate and open HTML report
npx playwright show-report
```

### JSON Report

Location: `test-results/results.json`

### JUnit Report

Location: `test-results/junit.xml`

### Screenshots & Videos

- Screenshots: `test-results/` (on failure)
- Videos: `test-results/` (on failure)
- Traces: Available on retry

## 🐛 Debugging

### Debug Mode

```bash
npx playwright test --debug
```

### UI Mode

```bash
npx playwright test --ui
```

### Headed Mode

```bash
npx playwright test --headed
```

### Trace Viewer

```bash
# View trace from failed test
npx playwright show-trace test-results/trace.zip
```

### VS Code Extension

Install the [Playwright Test for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) extension for:
- Run tests directly from editor
- Debug tests with breakpoints
- View test results inline

## ✨ Best Practices

### 1. Test Isolation

Each test should be independent and not rely on other tests:

```javascript
test.beforeEach(async ({ page }) => {
  // Setup fresh state for each test
  await page.goto('/');
});
```

### 2. Use Page Objects

Encapsulate page interactions:

```javascript
// ✅ Good
await productPage.addToCart('M');

// ❌ Bad
await page.click('button[data-testid="add-to-cart"]');
```

### 3. Use Data Test IDs

Add `data-testid` attributes to elements:

```jsx
<button data-testid="add-to-cart">Add to Cart</button>
```

### 4. Wait for Network Idle

```javascript
await page.waitForLoadState('networkidle');
```

### 5. Use Assertions

```javascript
await expect(locator).toBeVisible();
await expect(locator).toHaveText('Expected Text');
```

### 6. Handle Flakiness

```javascript
test('should handle flaky element', async ({ page }) => {
  await retry(async () => {
    await page.click('button');
  }, 3);
});
```

### 7. Clean Up

```javascript
test.afterEach(async ({ page }) => {
  // Clean up after test
  await page.context().clearCookies();
});
```

## 📝 Writing New Tests

### Test Template

```javascript
/**
 * Test Suite Description
 */

import { test, expect } from '@playwright/test';
import YourPageObject from '../../pages/YourPageObject';

test.describe('Feature Name', () => {
  let pageObject;

  test.beforeEach(async ({ page }) => {
    pageObject = new YourPageObject(page);
    await pageObject.goto();
  });

  test('should do something', async ({ page }) => {
    // Arrange
    // Act
    // Assert
    await expect(something).toBeVisible();
  });
});
```

## 🔐 Security Notes

- Never commit real credentials
- Use environment variables for sensitive data
- Test data is automatically cleaned up
- API keys should be stored in GitHub Secrets

## 📞 Support

For issues or questions:
- Check existing issues in the repository
- Review Playwright documentation: https://playwright.dev
- Contact the QA team

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright API Reference](https://playwright.dev/docs/api/class-test)
- [Test Examples](https://playwright.dev/docs/test-intro)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

**Last Updated**: March 2026  
**Maintained by**: Aarya Clothing QA Team
