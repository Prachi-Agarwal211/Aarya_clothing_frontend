'use client';

/**
 * Error Handlers - Centralized error logging and message extraction
 * Used by admin pages for consistent error handling
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Log an error with context information
 * @param {string} component - Component or page name where error occurred
 * @param {string} action - What was being attempted
 * @param {Error|any} error - The error object
 */
export function logError(component, action, error) {
  const timestamp = new Date().toISOString();
  const errorMessage = error?.message || String(error);
  const errorStack = error?.stack || '';

  if (isDevelopment) {
    console.error(`[Error][${timestamp}] ${component} -> ${action}: ${errorMessage}`);
    if (errorStack) {
      console.error(errorStack);
    }
  } else {
    console.error(`[${component}] ${action}: ${errorMessage}`);
  }
}

/**
 * Extract a user-friendly error message from an error object or API response
 * @param {Error|any} error - The error to extract a message from
 * @param {string} fallback - Default message if extraction fails
 * @returns {string} A user-readable error message
 */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'object') {
    return (
      error.message ||
      error.detail ||
      error.error ||
      error.status?.message ||
      fallback
    );
  }
  return fallback;
}

export default { logError, getErrorMessage };
