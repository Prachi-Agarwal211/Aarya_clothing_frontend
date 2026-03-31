import { redirect } from 'next/navigation';

const INTERNAL_API = process.env.INTERNAL_API_URL || 'http://commerce:5002';

async function getProductSlug(id) {
  try {
    const res = await fetch(`${INTERNAL_API}/api/v1/products/${id}`, {
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
