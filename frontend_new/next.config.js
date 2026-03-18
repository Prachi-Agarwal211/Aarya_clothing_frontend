/** @type {import('next').NextConfig} */

// Bundle analyzer for production builds
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,

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

    // Cache optimized images for 30 days (in seconds)
    minimumCacheTTL: 2592000,

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
    ],

    // Security settings
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; frame-ancestors 'none'; base-uri 'self';",

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
    optimizePackageImports: ['lucide-react', 'gsap', '@splinetool/react-spline', 'framer-motion'],
    // Enable early import for faster builds
    optimizeServerReact: true,
    // Reduce bundle size with tree shaking via modularizeImports
    // Tree shaking is handled by modularizeImports and webpack
    // Enable memory-based caching for faster builds
    cacheLife: {
      default: {
        stale: 300, // 5 minutes
        revalidate: 60, // 1 minute
        expire: 600, // 10 minutes
      },
    },
  },

  // Modularize imports for smaller bundles
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
    // Tree shake framer-motion
    'framer-motion': {
      transform: 'framer-motion/dist/esm/{{member}}',
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
          // Separate framer-motion chunk
          framer: {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'framer',
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
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.razorpay.com https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.razorpay.com wss://aaryaclothing.in; frame-src 'self' https://*.razorpay.com; media-src 'self' https://*.r2.dev https://pub-7846c786f7154610b57735df47899fa0.r2.dev https://*.r2.cloudflarestorage.com blob:;"
          }
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
      // Cache images for 30 days
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, immutable'
          }
        ]
      },
      // Cache static JS/CSS for 1 year
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
    ];
  },

  // DNS prefetch for faster API calls
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005'}/api/:path*`,
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
