/**
 * Structured Data Helpers for SEO
 * Generates JSON-LD structured data for various schema types
 * All schemas follow Schema.org standards
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aaryaclothing.in';

/**
 * Generate BreadcrumbList structured data
 * @param {Array<{name: string, url: string}>} items - Breadcrumb items
 * @returns {object} JSON-LD structured data
 */
export function generateBreadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`
    }))
  };
}

/**
 * Generate ItemList structured data for collections/product lists
 * @param {Array} items - Product or collection items
 * @param {string} listType - Type of list (Product, Collection, etc.)
 * @returns {object} JSON-LD structured data
 */
export function generateItemListSchema(items, listType = 'Product') {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": items.slice(0, 50).map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": item.url || `${BASE_URL}/products/${item.slug || item.id}`,
      "item": {
        "@type": listType,
        "name": item.name,
        "image": item.primary_image || item.image_url,
        "description": item.description,
        ...(listType === 'Product' && {
          "offers": {
            "@type": "Offer",
            "price": item.price,
            "priceCurrency": "INR",
            "availability": item.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
          }
        })
      }
    })),
    "numberOfItems": items.length
  };
}

/**
 * Generate Product structured data
 * @param {object} product - Product data
 * @param {Array} reviews - Product reviews
 * @returns {object} JSON-LD structured data
 */
export function generateProductSchema(product, reviews = []) {
  const hasReviews = reviews && reviews.length > 0;
  const aggregateRating = hasReviews ? {
    "@type": "AggregateRating",
    "ratingValue": product.rating || product.average_rating || 0,
    "reviewCount": product.reviews_count || reviews.length,
    "bestRating": "5",
    "worstRating": "1"
  } : null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.primary_image || product.image_url,
    "sku": product.sku,
    "brand": {
      "@type": "Brand",
      "name": "Aarya Clothing"
    },
    "offers": {
      "@type": "Offer",
      "url": `${BASE_URL}/products/${product.slug || product.id}`,
      "priceCurrency": "INR",
      "price": product.price,
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Aarya Clothing"
      }
    },
    ...(aggregateRating && { "aggregateRating" }),
    "category": product.collection_name || product.category,
    "material": product.fabric,
    "color": product.colors?.[0]?.name || 'Multi-color',
    "size": product.sizes?.join(',') || 'One Size'
  };
}

/**
 * Generate AboutPage structured data
 * @param {object} pageData - Page metadata
 * @returns {object} JSON-LD structured data
 */
export function generateAboutPageSchema(pageData = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About Aarya Clothing - Our Story",
    "description": "Learn about Aarya Clothing's journey from Jaipur, bringing premium ethnic wear to customers across India since 2020.",
    "url": `${BASE_URL}/about`,
    "mainEntity": {
      "@type": "Organization",
      "name": "Aarya Clothing",
      "url": BASE_URL,
      "logo": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png",
      "description": "Premium ethnic wear brand specialising in handcrafted sarees, designer kurtis, and elegant lehengas.",
      "foundingDate": "2020",
      "foundingLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Jaipur",
          "addressRegion": "Rajasthan",
          "addressCountry": "IN"
        }
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Jaipur, Rajasthan",
        "addressLocality": "Jaipur",
        "addressRegion": "Rajasthan",
        "postalCode": "302001",
        "addressCountry": "IN"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+91-9876543210",
        "contactType": "customer service",
        "areaServed": "IN",
        "availableLanguage": ["en", "hi"]
      }
    },
    "lastReviewed": new Date().toISOString().split('T')[0],
    ...pageData
  };
}

/**
 * Generate ContactPage structured data
 * @param {object} contactData - Contact information
 * @returns {object} JSON-LD structured data
 */
export function generateContactPageSchema(contactData = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact Aarya Clothing",
    "description": "Get in touch with Aarya Clothing customer support. We're here to help with your orders, returns, and inquiries.",
    "url": `${BASE_URL}/contact`,
    "mainEntity": {
      "@type": "LocalBusiness",
      "name": "Aarya Clothing",
      "url": BASE_URL,
      "logo": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png",
      "image": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png",
      "telephone": "+91-9876543210",
      "email": "support@aaryaclothing.in",
      "priceRange": "₹₹",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Jaipur, Rajasthan",
        "addressLocality": "Jaipur",
        "addressRegion": "Rajasthan",
        "postalCode": "302001",
        "addressCountry": "IN"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "26.9124",
        "longitude": "75.7873"
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "opens": "10:00",
        "closes": "18:00"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+91-9876543210",
        "contactType": "customer service",
        "areaServed": "IN",
        "availableLanguage": ["en", "hi"],
        "contactOption": "TollFree"
      }
    },
    ...contactData
  };
}

/**
 * Generate Article structured data for policy pages
 * @param {object} articleData - Article metadata
 * @returns {object} JSON-LD structured data
 */
export function generateArticleSchema(articleData) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": articleData.title,
    "description": articleData.description,
    "url": articleData.url,
    "datePublished": articleData.datePublished || new Date().toISOString(),
    "dateModified": articleData.dateModified || new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": "Aarya Clothing",
      "url": BASE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": "Aarya Clothing",
      "url": BASE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": articleData.url
    },
    "articleBody": articleData.body || articleData.description,
    "wordCount": articleData.wordCount || 1000,
    ...articleData
  };
}

/**
 * Generate FAQPage structured data
 * @param {Array<{question: string, answer: string}>} faqs - FAQ items
 * @returns {object} JSON-LD structured data
 */
export function generateFAQSchema(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

/**
 * Generate Organization structured data
 * @returns {object} JSON-LD structured data
 */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Aarya Clothing",
    "url": BASE_URL,
    "logo": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png",
    "description": "Premium ethnic wear brand specialising in handcrafted sarees, designer kurtis, and elegant lehengas.",
    "slogan": "Timeless elegance for the modern soul",
    "foundingDate": "2020",
    "foundingLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Jaipur",
        "addressRegion": "Rajasthan",
        "addressCountry": "IN"
      }
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-9876543210",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["en", "hi"]
    },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Jaipur, Rajasthan",
      "addressLocality": "Jaipur",
      "addressRegion": "Rajasthan",
      "postalCode": "302001",
      "addressCountry": "IN"
    },
    "sameAs": [
      "https://www.instagram.com/aaryaclothing",
      "https://www.facebook.com/aaryaclothing"
    ]
  };
}

export default {
  generateBreadcrumbSchema,
  generateItemListSchema,
  generateProductSchema,
  generateAboutPageSchema,
  generateContactPageSchema,
  generateArticleSchema,
  generateFAQSchema,
  generateOrganizationSchema
};
