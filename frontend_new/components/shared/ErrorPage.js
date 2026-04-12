'use client';

/**
 * Shared Error Boundary Component
 * 
 * Used by Next.js error.js files across all routes.
 * Provides a consistent error UI with a reset button.
 * 
 * @param {Object} props
 * @param {Error} props.error - The error object
 * @param {Function} props.reset - Function to reset the error boundary
 * @param {string} props.title - Error heading text
 * @param {string} props.message - Descriptive error message
 */
export default function ErrorPage({ error, reset, title = 'Something went wrong', message = 'An error occurred. Please try again or contact support.' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050203]">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-400 mb-4">{title}</h2>
        <p className="text-[#EAE0D5]/60 mb-6">{message}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#B76E79] text-white rounded-xl hover:bg-[#B76E79]/80 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
