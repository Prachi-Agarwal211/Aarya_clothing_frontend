import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productsApi, reviewsApi } from '@/lib/customerApi';
import { generateBreadcrumbSchema, generateProductSchema } from '@/lib/structuredData';
import ProductDetailClient from './ProductDetailClient';

// Generate metadata dynamically
export async function generateMetadata({ params }) {
  try {
    const id = await params.id;
    let product;

    try {
      if (!isNaN(id)) {
        const data = await productsApi.get(Number(id));
        product = data.product || data;
      } else {
        product = await productsApi.getBySlug(id);
      }
    } catch (err) {
      product = await productsApi.getBySlug(id);
    }

    if (!product) {
      return {
        title: 'Product Not Found | Aarya Clothing',
        robots: { index: false, follow: false },
      };
    }

    const title = `${product.name} | Aarya Clothing`;
    const description = product.description || `Buy ${product.name} at Aarya Clothing. Premium ethnic wear with free shipping across India.`;
    const imageUrl = product.primary_image || product.image_url || 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png';

    return {
      title,
      description,
      keywords: [
        product.name.toLowerCase(),
        product.collection_name?.toLowerCase() || '',
        product.category?.toLowerCase() || '',
        'ethnic wear',
        'Indian fashion',
        'Aarya Clothing',
        product.sku,
      ].filter(Boolean),
      authors: [{ name: 'Aarya Clothing' }],
      creator: 'Aarya Clothing',
      publisher: 'Aarya Clothing',
      robots: { index: true, follow: true },
      alternates: { canonical: `https://aaryaclothing.in/products/${product.slug || product.id}` },
      openGraph: {
        title,
        description,
        url: `https://aaryaclothing.in/products/${product.slug || product.id}`,
        type: 'product',
        images: [{ url: imageUrl, width: 1200, height: 630, alt: product.name }],
        price: {
          amount: product.price,
          currency: 'INR',
        },
        availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Product | Aarya Clothing',
      description: 'Premium ethnic wear at Aarya Clothing.',
    };
  }
}

// Fetch product and reviews server-side
async function getProductData(id) {
  try {
    let productData;

    try {
      if (!isNaN(id)) {
        productData = await productsApi.get(Number(id));
      } else {
        productData = await productsApi.getBySlug(id);
      }
    } catch (err) {
      if (isNaN(id) || err.status === 404) {
        productData = await productsApi.getBySlug(id);
      } else {
        throw err;
      }
    }

    const product = productData.product || productData;

    if (!product) {
      return null;
    }

    // Derive sizes & colors from inventory if not provided
    if (!product.sizes || product.sizes.length === 0) {
      const sizesFromInv = [...new Set(
        (product.inventory || []).map(i => i.size).filter(Boolean)
      )];
      product.sizes = sizesFromInv;
    }
    if (!product.colors || product.colors.length === 0) {
      const colorsFromInv = [...new Map(
        (product.inventory || [])
          .filter(i => i.color)
          .map(i => [i.color, { name: i.color, hex: '#B76E79' }])
      ).values()];
      product.colors = colorsFromInv;
    }

    // Fetch reviews
    let reviews = [];
    try {
      const reviewsData = await reviewsApi.list(product.id);
      reviews = reviewsData.reviews || reviewsData || [];
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }

    return { product, reviews };
  } catch (error) {
    console.error('Error fetching product data:', error);
    return null;
  }
}

export default async function ProductDetailPage({ params }) {
  const id = await params.id;
  const data = await getProductData(id);

  if (!data || !data.product) {
    notFound();
  }

  const { product, reviews } = data;

  // Generate structured data
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Collections', url: '/collections' },
    ...(product.collection_slug ? [{ name: product.collection_name || product.category, url: `/collections/${product.collection_slug}` }] : []),
    { name: product.name, url: `/products/${product.slug || product.id}` }
  ]);

  const productSchema = generateProductSchema(product, reviews);

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        key="product-schema"
      />

      {/* Pass initial data to client component for interactivity */}
      <ProductDetailClient
        initialProduct={product}
        initialReviews={reviews}
        productId={id}
      />
    </>
  );
}
