/**
 * Error Handling Utilities for Aarya Clothing
 *
 * Provides consistent error handling patterns across the application.
 * All error messages are user-friendly and actionable.
 *
 * @example
 * import { getErrorMessage, logError } from '@/lib/errorHandlers';
 *
 * try {
 *   const data = await api.get('/products');
 * } catch (err) {
 *   logError('ProductList', 'loading products', err, { categoryId });
 *   setError(getErrorMessage(err, 'load products'));
 * }
 */

/**
 * Get user-friendly error message based on HTTP status code.
 *
 * @param {Error} error - The error object
 * @param {string} context - Context of the error (e.g., 'loading products')
 * @param {Object} options - Custom messages for specific status codes
 * @param {string} [options.defaultMsg] - Default error message
 * @param {string} [options.authMsg] - Message for 401 Unauthorized
 * @param {string} [options.permissionMsg] - Message for 403 Forbidden
 * @param {string} [options.notFoundMsg] - Message for 404 Not Found
 * @param {string} [options.networkMsg] - Message for network errors
 * @param {string} [options.serverMsg] - Message for 500 Server Error
 * @returns {string} User-friendly error message
 *
 * @example
 * const msg = getErrorMessage(err, 'load products', {
 *   notFoundMsg: 'Product not found'
 * });
 */
export function getErrorMessage(error, context = 'performing this action', options = {}) {
  const {
    defaultMsg = `Failed to ${context}. Please try again.`,
    authMsg = 'Your session has expired. Please log in again.',
    permissionMsg = 'You do not have permission to perform this action.',
    notFoundMsg = 'The requested resource was not found.',
    networkMsg = 'Cannot connect to server. Please check your connection.',
    serverMsg = 'Server error. Please try again in a few moments.'
  } = options;

  if (!error) return defaultMsg;

  const status = error.status;

  // Handle specific status codes
  if (status === 401) return authMsg;
  if (status === 403) return permissionMsg;
  if (status === 404) return notFoundMsg;
  if (status === 0 || error.isNetworkError) return networkMsg;
  if (status >= 500) return serverMsg;

  // Fallback to provided message or default
  return error?.message || defaultMsg;
}

/**
 * Log error with consistent format for debugging.
 *
 * @param {string} component - Component name (e.g., 'ProductList', 'AdminOrders')
 * @param {string} action - Action that failed (e.g., 'loading products', 'updating order')
 * @param {Error} error - Error object
 * @param {Object} [context] - Additional context (userId, productId, etc.)
 *
 * @example
 * logError('AdminProducts', 'loading products', err, { productId: 123 });
 */
export function logError(component, action, error, context = {}) {
  console.error(`[${component}] ${action} failed:`, {
    error: error?.message,
    status: error?.status,
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    ...context
  });
}

/**
 * Check if error is a network error.
 *
 * @param {Error} error - The error object
 * @returns {boolean} True if network error
 */
export function isNetworkError(error) {
  return error?.status === 0 || error?.isNetworkError || !error?.status;
}

/**
 * Check if error is an authentication error.
 *
 * @param {Error} error - The error object
 * @returns {boolean} True if authentication error
 */
export function isAuthError(error) {
  return error?.status === 401;
}

/**
 * Check if error is a permission error.
 *
 * @param {Error} error - The error object
 * @returns {boolean} True if permission error
 */
export function isPermissionError(error) {
  return error?.status === 403;
}

/**
 * Check if error is a not found error.
 *
 * @param {Error} error - The error object
 * @returns {boolean} True if not found error
 */
export function isNotFoundError(error) {
  return error?.status === 404;
}

/**
 * Get appropriate retry strategy based on error type.
 *
 * @param {Error} error - The error object
 * @returns {Object} Retry strategy { shouldRetry: boolean, delayMs: number }
 */
export function getRetryStrategy(error) {
  // Don't retry on client errors (4xx)
  if (error?.status >= 400 && error?.status < 500) {
    return { shouldRetry: false, delayMs: 0 };
  }

  // Retry on network errors or server errors (5xx)
  if (error?.status === 0 || error?.status >= 500) {
    return { shouldRetry: true, delayMs: 1000 };
  }

  return { shouldRetry: false, delayMs: 0 };
}
