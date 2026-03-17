import type { ImageLoaderProps } from "next/image";

/**
 * Cloudflare Images Loader for Next.js
 * 
 * This loader transforms Next.js Image component requests into Cloudflare Images CDN URLs.
 * Cloudflare Images provides on-the-fly image optimization, resizing, and format conversion.
 * 
 * Features:
 * - Automatic WebP/AVIF format negotiation
 * - On-demand resizing at edge locations
 * - Quality optimization
 * - 50-70% file size reduction
 * - Global CDN delivery
 * 
 * Setup:
 * 1. Enable "Resize images from any origin" in Cloudflare Dashboard
 * 2. Configure Browser TTL (recommended: 30 days minimum)
 * 3. Optionally set up custom domain for branded URLs
 * 
 * Pricing (as of 2025):
 * - $1 per 100K transformations
 * - 100K images stored free
 * - Much cheaper than Vercel at scale
 */

const normalizeSrc = (src: string): string => {
  // If it's a full URL (starts with http/https), keep it as is
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  // Remove leading slash if present for relative paths
  return src.startsWith("/") ? src.slice(1) : src;
};

export default function cloudflareLoader({
  src,
  width,
  quality = 75,
}: ImageLoaderProps): string {
  const params = [`width=${width}`];
  
  // Add quality parameter
  if (quality) {
    params.push(`quality=${quality}`);
  }

  // Development: Direct access without CDN transformation
  // This allows testing without Cloudflare setup
  if (process.env.NODE_ENV === "development") {
    // In development, just return the src with query params
    // Next.js built-in optimizer will handle it
    return `${src}?${params.join("&")}`;
  }

  // Production: Use Cloudflare Images CDN
  // Format: /cdn-cgi/image/{params}/{source-image}
  const normalizedSrc = normalizeSrc(src);
  return `/cdn-cgi/image/${params.join(",")}/${normalizedSrc}`;
}

/**
 * Usage Examples:
 * 
 * 1. Basic usage:
 *    <Image src="/products/shirt.jpg" width={800} height={600} />
 *    → /cdn-cgi/image/width=800,quality=75/products/shirt.jpg
 * 
 * 2. With quality override:
 *    <Image src="/hero.jpg" width={1600} quality={85} />
 *    → /cdn-cgi/image/width=1600,quality=85/hero.jpg
 * 
 * 3. Responsive images:
 *    <Image src="/product.jpg" width={400} sizes="(max-width: 768px) 100vw, 50vw" />
 *    → Multiple CDN URLs for different breakpoints
 * 
 * 4. Remote images (R2 storage):
 *    <Image src="https://pub-xxx.r2.dev/images/product.jpg" width={800} />
 *    → /cdn-cgi/image/width=800,quality=75/https://pub-xxx.r2.dev/images/product.jpg
 */
