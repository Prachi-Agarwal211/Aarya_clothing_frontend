'use client';

import React, { Component } from 'react';
import logger from '@/lib/logger';



/**
 * ErrorBoundary - Catches JavaScript errors in child components
 * 
 * Features:
 * - Prevents entire app crash on component errors
 * - Shows user-friendly fallback UI
 * - Logs errors for debugging
 * - Provides retry mechanism
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Store error info for display
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Here you could also log to an error reporting service
    // e.g., logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#050203] text-[#EAE0D5] p-4">
          <div className="max-w-md w-full text-center">
            {/* Logo */}
            <div className="mb-8 h-20" />

            {/* Error Message */}
            <h1
              className="text-2xl md:text-3xl text-[#F2C29A] mb-4"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Something went wrong
            </h1>

            <p className="text-[#EAE0D5]/70 mb-8">
              We apologize for the inconvenience. Please try again or return to the home page.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-8 p-4 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-left overflow-auto max-h-40">
                <p className="text-red-400 text-sm font-mono">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-6 py-3 border border-[#B76E79]/30 text-[#EAE0D5] rounded-xl hover:border-[#B76E79]/50 transition-colors"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
