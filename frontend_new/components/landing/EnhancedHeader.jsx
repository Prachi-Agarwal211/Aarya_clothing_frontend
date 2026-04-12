'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingBag, User, Menu, X, Heart, LayoutDashboard } from 'lucide-react';
import { getRedirectForRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import { useLogo, useSiteConfig } from '@/lib/siteConfigContext';
import { gsap } from '@/lib/gsapConfig';

// Static navigation links — anchor IDs on the landing page
const NAV_LINKS = [
  { name: 'New Arrivals', href: '/#new-arrivals', anchor: '#new-arrivals' },
  { name: 'Collections', href: '/#collections', anchor: '#collections' },
  { name: 'Products', href: '/products', anchor: null },
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
 * Accessibility Features:
 * - Semantic HTML with <header> and <nav> landmarks
 * - ARIA labels for navigation and buttons
 * - Keyboard navigation support
 * - Focus management for mobile menu
 * - Screen reader announcements
 * 
 * Performance Features:
 * - Throttled scroll handler
 * - Debounced search input
 * - Optimized re-renders
 */
const EnhancedHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { itemCount, toggleCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const tickingRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const mobileMenuButtonRef = useRef(null);
  const firstNavItemRef = useRef(null);

  // Get logo URL and noise texture from backend via context
  const logoUrl = useLogo();
  const { noise } = useSiteConfig();

  // Is the user currently on the landing page?
  const isLandingPage = pathname === '/';

  // Trap focus in mobile menu when open
  useEffect(() => {
    if (isMobileMenuOpen) {
      // Focus first nav item when menu opens
      firstNavItemRef.current?.focus();
      
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = 'hidden';
    } else {
      // Return focus to menu button when closed
      mobileMenuButtonRef.current?.focus();
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Handle Escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

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

  // Search query is submitted manually via Enter key or button click.
  // The debounced value is used for potential autocomplete in the future,
  // but we do NOT auto-navigate on debounce to avoid rapid route changes.

  /**
   * Submit search — navigates to search page.
   */
  const handleSearchSubmit = useCallback((query) => {
    const trimmed = (query || searchQuery).trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      setSearchQuery('');
    }
  }, [searchQuery, router]);

  /**
   * Smooth scroll to an anchor section on the landing page.
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

  // Toggle mobile menu with keyboard support
  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev);
  }, []);

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
        role="banner"
        aria-label="Main header"
      >
        {/* Glass Background - only visible when scrolled */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-500",
            isScrolled
              ? "bg-[#0B0608]/60 backdrop-blur-md border-b border-[#B76E79]/10"
              : "bg-transparent border-b border-transparent"
          )}
          aria-hidden="true"
        />

        <div className="container mx-auto px-4 md:px-8 relative z-10">
          <div className="flex items-center justify-between">
            {/* Logo - Using Next.js Image for optimization */}
            <Link 
              href="/" 
              className="relative z-50 group flex items-center"
              aria-label="Aarya Clothing - Go to homepage"
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Aarya Clothing Logo"
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
            <nav 
              id="main-navigation"
              className="hidden md:flex items-center gap-8" 
              aria-label="Main navigation"
              role="navigation"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  scroll={false}
                  onClick={(e) => handleNavClick(e, link)}
                  className={`relative text-sm font-medium transition-colors duration-300 py-2 group nav-link ${link.highlight
                      ? 'text-[#F2C29A] hover:text-white px-3 py-1.5 rounded-full bg-gradient-to-r from-[#7A2F57]/40 to-[#B76E79]/30 border border-[#B76E79]/40 hover:border-[#B76E79]/70'
                      : 'text-[#EAE0D5]/80 hover:text-[#F2C29A]'
                    }`}
                  aria-current={link.name === 'New Arrivals' ? 'page' : undefined}
                >
                  {link.name}
                  {!link.highlight && (
                    <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-[#F2C29A] transition-all duration-300 group-hover:w-full" aria-hidden="true" />
                  )}
                </Link>
              ))}
            </nav>

            {/* Action Icons */}
            <div className="hidden md:flex items-center gap-6" role="navigation" aria-label="Account and cart actions">
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    router.push('/profile/wishlist');
                  } else {
                    router.push('/auth/login?redirect_url=/profile/wishlist');
                  }
                }}
                className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300"
                aria-label={isAuthenticated ? 'View wishlist' : 'Sign in to view wishlist'}
                type="button"
              >
                <Heart className="w-5 h-5" aria-hidden="true" />
              </button>
              {isAuthenticated ? (
                <>
                  {user?.role && user.role !== 'customer' && (
                    <button
                      onClick={() => router.push(getRedirectForRole(user.role))}
                      className="flex items-center gap-1.5 text-[#F2C29A] hover:text-white text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border border-[#B76E79]/50 hover:border-[#F2C29A]/70 hover:bg-[#7A2F57]/20 transition-all duration-300"
                      aria-label={`Go to ${user.role.replace('_', ' ')} dashboard`}
                      type="button"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                      Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/profile')}
                    className="text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300"
                    aria-label="View profile"
                    type="button"
                  >
                    <User className="w-5 h-5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <a
                  href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
                  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
                >
                  Sign In
                </a>
              )}
              <div className="relative">
                <label htmlFor="search-input" className="sr-only">
                  Search products
                </label>
              <input
                  id="search-input"
                  suppressHydrationWarning
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchSubmit();
                    }
                  }}
                  className="w-full px-4 py-2 bg-transparent border border-[#3D322C] rounded-lg text-[#EAE0D5] placeholder-[#8B7D77] focus:outline-none focus:border-[#F2C29A] transition-all duration-300"
                  aria-label="Search products"
                />
              </div>
              <button
                id="cart-button"
                suppressHydrationWarning
                onClick={handleCartClick}
                className="relative text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300 group"
                aria-label={`Shopping cart with ${itemCount} items`}
                type="button"
              >
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                {itemCount > 0 && (
                  <span 
                    className="absolute -top-2 -right-2 bg-[#7A2F57] text-[#EAE0D5] text-[10px] w-4 h-4 rounded-full flex items-center justify-center"
                    aria-label={`${itemCount} items in cart`}
                  >
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              ref={mobileMenuButtonRef}
              className="md:hidden relative z-50 text-[#EAE0D5] hover:text-[#F2C29A] min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={toggleMobileMenu}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              type="button"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-0 z-[90] flex flex-col items-center justify-center transition-all duration-400 md:hidden",
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto translate-y-0"
            : "opacity-0 pointer-events-none translate-y-4"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        hidden={!isMobileMenuOpen}
      >
        {/* Glass Background */}
        <div 
          className="absolute inset-0 bg-[#0B0608]/95 backdrop-blur-lg" 
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />

        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `url('${noise}')` }} aria-hidden="true" />

        {/* Mobile Logo */}
        <div className="relative z-10 mb-12">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Aarya Clothing Logo"
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

        <nav 
          className="relative z-10 flex flex-col items-center gap-8" 
          role="navigation"
          aria-label="Mobile navigation"
        >
          {navLinks.map((link, index) => (
            <Link
              key={link.name}
              href={link.href}
              scroll={false}
              ref={index === 0 ? firstNavItemRef : null}
              className="text-2xl text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300 nav-link"
              style={{ fontFamily: 'Cinzel, serif', transitionDelay: `${index * 100}ms` }}
              onClick={(e) => {
                setIsMobileMenuOpen(false);
                handleNavClick(e, link);
              }}
            >
              {link.name}
              </Link>
          ))}

          {/* Mobile Search Input */}
          <div className="w-full max-w-xs mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B7D77]" />
              <input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    handleSearchSubmit();
                  }
                }}
                className="w-full pl-10 pr-4 py-3 bg-[#0B0608]/60 border border-[#3D322C] rounded-xl text-[#EAE0D5] placeholder-[#8B7D77] focus:outline-none focus:border-[#F2C29A] transition-all duration-300 text-base"
                aria-label="Search products"
              />
            </div>
          </div>
          <div className="flex gap-8 mt-8" role="navigation" aria-label="Mobile account actions">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (isAuthenticated) {
                  router.push('/profile/wishlist');
                } else {
                  router.push('/auth/login?redirect_url=/profile/wishlist');
                }
              }}
              className="text-[#EAE0D5] hover:text-[#F2C29A] min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={isAuthenticated ? 'View wishlist' : 'Sign in to view wishlist'}
              type="button"
            >
              <Heart className="w-6 h-6" aria-hidden="true" />
            </button>
            {isAuthenticated ? (
              <>
                {user?.role && user.role !== 'customer' && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      router.push(getRedirectForRole(user.role));
                    }}
                    className="flex items-center gap-1.5 text-[#F2C29A] hover:text-white text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border border-[#B76E79]/50 hover:border-[#F2C29A]/70 hover:bg-[#7A2F57]/20 transition-all duration-300 min-h-[44px]"
                    aria-label={`Go to ${user.role.replace('_', ' ')} dashboard`}
                    type="button"
                  >
                    <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                    Dashboard
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push('/profile');
                  }}
                  className="text-[#EAE0D5] hover:text-[#F2C29A] min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="View profile"
                  type="button"
                >
                  <User className="w-6 h-6" aria-hidden="true" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 mt-2">
                <a
                  href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-xl transition-colors duration-300"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  Sign In
                </a>
              </div>
            )}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleCartClick();
              }}
              className="relative text-[#EAE0D5] hover:text-[#F2C29A] min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={`Shopping cart with ${itemCount} items`}
              type="button"
            >
              <ShoppingBag className="w-6 h-6" aria-hidden="true" />
              {itemCount > 0 && (
                <span 
                  className="absolute -top-2 -right-2 bg-[#7A2F57] text-[#EAE0D5] text-xs w-5 h-5 rounded-full flex items-center justify-center"
                  aria-label={`${itemCount} items in cart`}
                >
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
