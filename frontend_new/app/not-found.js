'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { sanitizeSearch } from '@/lib/sanitize';

export default function NotFound() {
  const [searchQuery, setSearchQuery] = useState('');

  const quickLinks = [
    { href: '/products', label: 'Shop All Products' },
    { href: '/#new-arrivals', label: 'New Arrivals' },
    { href: '/collections', label: 'Collections' },
    { href: '/about', label: 'About Us' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Sanitize search input to prevent XSS
      const safeQuery = sanitizeSearch(searchQuery);
      window.location.href = `/products?q=${encodeURIComponent(safeQuery)}`;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        {/* Decorative Element */}
        <div className="relative">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-[#9333EA] to-[#FFD700] rounded-full"></div>
          
          {/* 404 Text */}
          <h1 className="relative text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#E07B8B] to-[#9333EA] animate-pulse" style={{ fontFamily: 'Cinzel, serif' }}>
            404
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold text-[#FFD700]" style={{ fontFamily: 'Cinzel, serif' }}>
            PAGE NOT FOUND
          </h2>
          <p className="text-[#F5F5F5]/70 text-lg">
            The page you&apos;re looking for seems to have wandered off into the ether. 
            Don&apos;t worry, even the most beautiful fabrics sometimes get misplaced.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 px-6 pr-14 bg-[#0A0A0A]/40 backdrop-blur-md border border-[#E07B8B]/25 rounded-full text-[#F5F5F5] placeholder:text-[#8A6A5C] focus:outline-none focus:border-[#FFD700]/50 transition-colors"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-gradient-to-r from-[#9333EA] to-[#E07B8B] text-white hover:opacity-90 transition-opacity"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Quick Links */}
        <div className="bg-[#0A0A0A]/40 backdrop-blur-md border border-[#E07B8B]/15 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-[#F5F5F5]/50 mb-6 uppercase tracking-wider" style={{ fontFamily: 'Cinzel, serif' }}>
            Quick Links
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex flex-col items-center p-4 rounded-xl hover:bg-[#E07B8B]/10 transition-all duration-300"
              >
                <span className="text-2xl mb-3 group-hover:scale-110 transition-transform">
                  {link.href === '/products' && '🛍️'}
                  {link.href === '/collections' && '👗'}
                  {link.href === '/about' && 'ℹ️'}
                  {link.href.includes('new-arrivals') && '✨'}
                </span>
                <span className="text-xs text-[#F5F5F5]/70 group-hover:text-[#FFD700] font-medium transition-colors">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/">
            <button className="h-12 px-8 text-sm font-medium bg-gradient-to-r from-[#9333EA] to-[#E07B8B] text-white rounded-full hover:opacity-90 transition-opacity w-full sm:w-auto">
              Return Home
            </button>
          </Link>
          <a
            href="mailto:support@aaryaclothing.com"
            className="inline-flex items-center justify-center h-12 px-8 text-sm font-medium border border-[#E07B8B]/30 text-[#F5F5F5] hover:border-[#FFD700] hover:text-[#FFD700] rounded-full transition-all w-full sm:w-auto bg-[#0A0A0A]/40"
          >
            Report Issue
          </a>
        </div>

        {/* Decorative Bottom */}
        <div className="pt-8">
          <p className="text-sm text-[#F5F5F5]/50">
            Need help?{' '}
            <Link href="/contact" className="text-[#FFD700] hover:text-[#E07B8B] transition-colors font-medium">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
