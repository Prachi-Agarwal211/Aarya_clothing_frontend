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

// Breadcrumb and ItemList JSON-LD are injected by products/page.js for the listing page
// and by products/[id]/page.js for individual product pages.
// No API calls here — this layout is shared by all /products/* routes.
export default function ProductsLayout({ children }) {
  return <>{children}</>;
}
