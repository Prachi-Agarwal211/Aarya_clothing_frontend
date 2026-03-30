const BASE_URL = 'https://aaryaclothing.in';

const INTERNAL_API = process.env.INTERNAL_API_URL || 'http://commerce:5002';

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
  const now = new Date();

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

  const productsData = await fetchJson(`${INTERNAL_API}/api/v1/products?limit=1000&fields=id,slug,updated_at`);
  const products = (productsData?.items || productsData?.products || []).map((p) => ({
    url: `${BASE_URL}/products/${p.slug || p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const collectionsData = await fetchJson(`${INTERNAL_API}/api/v1/collections?limit=200`);
  const collections = (collectionsData?.items || collectionsData?.collections || []).map((c) => ({
    url: `${BASE_URL}/collections/${c.slug || c.id}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticPages, ...products, ...collections];
}
