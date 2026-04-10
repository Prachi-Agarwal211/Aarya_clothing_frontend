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
    // Enable source maps only in development
    config.devtool = dev ? 'source-map' : false;

    // Reduce bundle size by excluding moment locales
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // Separate vendor chunks
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          // Separate React chunk
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20,
          },
          // Separate GSAP chunk
          gsap: {
            test: /[\\/]node_modules[\\/](gsap|@gsap)[\\/]/,
            name: 'gsap',
            chunks: 'all',
            priority: 20,
          },
          // Common chunks for shared code
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      };
    }

    return config;
  },

  // Security & Performance Headers
  async headers() {
    return [
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
      // Cache static assets for 1 year
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // /_next/static/ chunks — immutable (content-hashed, safe to cache forever)
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // /_next/image optimizer — short-lived cache
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400'
          }
        ]
      },
      // All HTML/SSR routes — never cache.
      // Scoped to exclude /_next/* so static chunks keep their immutable header.
      // After a rebuild chunk hashes change: cached HTML → old chunk URLs → 404.
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
