/**
 * Shared API Configuration Constants
 * 
 * Central configuration for API timeouts, retries, and other constants
 * used across the frontend application.
 */

// API timeout in milliseconds (10 seconds)
export const API_TIMEOUT_MS = 10000;

// Maximum number of retry attempts
export const MAX_RETRIES = 2;

// Initial retry delay in milliseconds (1 second)
export const INITIAL_RETRY_DELAY = 1000;

// Video intro timeout in milliseconds (5 seconds)
export const VIDEO_TIMEOUT_MS = 5000;

// Video delay before fetching landing data in milliseconds (1 second)
export const VIDEO_FETCH_DELAY_MS = 1000;

// Default product limit for API calls
export const DEFAULT_PRODUCT_LIMIT = 100;

// Intro video seen flag expiry in milliseconds (24 hours)
export const INTRO_VIDEO_SEEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
