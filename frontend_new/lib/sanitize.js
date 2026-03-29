'use client';

/**
 * Input Sanitization Utility for Aarya Clothing
 * 
 * Uses DOMPurify to sanitize user inputs and prevent XSS attacks.
 * 
 * Usage:
 * ```js
 * import { sanitizeInput, sanitizeSearch, sanitizeHtml } from '@/lib/sanitize';
 * 
 * // For search queries
 * const safeQuery = sanitizeSearch(userInput);
 * 
 * // For general input
 * const safeInput = sanitizeInput(userInput);
 * 
 * // For HTML content (if needed)
 * const safeHtml = sanitizeHtml(dirtyHtml);
 * ```
 */

import DOMPurify from 'dompurify';

/**
 * Configuration for DOMPurify
 * Restricted config to prevent XSS while allowing safe content
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
};

/**
 * Configuration for HTML sanitization (more permissive but still safe)
 */
const HTML_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/**
 * Check if we're in a browser environment
 */
function isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * Get DOMPurify instance (handles SSR)
 */
function getPurify() {
  if (!isBrowser()) {
    return null;
  }
  return DOMPurify(window);
}

/**
 * Sanitize a search query - strips all HTML tags
 * Safe for URL parameters and search inputs
 * 
 * @param {string} input - The user input to sanitize
 * @returns {string} Sanitized string safe for search
 */
export function sanitizeSearch(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const purify = getPurify();
  if (!purify) {
    // Server-side: basic sanitization
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  // Client-side: use DOMPurify
  return purify.sanitize(input, SANITIZE_CONFIG).trim();
}

/**
 * Sanitize general user input - strips all HTML tags
 * Safe for text inputs, form fields, etc.
 * 
 * @param {string} input - The user input to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const purify = getPurify();
  if (!purify) {
    // Server-side: basic sanitization
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  // Client-side: use DOMPurify
  return purify.sanitize(input, SANITIZE_CONFIG).trim();
}

/**
 * Sanitize HTML content while preserving safe tags
 * Use only for trusted content that needs formatting
 * 
 * @param {string} html - The HTML content to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const purify = getPurify();
  if (!purify) {
    // Server-side: return empty string for HTML
    return '';
  }

  // Client-side: use DOMPurify with permissive config
  return purify.sanitize(html, HTML_SANITIZE_CONFIG);
}

/**
 * Sanitize an object of form data
 * Recursively sanitizes all string values
 * 
 * @param {Object} data - The form data object
 * @returns {Object} Sanitized form data
 */
export function sanitizeFormData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFormData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create a sanitized version of URL search params
 * 
 * @param {URLSearchParams} params - The search params
 * @returns {Object} Sanitized key-value pairs
 */
export function sanitizeSearchParams(params) {
  if (!params) {
    return {};
  }

  const sanitized = {};
  for (const [key, value] of params.entries()) {
    sanitized[key] = sanitizeSearch(value);
  }

  return sanitized;
}

export default {
  sanitizeSearch,
  sanitizeInput,
  sanitizeHtml,
  sanitizeFormData,
  sanitizeSearchParams,
};
