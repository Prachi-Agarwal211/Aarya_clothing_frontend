/**
 * Image Loading & Architecture Tests
 * 
 * Tests verify the correct image architecture:
 * 1. All dynamic images come from R2 via backend API
 * 2. Local /public only contains static assets (logo, placeholders, noise)
 * 3. Images load correctly without 404 errors
 * 4. No console errors related to images
 */

import { test, expect } from '@playwright/test';

test.describe('Image Architecture', () => {
  test('homepage loads with images from R2', async ({ page }) => {
    // Track all image requests
    const imageRequests = [];
    const failedRequests = [];

    page.on('request', request => {
      const url = request.url();
      if (url.match(/\.(jpg|jpeg|png|gif|webp|avif)/i) || url.includes('/cdn-cgi/image/')) {
        imageRequests.push(url);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.match(/\.(jpg|jpeg|png|gif|webp|avif)/i) || url.includes('/cdn-cgi/image/')) {
        if (!response.ok()) {
          failedRequests.push(`${url} - Status: ${response.status()}`);
        }
      }
    });

    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for images to load
    await page.waitForTimeout(2000);

    // Verify no failed image requests
    expect(failedRequests).toHaveLength(0);

    // Verify images are from R2 or Cloudflare CDN
    const r2Images = imageRequests.filter(url => 
      url.includes('r2.dev') || url.includes('/cdn-cgi/image/')
    );
    
    // Should have at least some R2 images (hero, collections, etc.)
    expect(r2Images.length).toBeGreaterThan(0);

    console.log(`✅ Loaded ${imageRequests.length} images, ${r2Images.length} from R2/CDN`);
  });

  test('hero section images load correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check hero section exists
    const heroSection = page.locator('section').filter({ hasText: /hero|welcome|discover/i }).first();
    await expect(heroSection).toBeVisible();

    // Check hero images have valid src
    const heroImages = heroSection.locator('img');
    const count = await heroImages.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const img = heroImages.nth(i);
        const src = await img.getAttribute('src');
        expect(src).toBeTruthy();
        // Should be from R2 or CDN
        expect(src).toMatch(/r2\.dev|cdn-cgi|placeholder/);
      }
    }
  });

  test('collections section images load from R2', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find collections section
    const collectionsSection = page.locator('section').filter({ hasText: /collection/i }).first();
    await expect(collectionsSection).toBeVisible();

    // Check collection images
    const collectionImages = collectionsSection.locator('img');
    const count = await collectionImages.count();

    for (let i = 0; i < count; i++) {
      const img = collectionImages.nth(i);
      await expect(img).toBeVisible();
      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
    }
  });

  test('new arrivals product images load correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find new arrivals section
    const newArrivalsSection = page.locator('section').filter({ hasText: /new arrival/i }).first();
    await expect(newArrivalsSection).toBeVisible();

    // Check product images
    const productImages = newArrivalsSection.locator('img');
    const count = await productImages.count();

    for (let i = 0; i < count; i++) {
      const img = productImages.nth(i);
      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
    }
  });

  test('no console errors on homepage', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Filter out expected errors (none expected)
    const unexpectedErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('404')
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test('placeholder images exist in /public', async ({ page }) => {
    // Verify placeholder images are accessible
    const placeholderResponse = await page.request.get('/placeholder-image.jpg');
    expect(placeholderResponse.ok()).toBeTruthy();

    const placeholderCollectionResponse = await page.request.get('/placeholder-collection.jpg');
    expect(placeholderCollectionResponse.ok()).toBeTruthy();

    const logoResponse = await page.request.get('/logo.png');
    expect(logoResponse.ok()).toBeTruthy();
  });

  test('dynamic image folders should NOT exist in /public', async ({ page }) => {
    // These folders should be removed - images come from R2
    const collectionsResponse = await page.request.get('/collections/collection1.jpeg');
    expect(collectionsResponse.status()).toBe(404);

    const productsResponse = await page.request.get('/products/product1.jpeg');
    expect(productsResponse.status()).toBe(404);

    const heroResponse = await page.request.get('/hero/hero1.png');
    expect(heroResponse.status()).toBe(404);

    const aboutResponse = await page.request.get('/about/kurti1.jpg');
    expect(aboutResponse.status()).toBe(404);
  });
});

