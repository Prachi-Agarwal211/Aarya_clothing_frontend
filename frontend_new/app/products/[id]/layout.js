import { redirect } from 'next/navigation';
import { getCommerceBaseUrl } from '@/lib/baseApi';

async function getProductSlug(id) {
  try {
    const API_BASE = getCommerceBaseUrl();
    const res = await fetch(`${API_BASE}/api/v1/products/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Handle both wrapped ({product: ...}) and direct response formats
    const product = data?.product || data;
    return product?.slug || null;
  } catch (err) {
    // Log error for debugging but don't crash
    console.error(`[ProductLayout] Error fetching product slug for ${id}:`, err?.message || err);
    return null;
  }
}

export default async function ProductDetailLayout({ children, params }) {
  const { id } = await params;

  // Canonical redirect: /products/123 → /products/my-slug (numeric IDs only)
  if (/^\d+$/.test(id)) {
    const slug = await getProductSlug(id);
    if (slug && slug !== id) {
      redirect(`/products/${slug}`);
    }
  }

  return <>{children}</>;
}
