/**
 * Product Page Object Model
 * 
 * Handles product detail page interactions including:
 * - Product information display
 * - Image gallery
 * - Size selection
 * - Add to cart/wishlist
 * - Product reviews
 */
class ProductPage {
  constructor(page) {
    this.page = page;
    
    // Product information
    this.productTitle = page.locator('h1, .product-title, [data-testid="product-title"]');
    this.productPrice = page.locator('[class*="price"], .product-price, [data-testid="product-price"]');
    this.productDescription = page.locator('.product-description, [class*="description"], [data-testid="product-description"]');
    this.productSKU = page.locator('.sku, [data-testid="product-sku"]');
    
    // Product images
    this.mainImage = page.locator('.product-image img, .main-image img, [data-testid="main-image"]');
    this.imageGallery = page.locator('.image-gallery, .product-images, [class*="gallery"]');
    this.thumbnailImages = page.locator('.thumbnail, .gallery-thumb, [class*="thumb"]');
    this.imageNextButton = page.locator('button[aria-label*="next"], .image-next, .carousel-next');
    this.imagePrevButton = page.locator('button[aria-label*="previous"], .image-prev, .carousel-prev');
    this.imageZoom = page.locator('.zoom, .image-zoom, [class*="zoom"]');
    
    // Size selection
    this.sizeSelector = page.locator('.size-selector, [class*="size"], [data-testid="size-selector"]');
    this.sizeButtons = page.locator('.size-button, [class*="size-btn"], button[data-size]');
    this.sizeGuideLink = page.locator('a:has-text("Size Guide"), button:has-text("Size Guide"), .size-guide');
    this.sizeErrorMessage = page.locator('.size-error, text=Please select a size');
    
    // Quantity selector
    this.quantitySelector = page.locator('.quantity-selector, [class*="quantity"], [data-testid="quantity"]');
    this.quantityInput = page.locator('input[type="number"][name="quantity"], .quantity-input');
    this.quantityIncrease = page.locator('button[aria-label*="increase"], .quantity-up, button:has-text("+")');
    this.quantityDecrease = page.locator('button[aria-label*="decrease"], .quantity-down, button:has-text("-")');
    
    // Action buttons
    this.addToCartButton = page.locator('button:has-text("Add to Cart"), button:has-text("Add to Bag"), [data-testid="add-to-cart"]');
    this.addToWishlistButton = page.locator('button:has-text("Wishlist"), button:has-text("Heart"), [data-testid="add-to-wishlist"]');
    this.buyNowButton = page.locator('button:has-text("Buy Now"), [data-testid="buy-now"]');
    
    // Product variants
    this.colorSelector = page.locator('.color-selector, [class*="color"], [data-testid="color-selector"]');
    this.colorSwatches = page.locator('.color-swatch, [class*="color-btn"]');
    
    // Product details sections
    this.productDetails = page.locator('.product-details, [class*="details"]');
    this.productSpecifications = page.locator('.specifications, [class*="specs"]');
    this.productReviews = page.locator('.reviews, [class*="review"], [data-testid="reviews"]');
    this.reviewStars = page.locator('.stars, .rating, [class*="star"]');
    
    // Stock information
    this.stockStatus = page.locator('.stock-status, [class*="stock"], [data-testid="stock-status"]');
    this.outOfStockLabel = page.locator('text=Out of Stock, .out-of-stock');
    
    // Related products
    this.relatedProducts = page.locator('.related-products, [class*="related"], [class*="similar"]');
    this.relatedProductCards = page.locator('.related-product, [class*="similar-card"]');
    
    // Breadcrumbs
    this.breadcrumbs = page.locator('.breadcrumbs, [class*="breadcrumb"], nav[aria-label*="breadcrumb"]');
    
    // Share options
    this.shareButton = page.locator('button:has-text("Share"), .share-button, [data-testid="share"]');
  }

