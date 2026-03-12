/**
 * Logger utility for consistent logging across the application
 * Only logs in development mode, suppresses in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Log informational messages (only in development)
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  log: (message, ...args) => {
    if (isDevelopment) {
      console.log(message, ...args);
    }
  },

  /**
   * Log warning messages (only in development)
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  warn: (message, ...args) => {
    if (isDevelopment) {
      console.warn(message, ...args);
    }
  },

  /**
   * Log error messages (only in development)
   * In production, you could send this to an error tracking service
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or additional data
   */
  error: (message, error) => {
    if (isDevelopment) {
      console.error(message, error);
    }
    // In production, you could send errors to a service like Sentry
    // if (!isDevelopment && typeof window !== 'undefined') {
    //   Sentry.captureException(error);
    // }
  },

  /**
   * Log debug messages (only in development)
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments
   */
  debug: (message, ...args) => {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Log API errors with context
   * @param {string} context - Where the error occurred (e.g., 'fetchProducts')
   * @param {Error} error - The error object
   */
  apiError: (context, error) => {
    if (isDevelopment) {
      console.error(`[API Error] ${context}:`, error);
    }
  },
};

export default logger;
