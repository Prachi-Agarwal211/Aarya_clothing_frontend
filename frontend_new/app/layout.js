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
import { initWebVitals, observePerformance } from '../lib/webVitals';

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
  title: 'Aarya Clothing - Premium Ethnic Wear',
  description: 'Discover exquisite ethnic wear collections at Aarya Clothing. Premium quality sarees, kurtis, gowns, and more.',
  keywords: ['ethnic wear', 'sarees', 'kurtis', 'gowns', 'Indian fashion', 'traditional wear'],
  authors: [{ name: 'Aarya Clothing' }],
  creator: 'Aarya Clothing',
  publisher: 'Aarya Clothing',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Aarya Clothing',
  },
};

// Initialize Web Vitals monitoring on client side
if (typeof window !== 'undefined') {
  initWebVitals();
  observePerformance();
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${playfair.variable}`}>
      <head>
        <link rel="preconnect" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev" />
        <link rel="dns-prefetch" href="https://api.aaryaclothing.com" />
        <link rel="dns-prefetch" href="https://aaryaclothing.in" />
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
        
        {/* Cashfree JS SDK - preload for faster checkout */}
        <Script
          src="https://sdk.cashfree.com/js/v3/cashfree.js"
          strategy="lazyOnload"
        />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  },
                  function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
