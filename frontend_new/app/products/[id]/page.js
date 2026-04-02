import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { productsApi, reviewsApi } from '@/lib/customerApi';
import { generateBreadcrumbSchema, generateProductSchema } from '@/lib/structuredData';
import ProductDetailClient from './ProductDetailClient';
import { getCommerceBaseUrl } from '@/lib/baseApi';

// Force dynamic rendering - API is not available during build time
export const dynamic = 'force-dynamic';

/**
 * Fetch product slug for canonical redirect (numeric ID → slug)
 * This is done server-side to prevent client-side navigation jitter
 */
async function getProductSlug(id) {
  try {
    const API_BASE = getCommerceBaseUrl();
    const res = await fetch(`${API_BASE}/api/v1/products/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const product = data?.product || data;
    return product?.slug || null;
  } catch (err) {
    return null;
  }
}

// Generate metadata dynamically
export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    let product;

    // Check if ID is a valid number first
    const numericId = Number(id);
    if (!isNaN(numericId)) {
      // Try fetching by numeric ID
      try {
        const data = await productsApi.get(numericId);
        product = data.product || data;
      } catch (err) {
        // If not found, try by slug — wrap in try-catch to handle slug errors
        try {
          product = await productsApi.getBySlug(id);
        } catch (slugErr) {
          // Product not found by ID or slug
          product = null;
        }
      }
    } else {
      // ID is a slug, fetch directly by slug
      try {
        product = await productsApi.getBySlug(id);
      } catch (err) {
        product = null;
      }
    }

    if (!product) {
      return {
        title: 'Product Not Found | Aarya Clothing',
        robots: { index: false, follow: false },
      };
    }

    // Validate product ID/slug for URL generation - prevent null/undefined URLs
    const productUrl = product.slug || (product.id ? String(product.id) : null);
    const canonicalUrl = productUrl ? `https://aaryaclothing.in/products/${productUrl}` : 'https://aaryaclothing.in/products';
    
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
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
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

    // Check if ID is a valid number first
    const numericId = Number(id);
    if (!isNaN(numericId)) {
      // Try fetching by numeric ID
      try {
        productData = await productsApi.get(numericId);
      } catch (err) {
        // If not found, fallback to slug — wrap in try-catch to handle slug errors
        try {
          productData = await productsApi.getBySlug(id);
        } catch (slugErr) {
          console.error('Error fetching product by slug:', slugErr);
          return null;
        }
      }
    } else {
      // ID is a slug, fetch directly by slug
      try {
        productData = await productsApi.getBySlug(id);
      } catch (err) {
        console.error('Error fetching product by slug:', err);
        return null;
      }
    }

    const product = productData.product || productData;

    if (!product) {
      return null;
    }

    // Derive sizes & colors from inventory if not provided
    // Create new arrays instead of mutating the original object
    const sizes = (product.sizes && product.sizes.length > 0) 
      ? product.sizes 
      : [...new Set((product.inventory || []).map(i => i.size).filter(Boolean))];
    
    const colors = (product.colors && product.colors.length > 0)
      ? product.colors
      : [...new Map(
          (product.inventory || [])
            .filter(i => i.color)
            .map(i => [i.color, { name: i.color, hex: '#B76E79' }])
        ).values()];

    // Fetch reviews
    let reviews = [];
    try {
      const reviewsData = await reviewsApi.list(product.id);
      reviews = reviewsData.reviews || reviewsData || [];
    } catch (err) {
      console.error('Error fetching reviews:', err);
    }

    // Return a clean serializable object
    return { 
      product: {
        ...product,
        sizes,
        colors
      }, 
      reviews 
    };
  } catch (error) {
    console.error('Error fetching product data:', error);
    return null;
  }
}

export default async function ProductDetailPage({ params }) {
  const { id } = await params;
  
  // Canonical redirect: /products/123 → /products/my-slug (numeric IDs only)
  // This happens server-side BEFORE rendering, preventing client-side jitter
  if (/^\d+$/.test(id)) {
    const slug = await getProductSlug(id);
    if (slug && slug !== id) {
      redirect(`/products/${slug}`);
    }
  }
  
  const data = await getProductData(id);

  if (!data || !data.product) {
    notFound();
  }

  const { product, reviews } = data;

  // CRITICAL: Serialize data to ensure all Date objects are converted to strings
  // This MUST happen before passing to client component to prevent hydration errors
  const serializedProduct = JSON.parse(JSON.stringify(product));
  const serializedReviews = JSON.parse(JSON.stringify(reviews));

  // Validate product URL for structured data - prevent null/undefined URLs
  const productUrl = serializedProduct.slug || (serializedProduct.id ? String(serializedProduct.id) : '');
  const productPath = productUrl ? `/products/${productUrl}` : '/products';

  // Generate structured data
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Collections', url: '/collections' },
    ...(serializedProduct.collection_slug ? [{ name: serializedProduct.collection_name || serializedProduct.category, url: `/collections/${serializedProduct.collection_slug}` }] : []),
    { name: serializedProduct.name, url: productPath }
  ]);

  const productSchema = generateProductSchema(serializedProduct, serializedReviews);

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

      {/* Pass SERIALIZED data to client component - prevents Date object serialization errors */}
      <ProductDetailClient
        initialProduct={serializedProduct}
        initialReviews={serializedReviews}
        productId={id}
      />
    </>
  );
}
