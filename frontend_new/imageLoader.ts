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
 * Image Flow (Browser Direct):
 *   <Image> → this loader → direct R2 URL → browser fetches from Cloudflare edge
 *
 * NOTE: A previous version routed through /_next/image which created an infinite
 * loop with the custom loader. The loader now returns the direct R2 public URL.
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
  // Handle non-string sources
  if (!src || typeof src !== 'string' || src.trim() === "") {
    return `/placeholder-image.jpg`;
  }

  // Local static assets are served from /public directly
  if (isLocalStaticAsset(src)) {
    return src;
  }

  // Blob URLs (for local previews) should be returned as-is
  if (src.startsWith('blob:')) {
    return src;
  }

  // Normalize src to a full URL if it's a relative path from R2
  let fullUrl = src;
  if (!src.startsWith('http')) {
    const normalizedR2Base = R2_PUBLIC_URL.replace(/\/+$/, '');
    const cleanPath = src.startsWith('/') ? src : `/${src}`;
    fullUrl = `${normalizedR2Base}${cleanPath}`;
  }

  // Return the direct R2 URL so the browser fetches the image directly.
  //
  // IMPORTANT: Do NOT route through /_next/image here — that creates an infinite
  // loop with a custom loader (the browser fetches /_next/image, which calls the
  // loader again, which returns /_next/image again, ad infinitum).
  //
  // The R2 public URL serves images directly from Cloudflare's edge network.
  // For bandwidth-conscious sites, enable Cloudflare Image Resizing on your own
  // domain and use the /cdn-cgi/image/ endpoint there instead of R2.dev.
  return fullUrl;
}

/**
 * Usage Examples:
 *
 * 1. Basic usage:
 *    <Image src="/products/shirt.jpg" width={800} height={600} />
 *    → https://pub-xxx.r2.dev/products/shirt.jpg (direct R2 URL)
 *
 * 2. Full R2 URL:
 *    <Image src="https://pub-xxx.r2.dev/images/product.jpg" width={800} />
 *    → https://pub-xxx.r2.dev/images/product.jpg (passed through as-is)
 *
 * 3. Relative path from backend:
 *    <Image src="/collections/summer.jpg" width={400} />
 *    → https://pub-xxx.r2.dev/collections/summer.jpg
 *
 * 4. Local static asset:
 *    <Image src="/logo.png" width={120} />
 *    → /logo.png (served from /public)
 */
