'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Error({ error, reset }) {
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (error) {
      setLastError(error);
      // Log error to monitoring service
      console.error('Page error:', error);
    }
  }, [error]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Error Icon */}
        <div className="relative inline-block">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-900 dark:to-orange-900 rounded-full"></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-full p-8 shadow-2xl">
            <AlertTriangle className="h-24 w-24 text-red-500 dark:text-red-400" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Something Went Wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            We encountered an unexpected error while processing your request. 
            Our team has been notified and is working to resolve this.
          </p>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && lastError && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2 text-left">
                Error Details (Development Mode)
              </h3>
              <pre className="text-xs text-red-700 dark:text-red-400 text-left bg-white dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-40">
                {lastError.toString()}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Retry Count */}
        {retryCount > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Retry attempt: {retryCount}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button
            onClick={handleRetry}
            className="h-12 px-8 text-lg bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 rounded-full"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            Try Again
          </Button>
          
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="h-12 px-8 text-lg border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            Go Home
          </Button>
        </div>

        {/* Support Contact */}
        <Card className="border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">
              Need Immediate Assistance?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="mailto:support@aaryaclothing.com"
                className="flex items-center justify-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Mail className="h-5 w-5 text-rose-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Email Support</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">support@aaryaclothing.com</p>
                </div>
              </a>
              <a
                href="tel:+911234567890"
                className="flex items-center justify-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Phone className="h-5 w-5 text-rose-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Call Us</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">+91 123 456 7890</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Status Page Link */}
        <div className="pt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Check our{' '}
            <a
              href="/status"
              className="text-rose-600 dark:text-rose-400 hover:underline font-medium"
            >
              system status
            </a>{' '}
            for current service availability
          </p>
        </div>

        {/* Decorative Bottom */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Error ID: {typeof window !== 'undefined' ? Date.now().toString(36).toUpperCase() : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
