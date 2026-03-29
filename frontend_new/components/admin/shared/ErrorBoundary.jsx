'use client';

import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * ErrorBoundary - Catches and displays errors in child components
 * Provides user-friendly error messages with recovery options
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log error to console (in production, send to error tracking service)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error, this.handleRetry)
      ) : (
        <ErrorDisplay
          error={this.state.error}
          onRetry={this.handleRetry}
          title={this.props.title}
          message={this.props.message}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * ErrorDisplay - User-friendly error display component
 */
export function ErrorDisplay({ error, onRetry, title, message, icon }) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div
      className={cn(
        'min-h-[400px] flex items-center justify-center p-8',
        'bg-[#0B0608]/40 backdrop-blur-md border border-red-500/20 rounded-2xl'
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="mb-6">
          {icon || (
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Error Title */}
        <h2 className="text-xl font-bold text-[#F2C29A] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
          {title || 'Something went wrong'}
        </h2>

        {/* Error Message */}
        <p className="text-[#EAE0D5]/60 mb-6">
          {message || 'We encountered an unexpected error. Please try again.'}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className={cn(
                'flex items-center justify-center gap-2 px-6 py-2.5',
                'bg-[#7A2F57]/40 border border-[#B76E79]/40',
                'text-[#F2C29A] rounded-xl hover:bg-[#7A2F57]/60',
                'transition-colors font-medium',
                'min-h-[44px] touch-target'
              )}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try Again
            </button>
          )}

          <Link
            href="/admin"
            className={cn(
              'flex items-center justify-center gap-2 px-6 py-2.5',
              'bg-[#0B0608]/60 border border-[#B76E79]/30',
              'text-[#EAE0D5]/70 rounded-xl hover:bg-[#B76E79]/10',
              'transition-colors font-medium',
              'min-h-[44px] touch-target'
            )}
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go to Dashboard
          </Link>
        </div>

        {/* Technical Details (Development Only) */}
        {isDevelopment && error && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-[#EAE0D5]/40 cursor-pointer hover:text-[#EAE0D5]/60">
              Technical Details
            </summary>
            <div className="mt-3 p-4 bg-[#0B0608]/80 border border-[#B76E79]/20 rounded-xl overflow-x-auto">
              <pre className="text-xs text-red-400 whitespace-pre-wrap">
                {error.toString()}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * withErrorBoundary - HOC for wrapping components with error boundary
 */
export function withErrorBoundary(WrappedComponent, options = {}) {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary title={options.title} message={options.message}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default ErrorBoundary;
