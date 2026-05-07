import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';
import { generateBreadcrumbSchema, generateItemListSchema } from '@/lib/structuredData';
import { collectionsApi } from '@/lib/customerApi';

// SEO Metadata
export const metadata = {
  title: 'Collections | Aarya Clothing - Curated Ethnic Wear Categories',
  description: 'Explore our carefully curated collections of premium ethnic wear. From elegant sarees to designer kurtis and beautiful lehengas - discover timeless elegance.',
  keywords: ['ethnic wear collections', 'saree collection', 'kurti designs', 'lehenga collection', 'Indian fashion', 'traditional wear', 'designer ethnic wear'],
  authors: [{ name: 'Aarya Clothing' }],
  creator: 'Aarya Clothing',
  publisher: 'Aarya Clothing',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://aaryaclothing.in/collections' },
  openGraph: {
    title: 'Collections | Aarya Clothing',
    description: 'Explore our carefully curated collections of premium ethnic wear.',
    url: 'https://aaryaclothing.in/collections',
    type: 'website',
    images: [{ url: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', width: 1200, height: 630, alt: 'Aarya Clothing Collections' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Collections | Aarya Clothing',
    description: 'Explore our carefully curated collections of premium ethnic wear.',
    images: ['https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png'],
  },
};

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Generate structured data
function generateStructuredData(categories) {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Collections', url: '/collections' }
  ]);
  
  const itemListSchema = generateItemListSchema(categories, 'Collection');
  
  return {
    breadcrumbSchema,
    itemListSchema
  };
}

// Fetch collections data server-side using direct fetch
async function getCollections() {
  try {
    const data = await collectionsApi.list();
    const items = Array.isArray(data) ? data : (data?.items || data?.collections || []);
    return items;
  } catch (error) {
    console.error('[Collections] API call failed:', error?.message || error);
    return [];
  }
}

export default async function CollectionsPage() {
  const categories = await getCollections();
  const { breadcrumbSchema, itemListSchema } = generateStructuredData(categories);

  return (
    <main className="min-h-screen text-[#EAE0D5] selection:bg-[#F2C29A] selection:text-[#050203]" role="main" aria-label="Collections">
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

      <div className="relative z-10 page-wrapper">
        <EnhancedHeader />
        
        <div className="page-content">
          <div className="container mx-auto px-4 sm:px-6 md:px-8 pt-16 md:pt-20">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-[#EAE0D5]/50 mb-4" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-[#F2C29A] transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
              <span className="text-[#EAE0D5]" aria-current="page">Collections</span>
            </nav>

            {/* Page Header */}
            <div className="max-w-4xl mx-auto mb-8 text-center">
              <h1
                className="text-4xl md:text-5xl lg:text-6xl text-[#F2C29A] mb-6"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Curated Collections
              </h1>
              <p
                className="text-[#EAE0D5]/70 text-lg md:text-xl max-w-2xl mx-auto"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Explore our carefully curated categories of premium ethnic wear, designed to bring timeless elegance to your wardrobe.
              </p>
            </div>

            {/* Collections Grid */}
            {categories.length === 0 ? (
              <div className="text-center py-20 bg-[#0B0608]/40 rounded-3xl border border-[#B76E79]/20" role="status">
                <p className="text-xl text-[#EAE0D5]/70">No collections available at the moment.</p>
                <Link
                  href="/"
                  className="inline-block mt-4 px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
                >
                  Return to Home
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/products?collection_id=${category.id}`}
                    className="group relative aspect-[4/5] rounded-3xl overflow-hidden block"
                    aria-label={`Browse ${category.name} products`}
                  >
                    <div className="absolute inset-0 bg-[#0B0608]/20 group-hover:bg-[#0B0608]/40 transition-colors z-10 duration-500" aria-hidden="true" />

                    {category.image_url ? (
                      <Image
                        src={category.image_url}
                        alt={category.name}
                        fill
                        className="object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        priority={category.id <= 3}
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1A1114] flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out">
                        <span className="text-[#B76E79]/30 text-lg tracking-widest uppercase">{category.name}</span>
                      </div>
                    )}

                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
                      <span className="text-[#F2C29A]/80 text-sm tracking-[0.2em] mb-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-100 uppercase">
                        Discover
                      </span>
                      <h3
                        className="text-3xl md:text-4xl text-white font-medium drop-shadow-lg"
                        style={{ fontFamily: 'Cinzel, serif' }}
                      >
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="mt-4 text-[#EAE0D5]/90 text-sm max-w-[80%] opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-200">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}
