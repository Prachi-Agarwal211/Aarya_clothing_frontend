const INTERNAL_API = process.env.INTERNAL_API_URL || 'http://commerce:5002';
const BASE_URL = 'https://aaryaclothing.in';

export const metadata = {
  title: 'Shop All Products | Aarya Clothing — Sarees, Kurtis, Lehengas & More',
  description:
    'Browse our complete collection of premium ethnic wear. Handcrafted sarees, designer kurtis, elegant lehengas and more. Free shipping across India.',
  alternates: { canonical: `${BASE_URL}/products` },
  openGraph: {
    title: 'Shop All Products | Aarya Clothing',
    description: 'Browse our complete collection of premium ethnic wear. Free shipping across India.',
    url: `${BASE_URL}/products`,
    siteName: 'Aarya Clothing',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shop All Products | Aarya Clothing',
    description: 'Browse our complete collection of premium ethnic wear.',
  },
};

async function getFeaturedProducts() {
  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/products?limit=20&is_active=true`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.products || data?.items || [];
  } catch {
    return [];
  }
}

export default async function ProductsLayout({ children }) {
  const products = await getFeaturedProducts();

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${BASE_URL}/products` },
    ],
  };

  const itemList = products.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'All Products — Aarya Clothing',
    url: `${BASE_URL}/products`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE_URL}/products/${p.slug || p.id}`,
      name: p.name,
    })),
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      )}
      {children}
    </>
  );
}
