import { getCoreBaseUrl } from '@/lib/baseApi';

const BASE_URL = 'https://aaryaclothing.in';

// PERFORMANCE: Use internal Docker hostnames for build-time fetching
// This is significantly faster and more reliable during the 'next build' phase.
const COMMERCE_INTERNAL_URL = process.env.NEXT_PUBLIC_INTERNAL_COMMERCE_URL || 'http://commerce:5002';

async function fetchJson(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`[Sitemap] Fetch error for ${url}:`, error.message);
    return null;
  }
}

export default async function sitemap() {
  const now = new Date().toISOString();
  
  // Static pages
  const staticPages = [
    { url: BASE_URL,                              lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/products`,                lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/collections`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/new-arrivals`,            lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE_URL}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contact`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/faq`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/shipping`,                lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/returns`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE_URL}/terms`,                   lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE_URL}/payment-policy`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ];

  // Products - use internal URL
  let products = [];
  try {
    const productsData = await fetchJson(`${COMMERCE_INTERNAL_URL}/api/v1/products/browse?limit=1000`);
    products = (productsData?.items || productsData?.products || []).map((p) => ({
      url: `${BASE_URL}/products/${p.slug || p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at).toISOString() : now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch (err) {
    console.error('[Sitemap] Products fetch failed:', err.message);
  }

  // Collections - use internal URL
  let collections = [];
  try {
    const collectionsData = await fetchJson(`${COMMERCE_INTERNAL_URL}/api/v1/collections?limit=200`);
    collections = (collectionsData?.items || collectionsData?.collections || []).map((c) => ({
      url: `${BASE_URL}/products?collection_id=${c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at).toISOString() : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch (err) {
    console.error('[Sitemap] Collections fetch failed:', err.message);
  }

  return [...staticPages, ...products, ...collections];
}
