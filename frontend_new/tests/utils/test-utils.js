/**
 * Test Utilities
 * 
 * Common utility functions for E2E tests
 */

const { expect } = require('@playwright/test');

/**
 * Generate random email address
 */
function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test.${timestamp}.${random}@aaryaclothing.com`;
}

/**
 * Generate random phone number
 */
function generateRandomPhone() {
  return '9' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
}

/**
 * Generate random order number
 */
function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
}

/**
 * Wait for network to be idle
 */
async function waitForNetworkIdle(page, timeout = 30000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Take screenshot with timestamp
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-results/screenshots/${name}-${timestamp}.png`;
  await page.screenshot({ path: filename });
  return filename;
}

/**
 * Verify element is visible
 */
async function expectVisible(locator, timeout = 5000) {
  await locator.waitFor({ state: 'visible', timeout });
  await expect(locator).toBeVisible();
}

/**
 * Verify element is hidden
 */
async function expectHidden(locator, timeout = 5000) {
  await locator.waitFor({ state: 'hidden', timeout });
  await expect(locator).not.toBeVisible();
}

/**
 * Click element with retry
 */
async function clickWithRetry(locator, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await locator.click();
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Fill input with retry
 */
async function fillWithRetry(locator, value, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await locator.fill(value);
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Get text content safely
 */
async function getTextSafe(locator) {
  try {
    return await locator.textContent();
  } catch {
    return '';
  }
}

/**
 * Check if element exists
 */
async function elementExists(locator) {
  try {
    await locator.waitFor({ state: 'attached', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for URL to contain string
 */
async function waitForURL(page, expected, timeout = 10000) {
  await page.waitForURL(expected, { timeout });
}

/**
 * Mock API response
 */
async function mockAPIResponse(page, url, response) {
  await page.route(url, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(response),
  }));
}

/**
 * Mock API error
 */
async function mockAPIError(page, url, status = 500, message = 'Internal Server Error') {
  await page.route(url, route => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ error: message }),
  }));
}

/**
 * Upload file
 */
async function uploadFile(locator, filePath) {
  await locator.setInputFiles(filePath);
}

/**
 * Download file and verify
 */
async function downloadAndVerify(page, clickAction, filenamePattern) {
  const downloadPromise = page.waitForEvent('download');
  await clickAction();
  const download = await downloadPromise;
  
  const filename = download.suggestedFilename();
  expect(filename).toMatch(filenamePattern);
  
  return download;
}

/**
 * Handle dialog
 */
async function handleDialog(page, accept = true, promptText = '') {
  page.on('dialog', async dialog => {
    if (promptText) {
      await dialog.accept(promptText);
    } else {
      await dialog.accept(accept);
    }
  });
}

/**
 * Wait for toast/notification
 */
async function waitForToast(page, message, timeout = 5000) {
  const toast = page.locator(`text=${message}, [class*="toast"], [class*="notification"]`);
  await toast.waitFor({ state: 'visible', timeout });
  return toast;
}

/**
 * Verify toast message
 */
async function verifyToast(page, message, timeout = 5000) {
  const toast = await waitForToast(page, message, timeout);
  await expect(toast.first()).toBeVisible();
}

/**
 * Scroll to element
 */
async function scrollToElement(locator) {
  await locator.scrollIntoViewIfNeeded();
}

/**
 * Get attribute value
 */
async function getAttribute(locator, attribute) {
  try {
    return await locator.getAttribute(attribute);
  } catch {
    return null;
  }
}

/**
 * Verify attribute value
 */
async function verifyAttribute(locator, attribute, expectedValue) {
  const value = await getAttribute(locator, attribute);
  expect(value).toBe(expectedValue);
}

/**
 * Wait for animation to complete
 */
async function waitForAnimation(page, duration = 500) {
  await page.waitForTimeout(duration);
}

/**
 * Retry function with delay
 */
async function retry(fn, retries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Format currency
 */
function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Parse currency string to number
 */
function parseCurrency(str) {
  return parseFloat(str.replace(/[^0-9.]/g, ''));
}

/**
 * Wait for element to be enabled
 */
async function waitForEnabled(locator, timeout = 5000) {
  await locator.waitFor({ state: 'enabled', timeout });
}

/**
 * Wait for element to be disabled
 */
async function waitForDisabled(locator, timeout = 5000) {
  await locator.waitFor({ state: 'disabled', timeout });
}

module.exports = {
  generateRandomEmail,
  generateRandomPhone,
  generateOrderNumber,
  waitForNetworkIdle,
  takeScreenshot,
  expectVisible,
  expectHidden,
  clickWithRetry,
  fillWithRetry,
  getTextSafe,
  elementExists,
  waitForURL,
  mockAPIResponse,
  mockAPIError,
  uploadFile,
  downloadAndVerify,
  handleDialog,
  waitForToast,
  verifyToast,
  scrollToElement,
  getAttribute,
  verifyAttribute,
  waitForAnimation,
  retry,
  formatCurrency,
  parseCurrency,
  waitForEnabled,
  waitForDisabled,
};
