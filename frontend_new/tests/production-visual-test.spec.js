const { test, expect } = require('@playwright/test');

test.describe('Production Visual Test - aaryaclothing.in', () => {
  const baseURL = 'https://aaryaclothing.in';

  test('Homepage - Check images and underlines', async ({ page }) => {
    // Navigate to production
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Take full page screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/homepage-full.png',
      fullPage: true 
    });

    // Check for console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Check for failed network requests
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        error: request.failure().errorText
      });
    });

    // Wait for images to load
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 3000)); // Wait 3 more seconds

    // Check navigation links for underlines
    const navLinks = await page.$$('nav a, .header-link, [role="navigation"] a');
    const navUnderlines = [];
    for (const link of navLinks) {
      const textDecoration = await link.evaluate(el => 
        window.getComputedStyle(el).textDecorationLine
      );
      if (textDecoration === 'underline') {
        navUnderlines.push(await link.textContent());
      }
    }

    // Check buttons for underlines
    const buttons = await page.$$('button a, a[role="button"], .btn a');
    const buttonUnderlines = [];
    for (const btn of buttons) {
      const textDecoration = await btn.evaluate(el => 
        window.getComputedStyle(el).textDecorationLine
      );
      if (textDecoration === 'underline') {
        buttonUnderlines.push(await btn.textContent());
      }
    }

    // Save results
    const results = {
      url: baseURL,
      timestamp: new Date().toISOString(),
      consoleErrors: consoleErrors.filter(e => !e.includes('favicon')),
      failedRequests: failedRequests.filter(r => 
        r.url.includes('.jpg') || r.url.includes('.png') || r.url.includes('.webp')
      ),
      navUnderlines,
      buttonUnderlines,
      screenshot: 'tests/screenshots/homepage-full.png'
    };

    console.log('=== HOMEPAGE TEST RESULTS ===');
    console.log('Console Errors:', results.consoleErrors.length);
    console.log('Failed Image Requests:', results.failedRequests.length);
    console.log('Nav Underlines (BAD):', navUnderlines);
    console.log('Button Underlines (BAD):', buttonUnderlines);
    console.log('Screenshot:', results.screenshot);

    // Write to file
    const fs = require('fs');
    fs.writeFileSync(
      'tests/results/homepage-test.json', 
      JSON.stringify(results, null, 2)
    );
  });

  test('About Page - Check kurti images', async ({ page }) => {
    await page.goto(`${baseURL}/about`, { waitUntil: 'networkidle', timeout: 60000 });
    
    await page.screenshot({ 
      path: 'tests/screenshots/about-page-full.png',
      fullPage: true 
    });

    // Check for failed image requests
    const failedRequests = [];
    page.on('requestfailed', request => {
      if (request.url().includes('kurti') || request.url().includes('about')) {
        failedRequests.push({
          url: request.url(),
          error: request.failure().errorText
        });
      }
    });

    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 3000));

    console.log('=== ABOUT PAGE TEST RESULTS ===');
    console.log('Failed Kurti Requests:', failedRequests);
    console.log('Screenshot: tests/screenshots/about-page-full.png');

    const fs = require('fs');
    fs.writeFileSync(
      'tests/results/about-page-test.json',
      JSON.stringify({ failedRequests }, null, 2)
    );
  });
});
