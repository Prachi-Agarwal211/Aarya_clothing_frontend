const INTERNAL_API = process.env.INTERNAL_API_URL || 'http://commerce:5002';
const BASE_URL = 'https://aaryaclothing.in';

async function getCollection(slug) {
  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/collections/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.collection || data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const collection = await getCollection(params.slug);
  if (!collection) {
    return { title: 'Collection | Aarya Clothing' };
  }

  const name = collection.name || params.slug;
  const title = `${name} | Aarya Clothing — Premium Ethnic Wear`;
  const description =
    collection.description?.slice(0, 160) ||
    `Shop our ${name} collection at Aarya Clothing. Handcrafted ethnic wear with free shipping across India.`;
  const canonical = `${BASE_URL}/collections/${collection.slug || params.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Aarya Clothing',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CollectionLayout({ children, params }) {
  const collection = await getCollection(params.slug);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Collections', item: `${BASE_URL}/collections` },
      ...(collection
        ? [{ '@type': 'ListItem', position: 3, name: collection.name, item: `${BASE_URL}/collections/${collection.slug || params.slug}` }]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {children}
    </>
  );
}
