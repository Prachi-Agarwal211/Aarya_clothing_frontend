/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Docker standalone output for containerized deployment - ONLY in production
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
  }),

  // Image Optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Configure allowed qualities for Next.js 16 compatibility
    qualities: [25, 50, 75, 85, 90, 100],
    // Cache images for 30 days
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Allow unoptimized images in development
    unoptimized: process.env.NODE_ENV === 'development',
    // Allow images from Cloudflare R2
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-7846c786f7154610b57735df47899fa0.r2.dev',
        pathname: '/**',
      },
    ],
  },

  // Performance
  compress: true,
  poweredByHeader: false,

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Experimental Features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'gsap', '@splinetool/react-spline', 'framer-motion'],
  },

  // Modularize imports for smaller bundles
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
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
    ];
  }
};

module.exports = nextConfig;
