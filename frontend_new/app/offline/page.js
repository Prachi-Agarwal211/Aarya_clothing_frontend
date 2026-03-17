'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw, Cloud, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cachedPages, setCachedPages] = useState([]);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setRetrying(false);
      // Redirect to home after 2 seconds when back online
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get cached pages from localStorage
    try {
      const cached = localStorage.getItem('cachedPages');
      if (cached) {
        setCachedPages(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Could not access cached pages');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    
    // Check if we're back online
    if (navigator.onLine) {
      window.location.href = '/';
    } else {
      // Try to fetch a small resource to test connectivity
      try {
        const response = await fetch('/favicon.ico', { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        if (response.ok) {
          window.location.href = '/';
        }
      } catch (e) {
        console.log('Still offline');
      }
    }
    
    setRetrying(false);
  };

  const suggestedPages = [
    { href: '/products', label: 'Browse Products', icon: '🛍️' },
    { href: '/collections', label: 'View Collections', icon: '👗' },
    { href: '/about', label: 'About Us', icon: 'ℹ️' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Offline Icon */}
        <div className="relative inline-block">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-blue-900 dark:to-indigo-900 rounded-full"></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-full p-8 shadow-2xl">
            <WifiOff className="h-24 w-24 text-blue-500 dark:text-blue-400" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            You&apos;re Offline
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            It looks like you&apos;ve lost your internet connection. 
            Don&apos;t worry, your style journey can resume once you&apos;re back online.
          </p>
        </div>

        {/* Connection Status */}
        <Card className={`border-2 ${isOnline ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3">
              {isOnline ? (
                <>
                  <Cloud className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    You&apos;re back online! Redirecting...
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <span className="text-blue-700 dark:text-blue-300 font-medium">
                    No internet connection detected
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Retry Button */}
        <div className="flex justify-center gap-4 pt-4">
          <Button
            onClick={handleRetry}
            disabled={retrying || isOnline}
            className="h-12 px-8 text-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
          >
            <RefreshCw className={`mr-2 h-5 w-5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Checking...' : isOnline ? 'Redirecting...' : 'Try Again'}
          </Button>
        </div>

        {/* Cached Content Notice */}
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-left">
              <Download className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                  Cached Content Available
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                  You can still browse previously visited pages while offline. Your cart and wishlist are saved locally.
                </p>
                {cachedPages && cachedPages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {cachedPages.slice(0, 3).map((page, index) => (
                      <Link
                        key={index}
                        href={page.path}
                        className="text-xs px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                      >
                        {page.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggested Pages */}
        <Card className="border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
              Browse When Online
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {suggestedPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="group p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                >
                  <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">
                    {page.icon}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {page.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <div className="pt-4 space-y-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Quick Tips:
          </h3>
          <ul className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
            <li>• Check your Wi-Fi or mobile data connection</li>
            <li>• Try refreshing your router if on Wi-Fi</li>
            <li>• Your cart is saved and will sync when you&apos;re back online</li>
          </ul>
        </div>

        {/* Decorative Bottom */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Last checked: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
