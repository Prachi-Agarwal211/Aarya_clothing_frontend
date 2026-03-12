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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${playfair.variable}`}>
      <head>
        <link rel="preconnect" href="https://pub-7846c786f7154610b57735df47899fa0.r2.dev" />
        <link rel="dns-prefetch" href="https://api.aaryaclothing.com" />
      </head>
      <body className="relative font-sans">
        {/* Single centralized SilkBackground - GPU accelerated WebGL */}
        <SilkBackground />

        {/* Gradient Overlay - consistent across all pages */}
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#050203]/40 via-transparent to-[#050203]/90 pointer-events-none" />

        <ErrorBoundary>
          <AuthProvider>
            <CartProvider>
              <CartAnimationProvider>
                <SiteConfigProvider>
                  <ToastProvider>
                    {children}
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