test.describe('Navigation & Button Underlines', () => {
  test('navigation links have NO underlines', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find all navigation links
    const navLinks = page.locator('nav a, header a, [data-nav] a, .nav-link, .header-link');
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i);
      await expect(link).toBeVisible();
      
      // Check computed style for text-decoration
      const textDecoration = await link.evaluate(el => 
        window.getComputedStyle(el).textDecoration
      );
      
      // Should be 'none' or not include 'underline'
      expect(textDecoration).not.toContain('underline');
    }
  });

  test('button elements have NO underlines', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find all buttons
    const buttons = page.locator('button, a[role="button"], .btn, [class*="button"]');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      await expect(button).toBeVisible();
      
      // Check computed style for text-decoration
      const textDecoration = await button.evaluate(el => 
        window.getComputedStyle(el).textDecoration
      );
      
      // Should be 'none' or not include 'underline'
      expect(textDecoration).not.toContain('underline');
    }
  });

  test('hover state does NOT add underlines to nav/buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find a navigation link
    const navLink = page.locator('nav a, header a, .nav-link').first();
    await expect(navLink).toBeVisible();

    // Hover over the link
    await navLink.hover();

    // Check computed style on hover
    const textDecoration = await navLink.evaluate(el => 
      window.getComputedStyle(el).textDecoration
    );
    
    expect(textDecoration).not.toContain('underline');

    // Find a button
    const button = page.locator('button, .btn').first();
    await expect(button).toBeVisible();

    // Hover over the button
    await button.hover();

    // Check computed style on hover
    const buttonTextDecoration = await button.evaluate(el => 
      window.getComputedStyle(el).textDecoration
    );
    
    expect(buttonTextDecoration).not.toContain('underline');
  });

  test('product cards have NO underlines', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find product cards
    const productCards = page.locator('[class*="product-card"], [class*="ProductCard"]');
    const count = await productCards.count();

    if (count > 0) {
      const firstCard = productCards.first();
      const links = firstCard.locator('a');
      const linkCount = await links.count();

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        const textDecoration = await link.evaluate(el => 
          window.getComputedStyle(el).textDecoration
        );
        expect(textDecoration).not.toContain('underline');
      }
    }
  });

  test('collection cards have NO underlines', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find collection cards
    const collectionCards = page.locator('[class*="category-card"], [class*="CategoryCard"], [class*="collection"]');
    const count = await collectionCards.count();

    if (count > 0) {
      const firstCard = collectionCards.first();
      const links = firstCard.locator('a');
      const linkCount = await links.count();

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        const textDecoration = await link.evaluate(el => 
          window.getComputedStyle(el).textDecoration
        );
        expect(textDecoration).not.toContain('underline');
      }
    }
  });

  test('content area links DO have underlines (accessibility)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find links in content areas (main, article, p)
    const contentLinks = page.locator('main a:not(.nav-link):not(.header-link):not([role="button"]), article a, p a');
    const count = await contentLinks.count();

    if (count > 0) {
      // At least some content links should have underlines
      let hasUnderline = false;
      for (let i = 0; i < Math.min(count, 5); i++) {
        const link = contentLinks.nth(i);
        const textDecoration = await link.evaluate(el => 
          window.getComputedStyle(el).textDecoration
        );
        if (textDecoration.includes('underline')) {
          hasUnderline = true;
          break;
        }
      }
      // This is expected for accessibility
      expect(hasUnderline).toBeTruthy();
    }
  });
});

test.describe('Page Navigation', () => {
  test('navigate to new arrivals page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on "New Arrivals" link or navigate directly
    await page.goto('/new-arrivals');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(page).toHaveTitle(/New Arrivals|Aarya/);

    // Check product images load
    const productImages = page.locator('img');
    const count = await productImages.count();
    expect(count).toBeGreaterThan(0);
  });

  test('navigate to products page', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(page).toHaveTitle(/Products|Aarya/);

    // Check product images load
    const productImages = page.locator('img');
    const count = await productImages.count();
    expect(count).toBeGreaterThan(0);
  });
});
