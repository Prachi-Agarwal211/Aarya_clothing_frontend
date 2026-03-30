import './globals.css';
import { Cinzel, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '../lib/authContext';
import { CartProvider } from '../lib/cartContext';
import { SiteConfigProvider } from '../lib/siteConfigContext';
import CartDrawer from '../components/cart/CartDrawer';
import SilkBackground from '../components/SilkBackground';
import { ToastProvider } from '../components/ui/Toast';
import { CartAnimationProvider } from '../components/cart/CartAnimation';
import ErrorBoundary from '../components/ErrorBoundary';
import CustomerChatWidget from '../components/chat/CustomerChatWidget';
import BottomNavigation from '../components/common/BottomNavigation';
import WebVitalsInit from '../components/WebVitalsInit';
import { PerformanceOptimizations } from '../components/PerformanceOptimizations';

// Optimize font loading with next/font/google
// Preload only critical weights, use font-display: swap for performance
const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cinzel',
  preload: true,
  weight: ['400', '500', '600'],
  // Prevent layout shift by preconnecting to Google Fonts
  fallback: ['Georgia', 'serif'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  preload: true,
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  // Prevent layout shift by preconnecting to Google Fonts
  fallback: ['Times New Roman', 'serif'],
});

export const metadata = {
  title: {
    default: 'Aarya Clothing — Premium Ethnic Wear | Sarees, Kurtis, Lehengas',
    template: '%s | Aarya Clothing',
  },
  description: 'Shop premium ethnic wear at Aarya Clothing. Handcrafted sarees, designer kurtis, elegant lehengas. Free shipping across India.',
  keywords: ['ethnic wear', 'sarees', 'kurtis', 'lehengas', 'Indian fashion', 'traditional wear', 'handcrafted clothing', 'Indian designer wear'],
  authors: [{ name: 'Aarya Clothing' }],
  creator: 'Aarya Clothing',
  publisher: 'Aarya Clothing',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://aaryaclothing.in' },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F0ED' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0608' },
    { color: '#0B0608' },
  ],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://aaryaclothing.in',
    siteName: 'Aarya Clothing',
    title: 'Aarya Clothing — Premium Ethnic Wear',
    description: 'Handcrafted sarees, designer kurtis, elegant lehengas. Free shipping across India.',
    images: [{ url: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', width: 1200, height: 630, alt: 'Aarya Clothing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aarya Clothing — Premium Ethnic Wear',
    description: 'Handcrafted sarees, designer kurtis, elegant lehengas. Free shipping across India.',
    images: ['https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png'],
  },
  // Performance metadata
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${playfair.variable}`}>
      <head>
        <link rel="icon" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png" />
        <link rel="apple-touch-icon" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png" />
        
        {/* Performance: Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://checkout.razorpay.com" crossOrigin="anonymous" />
        
        {/* DNS Prefetch for external resources */}
        <link rel="dns-prefetch" href="https://aaryaclothing.in" />
        <link rel="dns-prefetch" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png" as="image" />
        
        {/* Preload critical fonts to prevent layout shift */}
        <link 
          rel="preload" 
          as="font" 
          href="https://fonts.gstatic.com/s/cinzel/v20/8vUv7XzY3xXJZvXXXXXXXXXX.woff2" 
          type="font/woff2" 
          crossOrigin="anonymous"
        />
        <link 
          rel="preload" 
          as="font" 
          href="https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbpjWBi2RF2Y.woff2" 
          type="font/woff2" 
          crossOrigin="anonymous"
        />
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Aarya Clothing",
            "url": "https://aaryaclothing.in",
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
            ],
            "brand": {
              "@type": "Brand",
              "name": "Aarya Clothing",
              "logo": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png"
            }
          })}}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "Aarya Clothing",
            "url": "https://aaryaclothing.in",
            "logo": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png",
            "image": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png",
            "description": "Premium ethnic wear brand specialising in handcrafted sarees, designer kurtis, and elegant lehengas with free shipping across India.",
            "telephone": "+91-9876543210",
            "email": "hello@aaryaclothing.in",
            "priceRange": "₹₹",
            "slogan": "Timeless elegance for the modern soul",
            "foundingDate": "2020",
            "@id": "https://aaryaclothing.in/#localbusiness",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Jaipur, Rajasthan",
              "addressLocality": "Jaipur",
              "addressRegion": "Rajasthan",
              "postalCode": "302001",
              "addressCountry": "IN",
              "areaServed": "IN"
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
              "closes": "18:00",
              "validFrom": "2020-01-01"
            },
            "contactPoint": {
              "@type": "ContactPoint",
              "telephone": "+91-9876543210",
              "contactType": "customer service",
              "areaServed": "IN",
              "availableLanguage": ["en", "hi"],
              "contactOption": "TollFree"
            },
            "sameAs": [
              "https://www.instagram.com/aaryaclothing",
              "https://www.facebook.com/aaryaclothing"
            ],
            "brand": {
              "@type": "Brand",
              "name": "Aarya Clothing",
              "logo": "https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png"
            },
            "makesOffer": {
              "@type": "Offer",
              "priceCurrency": "INR",
              "availability": "https://schema.org/InStock",
              "shippingDetails": {
                "@type": "OfferShippingDetails",
                "shippingRate": {
                  "@type": "MonetaryAmount",
                  "value": "0",
                  "currency": "INR"
                },
                "deliveryTime": {
                  "@type": "ShippingDeliveryTime",
                  "handlingTime": {
                    "@type": "QuantitativeValue",
                    "minValue": 1,
                    "maxValue": 2,
                    "unitCode": "DAY"
                  },
                  "transitTime": {
                    "@type": "QuantitativeValue",
                    "minValue": 3,
                    "maxValue": 7,
                    "unitCode": "DAY"
                  }
                }
              }
            }
          })}}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Aarya Clothing",
            "url": "https://aaryaclothing.in",
            "potentialAction": {
              "@type": "SearchAction",
              "target": { "@type": "EntryPoint", "urlTemplate": "https://aaryaclothing.in/search?q={search_term_string}" },
              "query-input": "required name=search_term_string"
            }
          })}}
        />
      </head>
      <body className="relative font-sans">
        {/* Performance Optimizations Component - handles service worker, critical CSS, etc. */}
        <PerformanceOptimizations />
        {/* Skip Links for Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[1000] focus:px-6 focus:py-3 focus:bg-[#0B0608] focus:text-[#F2C29A] focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F2C29A]/50 transition-all"
        >
          Skip to main content
        </a>
        <a
          href="#main-navigation"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[1000] focus:px-6 focus:py-3 focus:bg-[#0B0608] focus:text-[#F2C29A] focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F2C29A]/50 transition-all"
        >
          Skip to navigation
        </a>

        {/* Single centralized SilkBackground - GPU accelerated WebGL */}
        <SilkBackground />

        {/* Gradient Overlay - consistent across all pages */}
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#050203]/40 via-transparent to-[#050203]/90 pointer-events-none" aria-hidden="true" />

        <WebVitalsInit />
        <ErrorBoundary>
          <AuthProvider>
            <CartProvider>
              <CartAnimationProvider>
                <SiteConfigProvider>
                  <ToastProvider>
                    {/* Main landmark wrapper */}
                    <div className="relative z-10">
                      {children}
                    </div>
                    <CartDrawer />
                    <BottomNavigation />
                    <CustomerChatWidget />
                  </ToastProvider>
                </SiteConfigProvider>
              </CartAnimationProvider>
            </CartProvider>
          </AuthProvider>
        </ErrorBoundary>

        {/* Razorpay SDK - preload for faster checkout */}
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <Script id="clear-old-sw" strategy="afterInteractive">
          {`
            // Register service worker for offline support and caching
            if ('serviceWorker' in navigator) {
              // First, unregister any old service workers
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                regs.forEach(function(r) { 
                  // Only unregister if it's our old SW
                  if (r.scope.includes('/sw.js')) {
                    r.unregister(); 
                  }
                });
              });
              
              // Register new optimized service worker
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .then(function(registration) {
                    console.log('ServiceWorker registration successful:', registration.scope);
                  })
                  .catch(function(err) {
                    console.log('ServiceWorker registration failed:', err);
                  });
              });
            }
            
            // Performance: Monitor connection speed and adjust image quality
            if ('connection' in navigator) {
              const conn = navigator.connection;
              const isSlow = conn.saveData || 
                conn.effectiveType === '2g' || 
                conn.effectiveType === 'slow-2g' ||
                (conn.effectiveType === '3g' && conn.downlink < 1.5);
              
              if (isSlow) {
                document.documentElement.classList.add('slow-connection');
                console.log('Slow connection detected - enabling data saver mode');
              }
            }
          `}
        </Script>
      </body>
    </html>
  );
}
