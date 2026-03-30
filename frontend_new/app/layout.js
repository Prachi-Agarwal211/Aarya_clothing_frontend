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

// Optimize font loading with next/font/google
const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cinzel',
  preload: true,
  weight: ['400', '500', '600'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  preload: true,
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${playfair.variable}`}>
      <head>
        <link rel="icon" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png" />
        <link rel="apple-touch-icon" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png" />
        <link rel="preconnect" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev" />
        <link rel="dns-prefetch" href="https://aaryaclothing.in" />
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
              "addressLocality": "Jaipur",
              "addressRegion": "Rajasthan",
              "addressCountry": "IN"
            },
            "sameAs": [
              "https://www.instagram.com/aaryaclothing",
              "https://www.facebook.com/aaryaclothing"
            ]
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
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                regs.forEach(function(r) { r.unregister(); });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
