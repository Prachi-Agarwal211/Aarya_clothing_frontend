import { redirect } from 'next/navigation';
import { getCoreBaseUrl } from '@/lib/baseApi';

// Use centralized URL configuration for all API calls
const API_BASE = getCoreBaseUrl();

async function getProductSlug(id) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/products/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.product || data)?.slug || null;
  } catch {
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
