/**
 * Email OTP & WhatsApp OTP Verification E2E Tests
 *
 * Test Suite: Verification Method Selection
 * Coverage:
 * - Email OTP registration flow
 * - WhatsApp OTP registration flow
 * - Verification method selector UI
 * - OTP verification for both methods
 * - Resend OTP for both methods
 */

import { test, expect } from '@playwright/test';
import RegistrationPage from '../pages/RegistrationPage';

test.describe('Verification Method Selection', () => {
  let registrationPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
  });

  test.describe('Verification Method Selector UI', () => {
    test('should display both Email OTP and WhatsApp OTP options', async ({ page }) => {
      // Both buttons should be visible
      await expect(registrationPage.emailOtpButton).toBeVisible();
      await expect(registrationPage.whatsappOtpButton).toBeVisible();
    });

    test('should have WhatsApp OTP selected by default', async ({ page }) => {
      // WhatsApp button should have active styling
      const whatsappButton = registrationPage.whatsappOtpButton;
      const isActive = await whatsappButton.evaluate(el => 
        el.classList.contains('border-[#F2C29A]/60') || 
        el.style.borderColor.includes('F2C29A')
      );
      expect(isActive).toBeTruthy();
    });

    test('should switch to Email OTP when clicked', async ({ page }) => {
      await registrationPage.selectVerificationMethod('email');
      
      // Email button should now be active
      const emailButton = registrationPage.emailOtpButton;
      const isActive = await emailButton.evaluate(el => 
        el.classList.contains('border-[#F2C29A]/60')
      );
      expect(isActive).toBeTruthy();
    });

    test('should switch to WhatsApp OTP when clicked', async ({ page }) => {
      // First select email, then switch back to whatsapp
      await registrationPage.selectVerificationMethod('email');
      await registrationPage.selectVerificationMethod('whatsapp');
      
      // WhatsApp button should be active
      const whatsappButton = registrationPage.whatsappOtpButton;
      const isActive = await whatsappButton.evaluate(el => 
        el.classList.contains('border-[#F2C29A]/60')
      );
      expect(isActive).toBeTruthy();
    });

    test('should show method-specific notice', async ({ page }) => {
      // WhatsApp notice
      const whatsappNotice = page.locator('text=WhatsApp number');
      await expect(whatsappNotice).toBeVisible();

      // Switch to Email
      await registrationPage.selectVerificationMethod('email');
      
      // Email notice should appear
      const emailNotice = page.locator('text=email address');
      await expect(emailNotice).toBeVisible();
    });
  });

  test.describe('Email OTP Registration Flow', () => {
    test('should register with Email OTP verification', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `test.email.${timestamp}@aaryaclothing.com`;
      
      // Select Email OTP
      await registrationPage.selectVerificationMethod('email');
      
      // Fill registration form
      await registrationPage.registerWithEmail(
        'Test',
        'Email User',
        testEmail,
        'TestPassword123!',
        '9876543210'
      );

      // Should show OTP verification step
      const otpInputsVisible = await registrationPage.otpDigitInputs.first().isVisible().catch(() => false);
      expect(otpInputsVisible).toBeTruthy();

      // Should show email in verification step
      const emailDisplay = page.locator(`text=${testEmail}`);
      await expect(emailDisplay).toBeVisible();

      // Should show "Verify Your Email" heading
      const emailHeading = page.locator('text=Verify Your Email');
      await expect(emailHeading).toBeVisible();
    });

    test('should show resend via Email option', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `test.resend.${timestamp}@aaryaclothing.com`;
      
      // Select Email OTP and register
      await registrationPage.selectVerificationMethod('email');
      await registrationPage.registerWithEmail(
        'Test',
        'Resend User',
        testEmail,
        'TestPassword123!',
        '9876543210'
      );

      // Wait for resend cooldown to expire (30 seconds)
      // In real test, you'd wait or mock the timer
      await page.waitForTimeout(31000);

      // Resend button should show "Resend via Email"
      const resendButton = page.locator('button:has-text("Resend via Email")');
      await expect(resendButton).toBeVisible();
    });
  });

  test.describe('WhatsApp OTP Registration Flow', () => {
    test('should register with WhatsApp OTP verification', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `test.whatsapp.${timestamp}@aaryaclothing.com`;
      const testPhone = '9876543210';
      
      // WhatsApp OTP should be selected by default, but explicitly select it
      await registrationPage.selectVerificationMethod('whatsapp');
      
      // Fill registration form
      await registrationPage.registerWithEmail(
        'Test',
        'WhatsApp User',
        testEmail,
        'TestPassword123!',
        testPhone
      );

      // Should show OTP verification step
      const otpInputsVisible = await registrationPage.otpDigitInputs.first().isVisible().catch(() => false);
      expect(otpInputsVisible).toBeTruthy();

      // Should show phone in verification step
      const phoneDisplay = page.locator(`text=${testPhone}`);
      await expect(phoneDisplay).toBeVisible();

      // Should show "Verify Your Phone Number" heading
      const phoneHeading = page.locator('text=Verify Your Phone Number');
      await expect(phoneHeading).toBeVisible();
    });

    test('should show resend via WhatsApp option', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `test.wa.resend.${timestamp}@aaryaclothing.com`;
      const testPhone = '9876543210';
      
      // Register with WhatsApp OTP
      await registrationPage.selectVerificationMethod('whatsapp');
      await registrationPage.registerWithEmail(
        'Test',
        'WA Resend User',
        testEmail,
        'TestPassword123!',
        testPhone
      );

      // Wait for resend cooldown to expire (30 seconds)
      await page.waitForTimeout(31000);

      // Resend button should show "Resend via WhatsApp"
      const resendButton = page.locator('button:has-text("Resend via WhatsApp")');
      await expect(resendButton).toBeVisible();
    });
  });

  test.describe('OTP Verification UI', () => {
    test('should display 6-digit OTP input boxes', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `test.otp.ui.${timestamp}@aaryaclothing.com`;
      
      await registrationPage.selectVerificationMethod('email');
      await registrationPage.registerWithEmail(
        'Test',
        'OTP UI User',
        testEmail,
        'TestPassword123!',
        '9876543210'
      );

      // Should have exactly 6 OTP input boxes
      const otpInputs = registrationPage.otpDigitInputs;
      const count = await otpInputs.count();
      expect(count).toBe(6);
    });

    test('should show countdown timer', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `test.timer.${timestamp}@aaryaclothing.com`;
      
      await registrationPage.selectVerificationMethod('email');
      await registrationPage.registerWithEmail(
        'Test',
        'Timer User',
        testEmail,
        'TestPassword123!',
        '9876543210'
      );

      // Timer should be visible
      const timer = page.locator('[class*="timer"], text=remaining');
      await expect(timer).toBeVisible();
    });

    test('should show correct icon for verification method', async ({ page }) => {
      const timestamp = Date.now();
      const testEmail = `test.icon.${timestamp}@aaryaclothing.com`;
      
      // Email OTP
      await registrationPage.selectVerificationMethod('email');
      await registrationPage.registerWithEmail(
        'Test',
        'Email Icon User',
        testEmail,
        'TestPassword123!',
        '9876543210'
      );

      // Should show mail icon in verification step
      const mailIcon = page.locator('[aria-label="mail"], svg:has(path)');
      await expect(mailIcon).toBeVisible();

      // Go back and try WhatsApp
      await page.goto('/auth/register');
      await registrationPage.selectVerificationMethod('whatsapp');
      await registrationPage.registerWithEmail(
        'Test',
        'WA Icon User',
        `test.wa.icon.${Date.now()}@aaryaclothing.com`,
        'TestPassword123!',
        '9876543210'
      );

      // Should show message/chat icon
      const messageIcon = page.locator('[aria-label="message-circle"], svg:has(path)');
      await expect(messageIcon).toBeVisible();
    });
  });

  test.describe('Method Switching During Registration', () => {
    test('should allow switching methods before submission', async ({ page }) => {
      // Fill form partially
      await registrationPage.firstNameInput.fill('Test');
      await registrationPage.lastNameInput.fill('User');
      await registrationPage.emailInput.fill(`test.switch.${Date.now()}@aaryaclothing.com');
      await registrationPage.phoneInput.fill('9876543210');
      await registrationPage.passwordInput.fill('TestPassword123!');
      await registrationPage.confirmPasswordInput.fill('TestPassword123!');
      await registrationPage.termsCheckbox.check();

      // Switch methods multiple times
      await registrationPage.selectVerificationMethod('email');
      await page.waitForTimeout(500);
      await registrationPage.selectVerificationMethod('whatsapp');
      await page.waitForTimeout(500);
      await registrationPage.selectVerificationMethod('email');

      // Should still be on registration form
      await expect(registrationPage.registerButton).toBeVisible();
    });
  });
});
