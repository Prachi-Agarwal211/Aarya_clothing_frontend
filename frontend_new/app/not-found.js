'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  const [searchQuery, setSearchQuery] = useState('');

  const quickLinks = [
    { href: '/products', label: 'Shop All Products' },
    { href: '/new-arrivals', label: 'New Arrivals' },
    { href: '/collections', label: 'Collections' },
    { href: '/about', label: 'About Us' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Decorative Element */}
        <div className="relative">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-rose-200 to-amber-200 dark:from-rose-900 dark:to-amber-900 rounded-full"></div>
          
          {/* 404 Text */}
          <h1 className="relative text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-purple-600 to-amber-600 dark:from-rose-400 dark:via-purple-400 dark:to-amber-400 animate-pulse">
            404
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Page Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            The page you&apos;re looking for seems to have wandered off into the ether. 
            Don&apos;t worry, even the most beautiful fabrics sometimes get misplaced.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-12 h-12 text-lg border-2 border-rose-200 dark:border-rose-800 focus:border-rose-400 dark:focus:border-rose-600 rounded-full"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-600 hover:to-purple-600"
            >
              <Search className="h-5 w-5 text-white" />
            </Button>
          </div>
        </form>

        {/* Quick Links */}
        <Card className="border-rose-100 dark:border-rose-900 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
              Quick Links
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex flex-col items-center p-4 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-300"
                >
                  <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    {link.href === '/products' && '🛍️'}
                    {link.href === '/new-arrivals' && '✨'}
                    {link.href === '/collections' && '👗'}
                    {link.href === '/about' && 'ℹ️'}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 font-medium">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/">
            <Button className="h-12 px-8 text-lg bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-600 hover:to-purple-600 rounded-full">
              Return Home
            </Button>
          </Link>
          <a
            href="mailto:support@aaryaclothing.com"
            className="inline-flex items-center justify-center h-12 px-8 text-lg border-2 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors font-medium"
          >
            Report Issue
          </a>
        </div>

        {/* Decorative Bottom */}
        <div className="pt-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help?{' '}
            <Link href="/contact" className="text-rose-600 dark:text-rose-400 hover:underline font-medium">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
