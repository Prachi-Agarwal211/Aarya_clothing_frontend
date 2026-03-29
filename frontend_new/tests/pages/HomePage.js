/**
 * Home Page Object Model
 * 
 * Represents the homepage of Aarya Clothing e-commerce platform
 */
class HomePage {
  constructor(page) {
    this.page = page;
    
    // Navigation elements
    this.logo = page.locator('a[href="/"], .logo, .navbar-brand');
    this.navMenu = page.locator('nav, .navbar, .navigation');
    this.searchInput = page.locator('input[type="search"], input[placeholder*="search" i], .search-input');
    this.searchButton = page.locator('button[type="submit"], .search-button, button:has(.search-icon)');
    this.cartIcon = page.locator('a[href="/cart"], .cart-icon, [data-testid="cart"]');
    this.wishlistIcon = page.locator('a[href*="wishlist"], .wishlist-icon, [data-testid="wishlist"]');
    this.profileIcon = page.locator('a[href*="profile"], .profile-icon, [data-testid="profile"]');
    this.loginLink = page.locator('a[href*="login"], a:has-text("Login"), a:has-text("Sign In")');
    
    // Menu items
    this.newArrivalsLink = page.locator('a[href*="new-arrivals"], a:has-text("New Arrivals")');
    this.collectionsLink = page.locator('a[href*="collections"], a:has-text("Collections")');
    this.aboutLink = page.locator('a[href*="about"], a:has-text("About")');
    
    // Homepage sections
    this.heroSection = page.locator('.hero, .banner, [class*="hero"], [class*="banner"]');
    this.featuredProducts = page.locator('[class*="featured"], [class*="product-grid"], .products-section');
    this.productCards = page.locator('[class*="product-card"], .product-item, [data-testid="product-card"]');
    
    // Mobile menu
    this.mobileMenuButton = page.locator('button[aria-label*="menu"], .menu-toggle, .hamburger');
    this.mobileMenu = page.locator('.mobile-menu, [class*="mobile-nav"]');
  }

  /**
   * Navigate to homepage
   */
  async goto() {
    await this.page.goto('/');
    await this.logo.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Search for products
   */
  async searchProducts(query) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForURL(/\/search|\/products/, { timeout: 10000 });
  }

  /**
   * Click on a product card
   */
  async clickProduct(index = 0) {
    await this.productCards.nth(index).click();
    await this.page.waitForURL(/\/products\/.*/, { timeout: 10000 });
  }

  /**
   * Navigate to cart
   */
  async goToCart() {
    await this.cartIcon.click();
    await this.page.waitForURL(/\/cart/, { timeout: 10000 });
  }

  /**
   * Navigate to wishlist
   */
  async goToWishlist() {
    await this.wishlistIcon.click();
    await this.page.waitForURL(/\/wishlist/, { timeout: 10000 });
  }

  /**
   * Navigate to login page
   */
  async goToLogin() {
    await this.loginLink.click();
    await this.page.waitForURL(/\/auth\/login/, { timeout: 10000 });
  }

  /**
   * Navigate to profile
   */
  async goToProfile() {
    await this.profileIcon.click();
    await this.page.waitForURL(/\/profile/, { timeout: 10000 });
  }

  /**
   * Navigate to new arrivals section on homepage
   */
  async goToNewArrivals() {
    await this.newArrivalsLink.click();
    // Should scroll to section on homepage, not navigate to separate page
    await this.page.waitForURL(/\/#new-arrivals$/, { timeout: 10000 });
  }

  /**
   * Open mobile menu
   */
  async openMobileMenu() {
    await this.mobileMenuButton.click();
    await this.mobileMenu.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get product count on homepage
   */
  async getProductCount() {
    return await this.productCards.count();
  }

  /**
   * Verify homepage loaded
   */
  async verifyLoaded() {
    await expect(this.logo).toBeVisible();
    await expect(this.navMenu).toBeVisible();
    await expect(this.heroSection).toBeVisible();
  }
}

// Import expect at the top level
const expect = require('@playwright/test').expect;

module.exports = HomePage;
