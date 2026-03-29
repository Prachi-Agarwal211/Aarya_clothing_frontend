/**
 * Login Page Object Model
 * 
 * Handles user authentication flows including:
 * - Email/Password login
 * - Phone OTP login
 * - Social login
 * - Password reset
 */
class LoginPage {
  constructor(page) {
    this.page = page;
    
    // Email login form
    this.emailInput = page.locator('input[name="email"], input[type="email"], #email');
    this.passwordInput = page.locator('input[name="password"], input[type="password"], #password');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    this.forgotPasswordLink = page.locator('a[href*="forgot-password"], a:has-text("Forgot Password")');
    
    // Phone OTP login
    this.phoneInput = page.locator('input[name="phone"], input[type="tel"], #phone');
    this.sendOtpButton = page.locator('button:has-text("Send OTP"), button:has-text("Get OTP")');
    this.otpInput = page.locator('input[name="otp"], input[placeholder*="OTP"], .otp-input');
    this.verifyOtpButton = page.locator('button:has-text("Verify"), button:has-text("Submit OTP")');
    
    // Social login
    this.googleLoginButton = page.locator('button:has-text("Google"), .google-login, [data-testid="google-login"]');
    this.facebookLoginButton = page.locator('button:has-text("Facebook"), .facebook-login, [data-testid="facebook-login"]');
    
    // Registration links
    this.registerLink = page.locator('a[href*="register"], a:has-text("Register"), a:has-text("Sign Up")');
    
    // Error messages
    this.errorMessage = page.locator('[class*="error"], .error-message, [role="alert"]');
    this.successMessage = page.locator('[class*="success"], .success-message');
    
    // Form validation
    this.emailError = page.locator('text=Invalid email, .email-error');
    this.passwordError = page.locator('text=Invalid password, .password-error');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto('/auth/login');
    await this.emailInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Login with email and password
   */
  async loginWithEmail(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /**
   * Login with phone OTP
   */
  async loginWithPhone(phone, otp) {
    await this.phoneInput.fill(phone);
    await this.sendOtpButton.click();
    
    // Wait for OTP input to appear
    await this.otpInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.otpInput.fill(otp);
    await this.verifyOtpButton.click();
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL(/\/forgot-password/, { timeout: 10000 });
  }

  /**
   * Login with Google (mock)
   */
  async loginWithGoogle() {
    await this.googleLoginButton.click();
    // In real tests, this would handle OAuth popup
  }

  /**
   * Navigate to registration
   */
  async goToRegistration() {
    await this.registerLink.click();
    await this.page.waitForURL(/\/register/, { timeout: 10000 });
  }

  /**
   * Get error message
   */
  async getErrorMessage() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
    return await this.errorMessage.textContent();
  }

  /**
   * Verify login successful
   */
  async verifyLoginSuccess() {
    await this.successMessage.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.waitForURL(/\/(profile|home)?$/, { timeout: 10000 });
  }

  /**
   * Verify login failed
   */
  async verifyLoginFailed() {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Verify form validation
   */
  async verifyValidation() {
    // Try to submit empty form
    await this.loginButton.click();
    
    // Check for validation errors
    const emailValid = await this.emailInput.getAttribute('aria-invalid');
    const passwordValid = await this.passwordInput.getAttribute('aria-invalid');
    
    return {
      emailRequired: emailValid === 'true' || await this.emailError.isVisible().catch(() => false),
      passwordRequired: passwordValid === 'true' || await this.passwordError.isVisible().catch(() => false),
    };
  }
}

const expect = require('@playwright/test').expect;
module.exports = LoginPage;
