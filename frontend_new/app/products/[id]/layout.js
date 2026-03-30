const INTERNAL_API = process.env.INTERNAL_API_URL || 'http://commerce:5002';
const BASE_URL = 'https://aaryaclothing.in';

async function getProduct(id) {
  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/products/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.product || data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const product = await getProduct(params.id);
  if (!product) {
    return { title: 'Product | Aarya Clothing' };
  }

  const title = `${product.name} — ₹${product.price || ''} | Aarya Clothing`;
  const description =
    product.description?.slice(0, 160) ||
    `Buy ${product.name} at Aarya Clothing. Premium quality ethnic wear with free shipping across India.`;
  const image = product.primary_image || product.image_url || product.images?.[0]?.image_url;
  const canonical = `${BASE_URL}/products/${product.slug || product.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: product.name,
      description: description,
      url: canonical,
      siteName: 'Aarya Clothing',
      images: image ? [{ url: image, width: 800, height: 1067, alt: product.name }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function ProductDetailLayout({ children, params }) {
  const product = await getProduct(params.id);

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description || '',
        image: product.images?.map((i) => i.image_url).filter(Boolean) ||
          (product.primary_image ? [product.primary_image] : []),
        brand: { '@type': 'Brand', name: 'Aarya Clothing' },
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'INR',
          availability:
            product.in_stock !== false
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: 'Aarya Clothing' },
          url: `${BASE_URL}/products/${product.slug || product.id}`,
        },
        ...(product.rating && product.reviews_count
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating,
                reviewCount: product.reviews_count,
              },
            }
          : {}),
      }
    : null;

  const breadcrumb = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Products', item: `${BASE_URL}/products` },
          {
            '@type': 'ListItem',
            position: 3,
            name: product.name,
            item: `${BASE_URL}/products/${product.slug || product.id}`,
          },
        ],
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumb && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
        />
      )}
      {children}
    </>
  );
}
