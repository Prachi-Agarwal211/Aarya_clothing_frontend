import { getCoreBaseUrl } from '@/lib/baseApi';

const BASE_URL = 'https://aaryaclothing.in';

// Use hardcoded URL for sitemap generation to avoid build-time issues
// getCoreBaseUrl() may return empty string during static generation
const API_BASE = BASE_URL;  // Use public URL for sitemap

async function fetchJson(url) {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function sitemap() {
  const now = new Date().toISOString();
  
  // Static pages - always included
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

  // Products - with error handling to prevent sitemap crashes
  let products = [];
  try {
    const productsData = await fetchJson(`${API_BASE}/api/v1/products?limit=1000&fields=id,slug,updated_at`);
    products = (productsData?.items || productsData?.products || []).map((p) => ({
      url: `${BASE_URL}/products/${p.slug || p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at).toISOString() : now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch (error) {
    console.error('[Sitemap] Failed to fetch products:', error.message);
    // Continue with empty products array - sitemap still valid
  }

  // Collections - with error handling to prevent sitemap crashes
  let collections = [];
  try {
    const collectionsData = await fetchJson(`${API_BASE}/api/v1/collections?limit=200`);
    collections = (collectionsData?.items || collectionsData?.collections || []).map((c) => ({
      url: `${BASE_URL}/collections/${c.slug || c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at).toISOString() : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch (error) {
    console.error('[Sitemap] Failed to fetch collections:', error.message);
    // Continue with empty collections array
  }

  return [...staticPages, ...products, ...collections];
}
