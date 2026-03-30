export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products', '/products/', '/collections', '/collections/', '/about', '/contact', '/faq', '/new-arrivals', '/search', '/shipping', '/returns', '/privacy', '/terms', '/payment-policy'],
        disallow: ['/admin/', '/profile/', '/cart', '/checkout/', '/auth/', '/api/', '/ai'],
      },
    ],
    sitemap: 'https://aaryaclothing.in/sitemap.xml',
  };
}
