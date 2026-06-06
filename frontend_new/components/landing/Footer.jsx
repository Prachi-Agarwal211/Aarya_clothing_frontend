'use client';

import Link from 'next/link';
import { Facebook, Instagram } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Footer - Client Component for newsletter form interaction
 *
 * Features:
 * - Client Component (required for form onSubmit handler)
 * - Accessible navigation with ARIA labels
 * - No black background (uses SilkBackground from layout)
 * - Glass card effect for container
 * - Consistent styling with other sections
 */

export default function Footer({ id }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      id={id}
      className="py-8 sm:py-10 relative"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        {/* Glass Container */}
        <div
          className="
            relative rounded-3xl p-6 sm:p-8 md:p-10
            bg-[#0B0608]/40 backdrop-blur-md
            border border-[#B76E79]/15
            shadow-[0_8px_32px_rgba(0,0,0,0.3)]
          "
        >
          {/* Top Section - Mobile: 2 columns, Tablet: 2 columns, Desktop: 4 columns */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 relative z-10">

            {/* Brand - Full width on mobile, spans 2 columns on tablet */}
            <div className="col-span-2 sm:col-span-2 lg:col-span-1 space-y-4 sm:space-y-6">
              <h2
                className="text-2xl sm:text-3xl tracking-wider text-[#F2C29A]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                AARYA
              </h2>
              <p
                className="text-[#EAE0D5]/70 text-xs sm:text-sm leading-relaxed"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Timeless elegance for the modern soul. Designed with passion, crafted with care, and worn with confidence.
              </p>
              <nav aria-label="Social media links">
                <div className="flex gap-3 sm:gap-4">
                  <a
                    href="https://www.instagram.com/aaryaclothing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center border border-[#F2C29A]/30 rounded-full hover:bg-[#F2C29A] hover:text-[#050203] transition-all duration-300 text-[#EAE0D5]"
                    aria-label="Follow us on Instagram"
                  >
                    <Instagram className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                  </a>
                  <a
                    href="https://www.facebook.com/aaryaclothing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center border border-[#F2C29A]/30 rounded-full hover:bg-[#F2C29A] hover:text-[#050203] transition-all duration-300 text-[#EAE0D5]"
                    aria-label="Follow us on Facebook"
                  >
                    <Facebook className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                  </a>
                  <a
                    href="https://wa.me/919876543210"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center border border-[#F2C29A]/30 rounded-full hover:bg-[#F2C29A] hover:text-[#050203] transition-all duration-300 text-[#EAE0D5]"
                    aria-label="Chat with us on WhatsApp"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                </div>
              </nav>
            </div>

            {/* Quick Links */}
            <nav aria-label="Explore links">
              <div className="space-y-2">
                <h3
                  className="text-sm sm:text-lg text-[#EAE0D5] font-semibold"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  Explore
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-[#EAE0D5]/70">
                  {[
                    { name: 'New Arrivals', href: '/#new-arrivals' },
                    { name: 'Collections', href: '/collections' },
                    { name: 'Our Story', href: '/#about' }
                  ].map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="hover:text-[#F2C29A] transition-colors flex items-center gap-2 group"
                      >
                        <span className="w-0 group-hover:w-2 h-[1px] bg-[#F2C29A] transition-all duration-300" aria-hidden="true" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            {/* Customer Care */}
            <nav aria-label="Customer care links">
              <div className="space-y-2">
                <h3
                  className="text-sm sm:text-lg text-[#EAE0D5] font-semibold"
                  style={{ fontFamily: 'Cinzel, serif' }}
                >
                  Customer Care
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-[#EAE0D5]/70">
                  {[
                    { name: 'Contact Us', href: '/contact' },
                    { name: 'Shipping Policy', href: '/shipping' },
                    { name: 'Returns & Refunds', href: '/returns' },
                    { name: 'FAQ', href: '/faq' }
                  ].map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="hover:text-[#F2C29A] transition-colors flex items-center gap-2 group"
                      >
                        <span className="w-0 group-hover:w-2 h-[1px] bg-[#F2C29A] transition-all duration-300" aria-hidden="true" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            {/* Newsletter */}
            <div className="space-y-2 sm:space-y-3">
              <h3
                className="text-sm sm:text-lg text-[#EAE0D5] font-semibold"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Stay Updated
              </h3>
              <p className="hidden md:block text-xs sm:text-sm text-[#EAE0D5]/70 leading-relaxed">
                Subscribe to receive updates, access to exclusive deals, and more.
              </p>
              <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                <div className="relative">
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address for newsletter
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    placeholder="Enter your email"
                    className="
                      w-full h-11 sm:h-10 px-4 sm:px-5
                      bg-[#0B0608]/40 backdrop-blur-md
                      border border-[#B76E79]/25
                      rounded-xl text-[#EAE0D5] placeholder:text-[#8A6A5C]
                      focus:outline-none focus:border-[#F2C29A]/50
                      transition-colors text-xs sm:text-sm
                    "
                    aria-label="Email address for newsletter"
                  />
                </div>
                <Button
                  variant="luxury"
                  size="sm"
                  className="w-full text-xs sm:text-sm h-11 sm:h-10"
                  type="submit"
                >
                  Subscribe
                </Button>
              </form>
            </div>
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/20 to-transparent my-4 relative z-10" aria-hidden="true" />

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center text-xs text-[#EAE0D5]/50 gap-4 relative z-10">
            <div className="flex flex-col items-center md:items-start gap-1">
              <p>&copy; {currentYear} Aarya Clothing. All rights reserved.</p>
              <p className="text-[#EAE0D5]/40">
                Developed by{' '}
                <a
                  href="https://reverbex.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#B76E79] hover:text-[#F2C29A] transition-colors"
                >
                  Reverbex Technologies
                </a>
              </p>
            </div>
            <nav aria-label="Legal links">
              <div className="flex gap-6 flex-wrap justify-center">
                <Link href="/terms" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Terms of Service</Link>
                <Link href="/privacy" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Privacy Policy</Link>
                <Link href="/returns" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Returns Policy</Link>
                <Link href="/shipping" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Shipping Policy</Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
