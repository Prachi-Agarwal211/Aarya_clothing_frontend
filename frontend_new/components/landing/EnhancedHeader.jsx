'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingBag, User, Menu, X, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import { useLogo, useSiteConfig } from '@/lib/siteConfigContext';
import { gsap } from '@/lib/gsapConfig';

// Static navigation links — anchor IDs on the landing page
const NAV_LINKS = [
  { name: 'New Arrivals', href: '/#new-arrivals', anchor: '#new-arrivals' },
  { name: 'Collections', href: '/#collections', anchor: '#collections' },
  { name: 'Shop with AI ✦', href: '/ai', anchor: null, highlight: true },
  { name: 'About', href: '/#about', anchor: '#about' },
  { name: 'Contact', href: '/#footer', anchor: '#footer' },
];

/**
 * Debounce hook for search input
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * EnhancedHeader - Header with glass effect and logo image
 * 
 * Features:
 * - Logo image from auth pages (optimized with Next.js Image)
 * - Glass morphism effect when scrolled
 * - Smooth GSAP scroll to anchor sections on the landing page
 * - Mobile responsive menu
 * - Cart integration with item count
 * - Performance optimized with throttled scroll handler
 * - Debounced search input
 */
const EnhancedHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { itemCount, toggleCart } = useCart();
  const { isAuthenticated } = useAuth();
  const tickingRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();

  // Get logo URL and noise texture from backend via context
  const logoUrl = useLogo();
  const { noise } = useSiteConfig();

  // Is the user currently on the landing page?
  const isLandingPage = pathname === '/';

  // Throttled scroll handler using requestAnimationFrame
  useEffect(() => {
    const handleScroll = () => {
      if (!tickingRef.current) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 50);
          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle debounced search query (can be used for API calls)
  useEffect(() => {
    if (debouncedSearchQuery) {
      // Trigger search API call here when backend is integrated
    }
  }, [debouncedSearchQuery]);

  /**
   * Smooth scroll to an anchor section on the landing page.
   * If we're already on the landing page, GSAP scrolls directly.
   * If on another page, navigate to / first and let the hash trigger scroll.
   */
  const handleNavClick = useCallback((e, link) => {
    if (isLandingPage && link.anchor) {
      e.preventDefault();
      const target = document.querySelector(link.anchor);
      if (target) {
        const isMobile = window.innerWidth < 768;
        gsap.to(window, {
          scrollTo: { y: target, offsetY: isMobile ? 60 : 80 },
          duration: 1,
          ease: 'power3.inOut',
        });
        window.history.pushState(null, '', link.anchor);
      }
    }
    // If not on landing page, default <Link> navigation to /#anchor handles it
  }, [isLandingPage]);

  /**
   * Handle cart click - redirect guest to login
   */
  const handleCartClick = useCallback(() => {
    if (isAuthenticated) {
      toggleCart();
    } else {
      router.push(`/auth/login?redirect_url=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, toggleCart, router, pathname]);

  // Memoize navLinks reference
  const navLinks = NAV_LINKS;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 w-full z-[100] transition-all duration-500",
          isScrolled
            ? "py-2"
            : "py-3"
        )}
      >
        {/* Glass Background - only visible when scrolled */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-500",
            isScrolled
              ? "bg-[#0B0608]/60 backdrop-blur-md border-b border-[#B76E79]/10"
              : "bg-transparent border-b border-transparent"
          )}
        />

        <div className="container mx-auto px-4 md:px-8 relative z-10">
          <div className="flex items-center justify-between">
            {/* Logo - Using Next.js Image for optimization */}
            <Link href="/" className="relative z-50 group flex items-center">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Aarya Clothing"
                  width={80}
                  height={80}
                  priority
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.25)] group-hover:drop-shadow-[0_0_25px_rgba(242,194,154,0.4)] transition-all duration-300"
                />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                  AARYA
                </span>
              )}
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  scroll={false}
                  onClick={(e) => handleNavClick(e, link)}
                  className={`relative text-sm font-medium transition-colors duration-300 py-2 group ${link.highlight
                      ? 'text-[#F2C29A] hover:text-white px-3 py-1.5 rounded-full bg-gradient-to-r from-[#7A2F57]/40 to-[#B76E79]/30 border border-[#B76E79]/40 hover:border-[#B76E79]/70'
                      : 'text-[#EAE0D5]/80 hover:text-[#F2C29A]'
                    }`}
                >
                  {link.name}
                  {!link.highlight && (
                    <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-[#F2C29A] transition-all duration-300 group-hover:w-full" />
                  )}
                </Link>
              ))}
            </nav>

            {/* Action Icons */}
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    router.push('/profile/wishlist');
                  } else {
                    router.push('/auth/login?redirect_url=/profile/wishlist');
                  }
                }}
                className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300"
              >
                <Heart className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    router.push('/profile');
                  } else {
                    router.push('/auth/login?redirect_url=/profile');
                  }
                }}
                className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300"
              >
                <User className="w-5 h-5" />
              </button>
              <input
                key="search-input"
                suppressHydrationWarning
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                className="w-full px-4 py-2 bg-transparent border border-[#3D322C] rounded-lg text-[#EAE0D5] placeholder-[#8B7D77] focus:outline-none focus:border-[#F2C29A] transition-all duration-300"
              />
              <button
                key="cart-button"
                suppressHydrationWarning
                onClick={handleCartClick}
                className="relative text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300 group"
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#7A2F57] text-[#EAE0D5] text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden relative z-50 text-[#EAE0D5] hover:text-[#F2C29A]"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[90] flex flex-col items-center justify-center transition-all duration-500 md:hidden",
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        {/* Glass Background */}
        <div className="absolute inset-0 bg-[#0B0608]/95 backdrop-blur-lg" />

        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `url('${noise}')` }} />

        {/* Mobile Logo */}
        <div className="relative z-10 mb-12">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Aarya Clothing"
              width={80}
              height={80}
              className="w-20 h-20 object-contain drop-shadow-[0_0_15px_rgba(242,194,154,0.25)]"
            />
          ) : (
            <span className="text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
              AARYA
            </span>
          )}
        </div>

        <nav className="relative z-10 flex flex-col items-center gap-8">
          {navLinks.map((link, index) => (
            <Link
              key={link.name}
              href={link.href}
              scroll={false}
              className="text-2xl text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300"
              style={{ fontFamily: 'Cinzel, serif', transitionDelay: `${index * 100}ms` }}
              onClick={(e) => {
                setIsMobileMenuOpen(false);
                handleNavClick(e, link);
              }}
            >
              {link.name}
            </Link>
          ))}
          <div className="flex gap-8 mt-8">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (isAuthenticated) {
                  router.push('/profile/wishlist');
                } else {
                  router.push('/auth/login?redirect_url=/profile/wishlist');
                }
              }}
              className="text-[#EAE0D5] hover:text-[#F2C29A]"
            >
              <Heart className="w-6 h-6" />
            </button>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (isAuthenticated) {
                  router.push('/profile');
                } else {
                  router.push('/auth/login?redirect_url=/profile');
                }
              }}
              className="text-[#EAE0D5] hover:text-[#F2C29A]"
            >
              <User className="w-6 h-6" />
            </button>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleCartClick();
              }}
              className="relative text-[#EAE0D5] hover:text-[#F2C29A]"
            >
              <ShoppingBag className="w-6 h-6" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#7A2F57] text-[#EAE0D5] text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>
          </div>
        </nav>
      </div>
    </>
  );
};

export default EnhancedHeader;
