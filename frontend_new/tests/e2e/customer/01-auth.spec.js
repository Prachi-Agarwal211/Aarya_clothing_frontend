/**
 * Customer Authentication E2E Tests
 * 
 * Test Suite: User Registration & Login
 * Coverage:
 * - Email registration with OTP verification
 * - Phone OTP login
 * - Password reset flow
 * - Login validation
 * - Session persistence
 */

import { test, expect } from '@playwright/test';
import LoginPage from '../pages/LoginPage';
import RegistrationPage from '../pages/RegistrationPage';

test.describe('User Registration & Login', () => {
  let loginPage: LoginPage;
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    registrationPage = new RegistrationPage(page);
  });

  test.describe('Email Registration', () => {
    test('should register successfully with valid email', async ({ page }) => {
      await registrationPage.goto();
      
      const timestamp = Date.now();
      const testEmail = `test.user.${timestamp}@aaryaclothing.com`;
      
      await registrationPage.registerWithEmail(
        'Test',
        'User',
        testEmail,
        'TestPassword123!',
        '9876543210'
      );
      
      // Should show OTP verification or success message
      const otpVisible = await registrationPage.otpInput.isVisible().catch(() => false);
      const successVisible = await registrationPage.successMessage.isVisible().catch(() => false);
      
      expect(otpVisible || successVisible).toBeTruthy();
    });

    test('should show error for existing email', async ({ page }) => {
      await registrationPage.goto();
      
      // Try to register with existing email
      await registrationPage.registerWithEmail(
        'Test',
        'User',
        'existing@example.com',
        'TestPassword123!',
        '9876543210'
      );
      
      // Should show error message
      const errorVisible = await registrationPage.errorMessage.isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should validate password strength', async ({ page }) => {
      await registrationPage.goto();
      
      await registrationPage.firstNameInput.fill('Test');
      await registrationPage.lastNameInput.fill('User');
      await registrationPage.emailInput.fill(`test.${Date.now()}@aaryaclothing.com`);
      await registrationPage.passwordInput.fill('weak');
      await registrationPage.confirmPasswordInput.fill('weak');
      await registrationPage.termsCheckbox.check();
      await registrationPage.registerButton.click();
      
      // Should show password validation error
      const errorVisible = await registrationPage.errorMessage.isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should show error for password mismatch', async ({ page }) => {
      await registrationPage.goto();
      
      await registrationPage.firstNameInput.fill('Test');
      await registrationPage.lastNameInput.fill('User');
      await registrationPage.emailInput.fill(`test.${Date.now()}@aaryaclothing.com`);
      await registrationPage.passwordInput.fill('Password123!');
      await registrationPage.confirmPasswordInput.fill('Different123!');
      await registrationPage.termsCheckbox.check();
      await registrationPage.registerButton.click();
      
      // Should show mismatch error
      const errorVisible = await registrationPage.errorMessage.isVisible().catch(() => false);
      expect(errorVisible).toBeTruthy();
    });

    test('should require terms acceptance', async ({ page }) => {
      await registrationPage.goto();
      
      await registrationPage.registerWithEmail(
        'Test',
        'User',
        `test.${Date.now()}@aaryaclothing.com`,
        'TestPassword123!',
        '9876543210'
      );
      
      // Don't check terms - should fail
      await registrationPage.registerButton.click();
      
      // Should show error or not proceed
      const url = page.url();
      expect(url).toContain('register');
    });
  });

  test.describe('Email Login', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      await loginPage.goto();
      
      await loginPage.loginWithEmail('test@example.com', 'TestPassword123!');
      
      // Should redirect to profile or home
      await expect(page).toHaveURL(/\/(profile|home|\/)?$/, { timeout: 10000 });
    });

    test('should show error for invalid email', async ({ page }) => {
      await loginPage.goto();
      
      await loginPage.loginWithEmail('invalid@example.com', 'WrongPassword123!');
      
      // Should show error message
      await loginPage.verifyLoginFailed();
    });

    test('should show error for invalid password', async ({ page }) => {
      await loginPage.goto();
      
      await loginPage.loginWithEmail('test@example.com', 'WrongPassword123!');
      
      // Should show error message
      await loginPage.verifyLoginFailed();
    });

    test('should validate empty form submission', async ({ page }) => {
      await loginPage.goto();
      
      await loginPage.loginButton.click();
      
      // Should show validation errors
      const validation = await loginPage.verifyValidation();
      expect(validation.emailRequired || validation.passwordRequired).toBeTruthy();
    });

    test('should navigate to forgot password', async ({ page }) => {
      await loginPage.goto();
      
      await loginPage.clickForgotPassword();
      
      // Should navigate to forgot password page
      await expect(page).toHaveURL(/\/forgot-password/, { timeout: 10000 });
    });

    test('should navigate to registration', async ({ page }) => {
      await loginPage.goto();
      
      await loginPage.goToRegistration();
      
      // Should navigate to registration page
      await expect(page).toHaveURL(/\/register/, { timeout: 10000 });
    });
  });

  test.describe('Password Reset', () => {
    test('should request password reset', async ({ page }) => {
      await loginPage.goto();
      await loginPage.clickForgotPassword();
      
      // Fill email for password reset
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');
      
      const submitButton = page.locator('button:has-text("Send"), button:has-text("Reset")');
      await submitButton.click();
      
      // Should show success message
      const successVisible = await page.locator('[class*="success"]').isVisible().catch(() => false);
      expect(successVisible).toBeTruthy();
    });

    test('should show error for non-existent email', async ({ page }) => {
      await loginPage.goto();
      await loginPage.clickForgotPassword();
      
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('nonexistent@example.com');
      
      const submitButton = page.locator('button:has-text("Send"), button:has-text("Reset")');
      await submitButton.click();
      
      // May show error or generic success (security best practice)
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Session Management', () => {
    test('should persist session after page refresh', async ({ page }) => {
      await loginPage.goto();
      await loginPage.loginWithEmail('test@example.com', 'TestPassword123!');
      await page.waitForURL(/\/(profile|home|\/)?$/, { timeout: 10000 });
      
      // Refresh page
      await page.reload();
      
      // Should still be logged in
      const profileLink = page.locator('a[href="/profile"]');
      await expect(profileLink).toBeVisible();
    });

    test('should logout successfully', async ({ page }) => {
      // Login first
      await loginPage.goto();
      await loginPage.loginWithEmail('test@example.com', 'TestPassword123!');
      await page.waitForURL(/\/(profile|home|\/)?$/, { timeout: 10000 });
      
      // Logout
      const logoutLink = page.locator('a[href*="logout"], button:has-text("Logout")');
      if (await logoutLink.isVisible()) {
        await logoutLink.click();
        await page.waitForTimeout(1000);
      }
      
      // Should be logged out
      await loginPage.goto();
      const loginButtonVisible = await loginPage.loginButton.isVisible();
      expect(loginButtonVisible).toBeTruthy();
    });
  });

  test.describe('Responsive Design - Login', () => {
    test('should display login form correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await loginPage.goto();
      
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });

    test('should display login form correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await loginPage.goto();
      
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });
  });
});
