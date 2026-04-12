import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { collectionsApi, productsApi } from '@/lib/customerApi';
import { generateBreadcrumbSchema, generateItemListSchema } from '@/lib/structuredData';
import CollectionDetailClient from './CollectionDetailClient';

// Force dynamic rendering - API is not available during build time
export const dynamic = 'force-dynamic';

// Timeout for API calls (10 seconds)
const API_TIMEOUT_MS = 10000;

function isInvalidCollectionSlug(slug) {
  return (
    slug == null ||
    slug === '' ||
    slug === 'null' ||
    slug === 'undefined' ||
    String(slug).trim() === ''
  );
}

// Generate metadata dynamically
export async function generateMetadata({ params }) {
  try {
    const slug = await params.slug;
    if (isInvalidCollectionSlug(slug)) {
      return {
        title: 'Collections | Aarya Clothing',
        robots: { index: false, follow: false },
      };
    }
    
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    
    try {
      const collection = await collectionsApi.getBySlug(slug);
      clearTimeout(timeoutId);

      if (!collection) {
        return {
          title: 'Collection Not Found | Aarya Clothing',
          robots: { index: false, follow: false },
        };
      }

      const title = `${collection.name} | Aarya Clothing`;
      const description = collection.description || `Explore our ${collection.name.toLowerCase()} collection at Aarya Clothing. Premium ethnic wear with free shipping across India.`;
      const imageUrl = collection.image_url || 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png';

      return {
        title,
        description,
        keywords: [collection.name.toLowerCase(), 'ethnic wear', 'Indian fashion', 'Aarya Clothing', ...(collection.name.includes('Saree') ? ['sarees', 'saree collection'] : []), ...(collection.name.includes('Kurti') ? ['kurtis', 'kurti designs'] : []), ...(collection.name.includes('Lehenga') ? ['lehengas', 'lehenga collection'] : [])],
        authors: [{ name: 'Aarya Clothing' }],
        creator: 'Aarya Clothing',
        publisher: 'Aarya Clothing',
        robots: { index: true, follow: true },
        alternates: { canonical: `https://aaryaclothing.in/collections/${slug}` },
        openGraph: {
          title,
          description,
          url: `https://aaryaclothing.in/collections/${slug}`,
          type: 'website',
          images: [{ url: imageUrl, width: 1200, height: 630, alt: collection.name }],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [imageUrl],
        },
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Collections | Aarya Clothing',
      description: 'Explore our collections of premium ethnic wear.',
    };
  }
}

// Fetch collection and products server-side with timeout
async function getCollectionData(slug) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const collection = await collectionsApi.getBySlug(slug);

    clearTimeout(timeoutId);

    if (!collection) {
      return null;
    }

    // Fetch products filtered by category_id (collection.id)
    const productsResponse = await productsApi.list({ category_id: collection.id, limit: 100 }).catch(() => ({ items: [] }));

    const allProducts = Array.isArray(productsResponse)
      ? productsResponse
      : (productsResponse?.items || productsResponse?.products || []);

    return {
      collection,
      products: allProducts
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Error fetching collection data:', error);
    return null;
  }
}

export default async function CollectionDetailPage({ params }) {
  const slug = await params.slug;
  if (isInvalidCollectionSlug(slug)) {
    notFound();
  }
  const data = await getCollectionData(slug);

  if (!data || !data.collection) {
    notFound();
  }

  const { collection, products } = data;

  // Generate structured data
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Collections', url: '/collections' },
    { name: collection.name, url: `/collections/${slug}` }
  ]);

  const itemListSchema = generateItemListSchema(products.slice(0, 20), 'Product');

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        key="breadcrumb-schema"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        key="itemlist-schema"
      />

      {/* Pass initial data to client component for interactivity */}
      {/* key=slug: client state must reset on client nav between /collections/a → /collections/b */}
      <CollectionDetailClient
        key={slug}
        initialCollection={collection}
        initialProducts={products}
        slug={slug}
      />
    </>
  );
}
