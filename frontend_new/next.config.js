/** @type {import('next').NextConfig} */

// Bundle analyzer for production builds
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,

  // Disable the Next.js dev indicator ("N" button) visible in browser
  devIndicators: false,

  // Disable ESLint during build to allow build to complete despite warnings
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Docker standalone output for containerized deployment - ONLY in production
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
  }),

  // Image Optimization with Cloudflare Images CDN
  images: {
    // Use custom loader for Cloudflare Images
    loader: 'custom',
    loaderFile: './imageLoader.ts',

    // Modern image formats - AVIF preferred, WebP fallback
    formats: ['image/avif', 'image/webp'],

    // Responsive breakpoints for different screen sizes
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Cache optimized images for 1 hour (reduced from 30 days for faster updates)
    minimumCacheTTL: 3600,

    // Allow images from Cloudflare R2 storage
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-7846c786f7154610b57735df47899fa0.r2.dev',
        pathname: '/**',
      },
      // Allow any R2 bucket (adjust if using multiple buckets)
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        pathname: '/**',
      },
      // Allow Razorpay QR code images
      {
        protocol: 'https',
        hostname: 'rzp.io',
        pathname: '/**',
      },
    ],

    // Security settings
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    // connect-src allows same-origin fetch/XHR from optimized image URLs where applicable
    contentSecurityPolicy:
      "default-src 'self'; frame-ancestors 'self'; base-uri 'self'; connect-src 'self' https: wss: data: blob:;",

    // Prevent unoptimized mode - always use optimization
    unoptimized: false,

    // Qualities for Next.js 16+ compatibility (fixes unconfigured-qualities warning)
    qualities: [25, 50, 75, 100],
  },

  // Performance
  compress: true,
  poweredByHeader: false,

  // Generate ETags for cache validation
  generateEtags: true,

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    // Remove React dev tools in production
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },

  // Experimental Features for better performance
  experimental: {
    optimizeCss: true,
    // Enable early import for faster builds
    optimizeServerReact: true,
    // Enable React Server Components optimization
    serverComponentsHmrCache: false,
    // Reduce bundle size with better tree shaking
    // Enable memory-based caching for faster builds
    // Reduced cache times for development - changes reflect faster
    cacheLife: {
      default: {
        stale: 30, // 30 seconds
        revalidate: 10, // 10 seconds
        expire: 60, // 60 seconds
      },
    },
    // Enable newer performance optimizations - deduplicated list
    optimizePackageImports: ['lucide-react', 'gsap', 'recharts', '@use-gesture/react'],
  },

  // Modularize imports for smaller bundles
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // Webpack configuration for additional optimizations
  webpack: (config, { isServer, dev }) => {
    // Let Next.js fully manage chunk splitting, CSS extraction, and devtool.
    // Custom splitChunks was interfering with Next's CSS/JS chunking, causing
    // vendors.css to be requested as a script (MIME type error) and chunk loading failures
    // (TypeError: Cannot read properties of undefined (reading 'call')).
    // optimizePackageImports + modularizeImports already provide good tree-shaking.

    // Note: We no longer override config.optimization.splitChunks here.

    // Disable source maps in dev to avoid "illegal path" issues with complex host paths
    // (e.g. OneDrive with Unicode chars in WSL/Docker). Also avoids devtool revert warnings.
    if (dev) {
      config.devtool = false;
    }

    return config;
  },

  // Security & Performance Headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const headers = [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          }
          // NOTE: All other security headers (X-Frame-Options, CSP, Permissions-Policy, etc.)
          // are handled exclusively by Nginx to avoid duplicate/conflicting headers.
        ]
      },
      // All HTML/SSR routes — never cache.
      {
        source: '/((?!_next/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          }
        ]
      },
      // API routes - no cache
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          }
        ]
      },
    ];

    if (isProd) {
      // Prod only: long immutable cache for hashed static assets (chunks change on rebuild so safe).
      // In dev, stable chunk names + immutable = browser serves stale bundles forever even after rebuilds/restarts.
      headers.push(
        {
          source: '/fonts/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        },
        {
          source: '/_next/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable'
            }
          ]
        },
        {
          source: '/_next/image/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=604800, stale-while-revalidate=86400'
            }
          ]
        }
      );
    } else {
      // Dev: explicitly prevent any caching of chunks so source/config changes + docker rebuilds are immediately visible
      // without requiring "Empty Cache and Hard Reload" every time. Fixes the "why again and again after docker" symptom.
      headers.push({
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          }
        ]
      });
    }

    return headers;
  },

  // NOTE: API routing is handled entirely by Nginx.
  // No Next.js rewrites needed — they would proxy to localhost:6005 inside Docker which is invalid.
  
  // Redirects for SEO and UX
  async redirects() {
    return [
      // Redirect /new-arrivals to home page #new-arrivals section
      {
        source: '/new-arrivals',
        destination: '/#new-arrivals',
        permanent: true, // 301 redirect for SEO
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
