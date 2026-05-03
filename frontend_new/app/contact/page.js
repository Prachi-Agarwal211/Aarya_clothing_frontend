import { generateContactPageSchema, generateBreadcrumbSchema } from '@/lib/structuredData';
import ContactPageClient from './ContactPageClient';

// SEO Metadata
export const metadata = {
  title: 'Contact Us | Aarya Clothing - Get in Touch',
  description: 'Contact Aarya Clothing customer support. We\'re here to help with your orders, returns, and inquiries. Chat live, email, or call us.',
  keywords: ['contact Aarya Clothing', 'customer support', 'contact us', 'customer service', 'help desk', 'ethnic wear support'],
  authors: [{ name: 'Aarya Clothing' }],
  creator: 'Aarya Clothing',
  publisher: 'Aarya Clothing',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://aaryaclothing.in/contact' },
  openGraph: {
    title: 'Contact Us | Aarya Clothing',
    description: 'Get in touch with Aarya Clothing customer support. We\'re here to help with your orders and inquiries.',
    url: 'https://aaryaclothing.in/contact',
    type: 'website',
    images: [{ url: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', width: 1200, height: 630, alt: 'Aarya Clothing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Us | Aarya Clothing',
    description: 'Get in touch with Aarya Clothing customer support. We\'re here to help with your orders and inquiries.',
    images: ['https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png'],
  },
};

// Generate structured data
function generateStructuredData() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Contact Us', url: '/contact' }
  ]);

  const contactPageSchema = generateContactPageSchema();

  return {
    breadcrumbSchema,
    contactPageSchema
  };
}

export default function ContactPage() {
  const { breadcrumbSchema, contactPageSchema } = generateStructuredData();

  return (
    <main className="min-h-screen text-[#EAE0D5] page-wrapper" role="main" aria-label="Contact Us">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        key="breadcrumb-schema"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }}
        key="contact-schema"
      />
      
      <ContactPageClient breadcrumbSchema={breadcrumbSchema} contactPageSchema={contactPageSchema} />
    </main>
  );
}
