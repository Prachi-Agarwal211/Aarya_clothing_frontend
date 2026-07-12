'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingBag, User, Menu, X, LayoutDashboard, LogOut } from 'lucide-react';
import SearchAutocomplete from '@/components/search/SearchAutocomplete';
import { getRedirectForRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import { useLogo, useSiteConfig } from '@/lib/siteConfigContext';
import { gsap, prefersReducedMotion } from '@/lib/gsapConfig';

// Static navigation links — anchor IDs on the landing page
const NAV_LINKS = [
  { name: 'New Arrivals', href: '/#new-arrivals', anchor: '#new-arrivals' },
  { name: 'Collections', href: '/#collections', anchor: '#collections' },
  { name: 'Products', href: '/products', anchor: null },
  { name: 'About', href: '/#about', anchor: '#about' },
  { name: 'Contact', href: '/#footer', anchor: '#footer' },
];

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
  const [activeSection, setActiveSection] = useState(null);
  const { itemCount, toggleCart } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
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
  // Product / catalog / checkout pages: always solid glass header so content
  // never clashes under a transparent bar (PDP header/content overlap fix).
  const forceSolidHeader =
    !isLandingPage &&
    (pathname?.startsWith('/products') ||
      pathname?.startsWith('/cart') ||
      pathname?.startsWith('/checkout') ||
      pathname?.startsWith('/search') ||
      pathname?.startsWith('/profile') ||
      pathname?.startsWith('/orders') ||
      pathname?.startsWith('/collections') ||
      pathname?.startsWith('/auth'));

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

          // Section-aware highlighting — find which anchor section is in view
          const anchors = ['new-arrivals', 'collections', 'about', 'footer'];
          let current = null;
          for (const id of anchors) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= 150) current = `#${id}`;
            }
          }
          setActiveSection(current);

          tickingRef.current = false;
        });
        tickingRef.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /**
   * Smooth scroll to an anchor section on the landing page.
   */
  const handleNavClick = useCallback((e, link) => {
    if (isLandingPage && link.anchor) {
      e.preventDefault();
      const target = document.querySelector(link.anchor);
      if (target) {
        const isMobile = window.innerWidth < 768;
        const reduce = prefersReducedMotion();
        gsap.to(window, {
          scrollTo: { y: target, offsetY: isMobile ? 60 : 80 },
          duration: reduce ? 0.01 : 1,
          ease: reduce ? 'none' : 'power3.inOut',
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

  const solid = isScrolled || forceSolidHeader;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 w-full z-[100] transition-all duration-500",
          solid ? "py-2" : "py-3"
        )}
        role="banner"
        aria-label="Main header"
        data-solid={solid ? 'true' : 'false'}
      >
        {/* Glass matte bar — always solid on PDP/catalog so content never shows through */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-500",
            solid
              ? "bg-[#0D0D0D]/92 backdrop-blur-md border-b border-white/[0.06]"
              : "bg-transparent border-b border-transparent"
          )}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 relative z-10">
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
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain transition-all duration-300"
                />
              ) : (
                <span className="text-xl sm:text-2xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Cinzel, serif' }}>
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
                      ? 'text-[#D4AF37] hover:text-white px-3 py-1.5 rounded-full bg-gradient-to-r from-[#1E3A5F]/40 to-[#A8B4C8]/30 border border-[#A8B4C8]/40 hover:border-[#A8B4C8]/70'
                      : activeSection === link.anchor
                        ? 'text-[#D4AF37]'
                        : 'text-[#F5F0E8]/80 hover:text-[#D4AF37]'
                    }`}
                  aria-current={link.name === 'New Arrivals' ? 'page' : undefined}
                >
                  {link.name}
                  {!link.highlight && (
                    <span className={`absolute bottom-0 left-0 h-[1px] bg-[#D4AF37] transition-all duration-300 ${activeSection === link.anchor ? 'w-full' : 'w-0 group-hover:w-full'}`} aria-hidden="true" />
                  )}
                </Link>
              ))}
            </nav>

            {/* Action Icons */}
            <div className="hidden md:flex items-center gap-6" role="navigation" aria-label="Account and cart actions">
              {isAuthenticated ? (
                <>
                  {user?.role && user.role !== 'customer' && (
                    <button
                      onClick={() => router.push(getRedirectForRole(user.role))}
                      className="flex items-center gap-1.5 text-[#D4AF37] hover:text-white text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border border-[#A8B4C8]/50 hover:border-[#D4AF37]/70 hover:bg-[#1E3A5F]/20 transition-all duration-300"
                      aria-label={`Go to ${user.role.replace('_', ' ')} dashboard`}
                      type="button"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                      Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/profile')}
                    className="text-[#F5F0E8] hover:text-[#D4AF37] transition-colors duration-300"
                    aria-label="View profile"
                    type="button"
                  >
                    <User className="w-5 h-5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    window.location.href = `/auth/login?redirect_url=${encodeURIComponent(pathname)}`;
                  }}
                  className="text-[#F5F0E8]/80 hover:text-[#D4AF37] text-sm font-medium transition-colors duration-300 flex items-center"
                  type="button"
                >
                  Sign In
                </button>
              )}
              <div className="relative w-64">
                <SearchAutocomplete
                  placeholder="Search..."
                  onSearchSelect={(item) => {
                    if (item.type === 'product') {
                      router.push(`/products/${item.slug || item.id}`);
                    } else if (item.type === 'category') {
                      router.push(`/products?collection_id=${item.id}`);
                    } else if (item.type === 'search') {
                      router.push(`/search?q=${encodeURIComponent(item.query)}`);
                    }
                  }}
                />
              </div>
              <button
                id="cart-button"
                suppressHydrationWarning
                onClick={handleCartClick}
                className="relative text-[#F5F0E8] hover:text-[#D4AF37] transition-colors duration-300 group"
                aria-label={`Shopping cart with ${itemCount} items`}
                type="button"
              >
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                {itemCount > 0 && (
                  <span 
                    className="absolute -top-2 -right-2 bg-[#1E3A5F] text-[#F5F0E8] text-[10px] w-4 h-4 rounded-full flex items-center justify-center"
                    aria-label={`${itemCount} items in cart`}
                  >
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center">
              <button
                id="cart-button-mobile"
                suppressHydrationWarning
                onClick={handleCartClick}
                className="relative text-[#F5F0E8] hover:text-[#D4AF37] transition-colors duration-300 min-h-[44px] min-w-[44px] flex items-center justify-center mr-1"
                aria-label={`Shopping cart with ${itemCount} items`}
                type="button"
              >
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                {itemCount > 0 && (
                  <span 
                    className="absolute top-1 right-1 bg-[#1E3A5F] text-[#F5F0E8] text-[10px] w-4 h-4 rounded-full flex items-center justify-center"
                    aria-label={`${itemCount} items in cart`}
                  >
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
              <button
                ref={mobileMenuButtonRef}
                className="relative z-50 text-[#F5F0E8] hover:text-[#D4AF37] min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-0 z-[95] flex flex-col items-center justify-center transition-all duration-400 md:hidden",
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
          className="absolute inset-0 bg-[#111111]/95 backdrop-blur-lg" 
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
              className="w-20 h-20 object-contain"
            />
          ) : (
            <span className="text-3xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Cinzel, serif' }}>
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
              className="text-2xl text-[#F5F0E8] hover:text-[#D4AF37] transition-colors duration-300 nav-link mobile-menu-item-enter"
              style={{ fontFamily: 'Cinzel, serif', animationDelay: `${index * 60}ms` }}
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
            <SearchAutocomplete
              placeholder="Search products..."
              onSearchSelect={(item) => {
                setIsMobileMenuOpen(false);
                if (item.type === 'product') {
                  router.push(`/products/${item.slug || item.id}`);
                } else if (item.type === 'category') {
                  router.push(`/products?collection_id=${item.id}`);
                } else if (item.type === 'search') {
                  router.push(`/search?q=${encodeURIComponent(item.query)}`);
                }
              }}
            />
          </div>
          <div className="flex gap-8 mt-8" role="navigation" aria-label="Mobile account actions">
            {isAuthenticated ? (
              <>
                {user?.role && user.role !== 'customer' && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      router.push(getRedirectForRole(user.role));
                    }}
                    className="flex items-center gap-1.5 text-[#D4AF37] hover:text-white text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border border-[#A8B4C8]/50 hover:border-[#D4AF37]/70 hover:bg-[#1E3A5F]/20 transition-all duration-300 min-h-[44px]"
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
                  className="text-[#F5F0E8] hover:text-[#D4AF37] min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="View profile"
                  type="button"
                >
                  <User className="w-6 h-6" aria-hidden="true" />
                </button>
                {/* Mobile Logout */}
                <button
                  onClick={async () => {
                    setIsMobileMenuOpen(false);
                    await logout();
                    router.push('/');
                  }}
                  className="text-[#A8B4C8] hover:text-[#D4AF37] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors duration-300"
                  aria-label="Logout"
                  type="button"
                >
                  <LogOut className="w-6 h-6" aria-hidden="true" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 mt-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    window.location.href = `/auth/login?redirect_url=${encodeURIComponent(pathname)}`;
                  }}
                  className="text-[#F5F0E8]/80 hover:text-[#D4AF37] text-xl transition-colors duration-300"
                  style={{ fontFamily: 'Cinzel, serif' }}
                  type="button"
                >
                  Sign In
                </button>
              </div>
            )}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleCartClick();
              }}
              className="relative text-[#F5F0E8] hover:text-[#D4AF37] min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={`Shopping cart with ${itemCount} items`}
              type="button"
            >
              <ShoppingBag className="w-6 h-6" aria-hidden="true" />
              {itemCount > 0 && (
                <span 
                  className="absolute -top-2 -right-2 bg-[#1E3A5F] text-[#F5F0E8] text-xs w-5 h-5 rounded-full flex items-center justify-center"
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
