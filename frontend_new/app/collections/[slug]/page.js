import { redirect } from 'next/navigation';
import { collectionsApi } from '@/lib/customerApi';

/**
 * /collections/[slug] → redirect to /products?collection_id=X
 *
 * Collections are NOT a standalone page — all product browsing happens
 * on /products.  Old /collections/<slug> URLs (bookmarks, search index)
 * are 301-redirected to the canonical product listing with the collection
 * filter pre-selected.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  try {
    const slug = await params.slug;
    if (!slug || slug === 'null' || slug === 'undefined') {
      return { title: 'Redirecting… | Aarya Clothing' };
    }

    const collection = await collectionsApi.getBySlug(slug).catch(() => null);
    if (collection?.name) {
      return { title: `${collection.name} | Aarya Clothing` };
    }
  } catch { /* fallback title is fine */ }
  return { title: 'Redirecting… | Aarya Clothing' };
}

export default async function CollectionSlugRedirect({ params }) {
  const slug = await params.slug;

  if (!slug || slug === 'null' || slug === 'undefined') {
    redirect('/products');
  }

  try {
    const collection = await collectionsApi.getBySlug(slug);
    if (collection?.id) {
      redirect(`/products?collection_id=${collection.id}`);
    }
  } catch {
    // Collection not found or API down — redirect to generic products page
  }

  redirect('/products');
}
