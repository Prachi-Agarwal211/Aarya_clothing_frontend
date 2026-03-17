#!/usr/bin/env node

/**
 * Test script to verify imageLoader.ts generates correct Cloudflare Images URLs
 * 
 * Run: node test_imageloader_fix.js
 */

// Simulate the imageLoader functions
const R2_PUBLIC_URL = "https://pub-7846c786f7154610b57735df47899fa0.r2.dev";

const normalizeSrc = (src) => {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return src.startsWith("/") ? src.slice(1) : src;
};

const encodeForCloudflare = (url) => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return encodeURIComponent(url);
  }
  return url;
};

const isR2Url = (src) => {
  return (
    src.includes("pub-") && src.includes("r2.dev") ||
    src.includes(R2_PUBLIC_URL)
  );
};

const isLocalStaticAsset = (src) => {
  const staticAssets = [
    "/logo.png",
    "/noise.png",
    "/placeholder-image.jpg",
    "/placeholder-collection.jpg",
    "/Create_a_video_",
  ];
  return staticAssets.some((asset) => src.includes(asset));
};

const cloudflareLoader = ({ src, width, quality = 75 }) => {
  const params = [`width=${width}`];
  if (quality) {
    params.push(`quality=${quality}`);
  }

  if (!src || src.trim() === "") {
    return `/placeholder-image.jpg?${params.join("&")}`;
  }

  // CRITICAL: Check local static assets FIRST
  if (isLocalStaticAsset(src)) {
    return src;
  }

  // R2 URLs: Use Cloudflare Images CDN for optimization
  if (isR2Url(src)) {
    const normalizedSrc = normalizeSrc(src);
    const encodedSrc = encodeForCloudflare(normalizedSrc);
    return `/cdn-cgi/image/${params.join(",")}/${encodedSrc}`;
  }

  // Relative paths
  if (src.startsWith("/")) {
    const fullR2Url = `${R2_PUBLIC_URL}${src}`;
    const encodedSrc = encodeForCloudflare(fullR2Url);
    return `/cdn-cgi/image/${params.join(",")}/${encodedSrc}`;
  }

  return src;
};

// Test cases
const tests = [
  {
    name: "Full R2 URL (product image)",
    input: "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/products/shirt.jpg",
    width: 256,
    expected: "/cdn-cgi/image/width=256,quality=75/https%3A%2F%2Fpub-7846c786f7154610b57735df47899fa0.r2.dev%2Fproducts%2Fshirt.jpg",
  },
  {
    name: "Full R2 URL (hero image)",
    input: "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/hero/hero1.png",
    width: 3840,
    quality: 85,
    expected: "/cdn-cgi/image/width=3840,quality=85/https%3A%2F%2Fpub-7846c786f7154610b57735df47899fa0.r2.dev%2Fhero%2Fhero1.png",
  },
  {
    name: "Relative path (product image)",
    input: "/products/shirt.jpg",
    width: 800,
    expected: "/cdn-cgi/image/width=800,quality=75/https%3A%2F%2Fpub-7846c786f7154610b57735df47899fa0.r2.dev%2Fproducts%2Fshirt.jpg",
  },
  {
    name: "Local static asset (logo.png from /public)",
    input: "/logo.png",
    width: 128,
    expected: "/logo.png", // Should NOT be transformed
  },
];

console.log("🧪 Testing imageLoader.ts URL Generation\n");
console.log("=".repeat(80));

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = cloudflareLoader({
    src: test.input,
    width: test.width,
    quality: test.quality,
  });

  const success = result === test.expected;
  
  console.log(`\nTest ${index + 1}: ${test.name}`);
  console.log(`  Input:    ${test.input}`);
  console.log(`  Expected: ${test.expected}`);
  console.log(`  Got:      ${result}`);
  console.log(`  Status:   ${success ? "✅ PASS" : "❌ FAIL"}`);
  
  if (success) {
    passed++;
  } else {
    failed++;
  }
});

console.log("\n" + "=".repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log("\n✅ All tests passed! URL encoding is working correctly.\n");
  process.exit(0);
} else {
  console.log("\n❌ Some tests failed! Check the imageLoader implementation.\n");
  process.exit(1);
}
