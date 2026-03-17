'use client';

import React from 'react';
import Link from 'next/link';
import { Facebook, Instagram, Twitter } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Footer - Redesigned footer section
 * 
 * Features:
 * - No black background (uses SilkBackground from layout)
 * - Glass card effect for container
 * - Consistent styling with other sections
 */
const Footer = ({ id }) => {
  return (
    <footer id={id} className="py-16 sm:py-20 relative">
      <div className="container mx-auto px-4 sm:px-6 md:px-8">
        {/* Glass Container */}
        <div 
          className="
            relative rounded-3xl p-8 sm:p-10 md:p-12
            bg-[#0B0608]/40 backdrop-blur-md
            border border-[#B76E79]/15
            shadow-[0_8px_32px_rgba(0,0,0,0.3)]
          "
        >
          {/* Top Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 relative z-10">
            
            {/* Brand */}
            <div className="space-y-6">
              <h2 
                className="text-2xl sm:text-3xl tracking-wider text-[#F2C29A]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                AARYA
              </h2>
              <p 
                className="text-[#EAE0D5]/70 text-sm leading-relaxed"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Timeless elegance for the modern soul. Designed with passion, crafted with care, and worn with confidence.
              </p>
              <div className="flex gap-4">
                <a href="#" className="p-2 border border-[#F2C29A]/30 rounded-full hover:bg-[#F2C29A] hover:text-[#050203] transition-all duration-300 text-[#EAE0D5]">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="p-2 border border-[#F2C29A]/30 rounded-full hover:bg-[#F2C29A] hover:text-[#050203] transition-all duration-300 text-[#EAE0D5]">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="p-2 border border-[#F2C29A]/30 rounded-full hover:bg-[#F2C29A] hover:text-[#050203] transition-all duration-300 text-[#EAE0D5]">
                  <Twitter className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 
                className="text-lg mb-6 text-[#EAE0D5]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Explore
              </h3>
              <ul className="space-y-4 text-sm text-[#EAE0D5]/70">
                {[
                  { name: 'New Arrivals', href: '/products?sort=newest' },
                  { name: 'Best Sellers', href: '/products?sort=popular' },
                  { name: 'Collections', href: '/collections' },
                  { name: 'Lookbook', href: '/lookbook' },
                  { name: 'About Us', href: '/about' }
                ].map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="hover:text-[#F2C29A] transition-colors flex items-center gap-2 group">
                      <span className="w-0 group-hover:w-2 h-[1px] bg-[#F2C29A] transition-all duration-300" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Customer Care */}
            <div>
              <h3
                className="text-lg mb-6 text-[#EAE0D5]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Customer Care
              </h3>
              <ul className="space-y-4 text-sm text-[#EAE0D5]/70">
                {[
                  { name: 'Contact Us', href: '/contact' },
                  { name: 'Shipping Policy', href: '/shipping' },
                  { name: 'Returns & Refunds', href: '/returns' },
                  { name: 'COD Policy', href: '/cod-policy' },
                  { name: 'Size Guide', href: '/size-guide' },
                  { name: 'FAQ', href: '/faq' }
                ].map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="hover:text-[#F2C29A] transition-colors flex items-center gap-2 group">
                      <span className="w-0 group-hover:w-2 h-[1px] bg-[#F2C29A] transition-all duration-300" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h3 
                className="text-lg mb-6 text-[#EAE0D5]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Stay Updated
              </h3>
              <p className="text-sm text-[#EAE0D5]/70 mb-6">
                Subscribe to receive updates, access to exclusive deals, and more.
              </p>
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    className="
                      w-full h-12 sm:h-14 px-5 sm:px-6 
                      bg-[#0B0608]/40 backdrop-blur-md
                      border border-[#B76E79]/25
                      rounded-2xl text-[#EAE0D5] placeholder:text-[#8A6A5C]
                      focus:outline-none focus:border-[#F2C29A]/50
                      transition-colors text-sm
                    "
                  />
                </div>
                <Button variant="luxury" size="sm" className="w-full">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/20 to-transparent my-8 relative z-10" />

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center text-xs text-[#EAE0D5]/50 gap-4 relative z-10">
            <p>&copy; {new Date().getFullYear()} Aarya Clothing. All rights reserved.</p>
            <div className="flex gap-6 flex-wrap justify-center">
              <Link href="/terms" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Privacy Policy</Link>
              <Link href="/returns" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Returns Policy</Link>
              <Link href="/shipping" className="hover:text-[#F2C29A] cursor-pointer transition-colors">Shipping Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
