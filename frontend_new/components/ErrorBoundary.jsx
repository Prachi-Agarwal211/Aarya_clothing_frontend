'use client';

import React from 'react';

/**
 * Error Boundary Component - Catches client-side rendering errors
 * Displays actual error message instead of generic error page
 */
export default function ErrorBoundary({ children, fallback }) {
  const [hasError, setHasError] = React.useState(false);
  const [errorDetails, setErrorDetails] = React.useState(null);

  React.useEffect(() => {
    // Override console.error to catch errors
    const originalError = console.error;
    console.error = (...args) => {
      originalError(...args);
      if (args[0]?.message || args[0]?.stack) {
        setHasError(true);
        setErrorDetails({
          message: args[0]?.message || String(args[0]),
          stack: args[0]?.stack,
        });
      }
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  // Error UI
  if (hasError) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-[#050203] p-4">
        <div className="max-w-2xl w-full bg-[#0B0608] border border-red-500/30 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-red-400">Component Error</h1>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 font-mono text-sm break-all">
                {errorDetails?.message || 'Unknown error occurred'}
              </p>
            </div>

            {errorDetails?.stack && (
              <details className="group">
                <summary className="text-sm text-[#EAE0D5]/70 cursor-pointer hover:text-[#EAE0D5]">
                  Show Error Stack (click to expand)
                </summary>
                <pre className="mt-2 p-3 bg-black/40 rounded-lg overflow-x-auto text-xs text-red-300 font-mono whitespace-pre-wrap">
                  {errorDetails.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 py-2.5 border border-[#B76E79]/30 text-[#EAE0D5] rounded-xl hover:bg-[#B76E79]/10 transition-colors text-sm font-medium"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