  /**
   * Navigate to product page
   */
  async goto(productId = '1') {
    await this.page.goto(`/products/${productId}`);
    await this.productTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get product title
   */
  async getProductTitle() {
    return await this.productTitle.textContent();
  }

  /**
   * Get product price
   */
  async getProductPrice() {
    const priceText = await this.productPrice.textContent();
    return priceText.replace(/[^0-9.]/g, '');
  }

  /**
   * Select product size
   */
  async selectSize(size) {
    const sizeButton = this.sizeButtons.filter({ hasText: size });
    await sizeButton.click();
    await sizeButton.waitFor({ state: 'pressed', timeout: 5000 });
  }

  /**
   * Select product color
   */
  async selectColor(color) {
    const colorSwatch = this.colorSwatches.filter({ hasText: color }).first();
    await colorSwatch.click();
  }

  /**
   * Set quantity
   */
  async setQuantity(quantity) {
    if (await this.quantityInput.isVisible()) {
      await this.quantityInput.fill(quantity.toString());
    } else {
      // Use increment/decrement buttons
      for (let i = 0; i < quantity - 1; i++) {
        await this.quantityIncrease.click();
      }
    }
  }

  /**
   * Add product to cart
   */
  async addToCart(size = null, quantity = 1) {
    if (size) {
      await this.selectSize(size);
    }
    
    if (quantity > 1) {
      await this.setQuantity(quantity);
    }
    
    await this.addToCartButton.click();
    
    // Wait for cart confirmation
    await this.page.waitForTimeout(1000);
  }

  /**
   * Add product to wishlist
   */
  async addToWishlist() {
    await this.addToWishlistButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Click buy now
   */
  async buyNow() {
    await this.buyNowButton.click();
    await this.page.waitForURL(/\/checkout/, { timeout: 10000 });
  }

  /**
   * Open size guide
   */
  async openSizeGuide() {
    await this.sizeGuideLink.click();
    // Wait for modal
    await this.page.waitForSelector('[role="dialog"], .modal, [class*="modal"]', { timeout: 5000 });
  }

  /**
   * Navigate through image gallery
   */
  async nextImage() {
    await this.imageNextButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Previous image
   */
  async previousImage() {
    await this.imagePrevButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Click thumbnail
   */
  async clickThumbnail(index = 0) {
    await this.thumbnailImages.nth(index).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get available sizes
   */
  async getAvailableSizes() {
    const sizes = [];
    const count = await this.sizeButtons.count();
    for (let i = 0; i < count; i++) {
      const size = await this.sizeButtons.nth(i).textContent();
      const disabled = await this.sizeButtons.nth(i).isDisabled();
      if (!disabled) {
        sizes.push(size.trim());
      }
    }
    return sizes;
  }

  /**
   * Check if product is in stock
   */
  async isInStock() {
    const outOfStock = await this.outOfStockLabel.isVisible().catch(() => false);
    return !outOfStock;
  }

  /**
   * Verify product loaded
   */
  async verifyLoaded() {
    await expect(this.productTitle).toBeVisible();
    await expect(this.productPrice).toBeVisible();
    await expect(this.mainImage).toBeVisible();
    await expect(this.addToCartButton).toBeVisible();
  }

  /**
   * Add review (if authenticated)
   */
  async addReview(rating, title, comment) {
    const reviewButton = this.page.locator('button:has-text("Write Review"), a:has-text("Write Review")');
    if (await reviewButton.isVisible()) {
      await reviewButton.click();
      
      // Fill review form
      const stars = this.page.locator('.star-rating button');
      await stars.nth(rating - 1).click();
      
      await this.page.fill('input[name="title"], #review-title', title);
      await this.page.fill('textarea[name="comment"], #review-comment', comment);
      
      const submitButton = this.page.locator('button[type="submit"], button:has-text("Submit Review")');
      await submitButton.click();
    }
  }
}

const expect = require('@playwright/test').expect;
module.exports = ProductPage;
