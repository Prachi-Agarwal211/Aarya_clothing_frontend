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

export default function ProductsLayout({ children }) {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Products', item: `${BASE_URL}/products` },
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
