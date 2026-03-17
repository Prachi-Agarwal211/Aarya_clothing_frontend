/**
 * Registration Page Object Model
 * 
 * Handles user registration flows including:
 * - Email registration
 * - Phone registration
 * - OTP verification
 * - Email verification
 */
class RegistrationPage {
  constructor(page) {
    this.page = page;
    
    // Registration form fields
    this.firstNameInput = page.locator('input[name="firstName"], input[name="first_name"], #firstName');
    this.lastNameInput = page.locator('input[name="lastName"], input[name="last_name"], #lastName');
    this.emailInput = page.locator('input[name="email"], input[type="email"], #email');
    this.phoneInput = page.locator('input[name="phone"], input[type="tel"], #phone');
    this.passwordInput = page.locator('input[name="password"], input[type="password"], #password');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"], input[name="confirm_password"], #confirmPassword');
    
    // Terms and conditions
    this.termsCheckbox = page.locator('input[type="checkbox"], #terms, input[name="terms"]');
    this.termsLink = page.locator('a[href*="terms"], a:has-text("Terms")');
    
    // Submit button
    this.registerButton = page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign Up")');
    
    // OTP verification
    this.otpInput = page.locator('input[name="otp"], input[placeholder*="OTP"], .otp-input');
    this.verifyOtpButton = page.locator('button:has-text("Verify OTP"), button:has-text("Verify")');
    this.resendOtpLink = page.locator('a:has-text("Resend"), button:has-text("Resend OTP")');
    
    // Login link
    this.loginLink = page.locator('a[href*="login"], a:has-text("Login"), a:has-text("Sign In")');
    
    // Error messages
    this.errorMessage = page.locator('[class*="error"], .error-message, [role="alert"]');
    this.successMessage = page.locator('[class*="success"], .success-message');
    
    // Validation messages
    this.emailError = page.locator('text=Invalid email, .email-error');
    this.passwordError = page.locator('text=Password, .password-error');
    this.phoneError = page.locator('text=Invalid phone, .phone-error');
  }

  /**
   * Navigate to registration page
   */
  async goto() {
    await this.page.goto('/auth/register');
    await this.emailInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Register with email
   */
  async registerWithEmail(firstName, lastName, email, password, phone = null) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.emailInput.fill(email);
    
    if (phone) {
      await this.phoneInput.fill(phone);
    }
    
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    
    // Check terms
    await this.termsCheckbox.check();
    
    // Submit registration
    await this.registerButton.click();
  }

  /**
   * Verify OTP after registration
   */
  async verifyOTP(otp) {
    await this.otpInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.otpInput.fill(otp);
    await this.verifyOtpButton.click();
  }

  /**
   * Resend OTP
   */
  async resendOTP() {
    await this.resendOtpLink.click();
    await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get error message
   */
  async getErrorMessage() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.errorMessage.textContent();
  }

  /**
   * Verify registration success
   */
  async verifyRegistrationSuccess() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 10000 });
    // Should redirect to login or verification page
    await this.page.waitForURL(/\/(auth\/login|auth\/verify|profile)/, { timeout: 10000 });
  }

  /**
   * Verify email already exists error
   */
  async verifyEmailExistsError() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    const message = await this.errorMessage.textContent();
    return message.toLowerCase().includes('already') || message.toLowerCase().includes('exists');
  }

  /**
   * Navigate to login
   */
  async goToLogin() {
    await this.loginLink.click();
    await this.page.waitForURL(/\/login/, { timeout: 10000 });
  }

  /**
   * View terms and conditions
   */
  async viewTerms() {
    await this.termsLink.click();
    const newPage = await this.page.context().waitForEvent('page');
    await newPage.waitForLoadState();
    return newPage;
  }

  /**
   * Test password validation
   */
  async verifyPasswordValidation() {
    // Weak password test
    await this.passwordInput.fill('weak');
    await this.confirmPasswordInput.fill('weak');
    await this.registerButton.click();
    
    const passwordErrorVisible = await this.passwordError.isVisible().catch(() => false);
    return passwordErrorVisible;
  }

  /**
   * Test password mismatch
   */
  async verifyPasswordMismatch() {
    await this.passwordInput.fill('Password123!');
    await this.confirmPasswordInput.fill('Different123!');
    await this.registerButton.click();
    
    const mismatchError = await this.errorMessage.isVisible().catch(() => false);
    return mismatchError;
  }
}

const expect = require('@playwright/test').expect;
module.exports = RegistrationPage;
