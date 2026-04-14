import type { ImageLoaderProps } from "next/image";

/**
 * Cloudflare R2 Image Loader for Next.js
 *
 * ARCHITECTURE: This loader handles images from Cloudflare R2 storage.
 * All dynamic images (products, collections, hero, about) come from R2 via backend API.
 * Local /public images are only for static assets (logo, placeholders, noise texture).
 *
 * Image Flow:
 * 1. Admin uploads image → R2 Storage
 * 2. R2 returns URL → Stored in database (relative path)
 * 3. Frontend fetches API → Backend converts to full R2 URL
 * 4. Frontend <Image> → This loader optimizes via Cloudflare CDN
 *
 * R2 Configuration (dynamic via env var):
 * - Bucket: aarya-clothing-images
 * - Public URL: configured via NEXT_PUBLIC_R2_PUBLIC_URL env var
 *   (falls back to hardcoded value if env var not set)
 * - Folders: /collections/, /products/, /hero/, /about/, /landing/
 */

const R2_PUBLIC_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_R2_PUBLIC_URL) ||
  "https://pub-7846c786f7154610b57735df47899fa0.r2.dev";

const normalizeSrc = (src: string): string => {
  // If it's already a full URL, keep it as is
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  // Remove leading slash for relative paths
  return src.startsWith("/") ? src.slice(1) : src;
};

/**
 * Encodes a URL for use in Cloudflare Images CDN path.
 * Cloudflare requires URL-encoding for remote image URLs to prevent
 * path parsing issues with special characters like ://
 * 
 * Example:
 *   https://example.com/image.jpg → https%3A%2F%2Fexample.com%2Fimage.jpg
 */
const encodeForCloudflare = (url: string): string => {
  // Only encode if it's a full URL (contains protocol)
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return encodeURIComponent(url);
  }
  return url;
};

const isR2Url = (src: string): boolean => {
  // Check if this is an R2 URL (either full URL or relative path that should go to R2)
  return (
    src.includes("pub-") && src.includes("r2.dev") ||
    src.includes(R2_PUBLIC_URL)
  );
};

const isLocalStaticAsset = (src: string): boolean => {
  // These are the ONLY images that should be served from /public
  // ALL other images (including about page) come from R2 via backend API
  const staticAssets = [
    "/logo.png",                    // Branding logo
    "/noise.png",                   // Texture overlay
    "/placeholder-image.jpg",       // Fallback for broken images
    "/placeholder-collection.jpg",  // Fallback for collections
    "/Create_a_video_",             // Intro video thumbnail
    // NOTE: About page images (kurti1.jpg, kurti2.jpg) come from R2 via API
    // They are NOT local static assets - database stores R2 relative paths
  ];
  return staticAssets.some((asset) => src.includes(asset));
};

export default function cloudflareLoader({
  src,
  width,
  quality = 75,
}: ImageLoaderProps): string {
  // Handle non-string sources (null, undefined, objects, etc.)
  if (!src || typeof src !== 'string' || src.trim() === "") {
    return `/placeholder-image.jpg`;
  }

  const queryParams = `width=${width}&quality=${quality ?? 75}`;

  // Local static assets are always served from /public
  if (isLocalStaticAsset(src)) {
    return src;
  }

  // R2 URLs: return direct URL — R2 CDN delivers these efficiently.
  // NOTE: /cdn-cgi/image/ only works at Cloudflare edge (not origin),
  // so we return the direct R2 URL to avoid 404s.
  if (isR2Url(src)) {
    return normalizeSrc(src);
  }

  // Relative paths — reconstruct full R2 URL
  if (src.startsWith("/")) {
    return `${R2_PUBLIC_URL}${src}`;
  }

  // Fallback: return as-is
  return src;
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
