import logger from './logger';

/**
 * Base API Client for Aarya Clothing
 *
 * This file now re-exports from apiClient.js for consistency.
 * The BaseApiClient class is kept for advanced usage with custom base URLs.
 *
 * For most use cases, import from apiClient.js instead:
 *   import { apiClient, authApi, productsApi } from './apiClient';
 *
 * Token storage: localStorage + cookies (for middleware route protection)
 */

// Token helpers — tokens are HttpOnly cookies set by the backend.
// These functions exist only for backward-compat; real auth uses credentials:'include'.

/**
 * @deprecated No-op for backward compatibility.
 * Tokens are now HttpOnly cookies managed by the backend.
 * Do NOT use for new code — use setAuthData() instead.
 */
export function setCookie(name, value, days = 7) {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const secureFlag = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax${secureFlag}`;
  } catch (e) {
    logger.error('Failed to set cookie:', e);
  }
}

/**
 * @deprecated No-op for backward compatibility.
 * Tokens are now HttpOnly cookies managed by the backend.
 */
export function removeCookie(name) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  } catch (e) {
    logger.warn('Failed to remove cookie:', e);
  }
}

/**
 * @deprecated No-op — returns null.
 * Tokens are HttpOnly cookies; this function exists only for backward compatibility.
 * Use `getAccessToken()` from authContext instead if you need token-aware logic.
 */
export function getStoredTokens() { return null; }
/**
 * @deprecated No-op.
 * Tokens are HttpOnly cookies set by the backend.
 */
export function setStoredTokens() {}
/**
 * @deprecated Alias for clearAuthData().
 * Clears localStorage user data only; cookies are cleared by backend logout.
 */
export function clearStoredTokens() { clearAuthData(); }

/**
 * @deprecated Always returns null.
 * Tokens are HttpOnly cookies — not accessible to JavaScript for security.
 */
export function getAccessToken() { return null; }

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  } catch (e) {
    logger.warn('Failed to get stored user:', e);
    return null;
  }
}

// Re-export auth data functions (aliases for apiClient.js functions)
export function setAuthData({ user, access_token, refresh_token }) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    // Tokens are set by backend as HttpOnly cookies
  } catch (e) {
    logger.error('Failed to store auth data:', e);
  }
}

export function clearAuthData() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('user');
  } catch (e) {
    logger.error('Failed to clear auth data:', e);
  }
}

export function getAuthToken() {
  // Returns null - tokens are HttpOnly cookies now
  return null;
}

export function getRefreshToken() {
  // Returns null - tokens are HttpOnly cookies now
  return null;
}

// Legacy function for backward compatibility
export function setTokens(tokens) {
  setAuthData(tokens);
}

export function clearTokens() {
  clearAuthData();
}

// Utility functions
export function buildQuery(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, value);
    }
  });
  return searchParams.toString();
}

export function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

export function buildUrl(baseUrl, path) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Handle empty base URL (relative URL case for SSR behind nginx)
  if (!normalizedBase) {
    return normalizedPath;
  }
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Fetch with timeout using AbortController
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>} - Fetch response
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with retry logic and exponential backoff
 * @param {Function} fetchFn - Async fetch function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @param {number} initialDelayMs - Initial delay in ms (default: 1000)
 * @returns {Promise<any>} - Result of fetch function
 */
export async function fetchWithRetry(fetchFn, maxRetries = 2, initialDelayMs = 1000) {
  let lastError;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;
      // Don't retry on abort errors or 4xx client errors (they won't succeed)
      if (error.name === 'AbortError' || error.noRetry) {
        throw error;
      }
      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        logger.warn(`Fetch failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError;
}

// BaseApiClient class for advanced usage
const REQUEST_OPTION_KEYS = new Set(['params', 'headers', 'credentials', 'signal', 'cache', 'mode', 'redirect', 'referrer', 'integrity', 'keepalive']);

function isRequestOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof FormData) {
    return false;
  }
  return Object.keys(value).length > 0 && Object.keys(value).every((key) => REQUEST_OPTION_KEYS.has(key));
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    const text = await response.text();
    return text ? { detail: text } : {};
  } catch (e) {
    logger.warn('Failed to parse response:', e);
    return {};
  }
}

// Single in-flight refresh for the whole app
let authRefreshSingleton = null;

// PERFORMANCE: Request Deduplication & In-Memory Cache
// Prevents duplicate in-flight requests and caches GET responses for 2 seconds.
const inflightRequests = new Map();
const getCache = new Map();
const CACHE_TTL = 2000; // 2 seconds

export class BaseApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.includeCredentials = options.includeCredentials !== false;
    this.timeout = options.timeout ?? 10000; 
    this.maxRetries = options.maxRetries ?? 2;
  }

  async fetch(path, options = {}, _isRetry = false) {
    const url = buildUrl(this.baseUrl, path);
    const method = options.method || 'GET';
    const isGet = method.toUpperCase() === 'GET';
    
    // 1. Check Cache (GET only)
    if (isGet && !options.cache && !options.next?.revalidate === 0) {
      const cached = getCache.get(url);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    // 2. Request Deduplication (GET only)
    if (isGet && inflightRequests.has(url)) {
      return inflightRequests.get(url);
    }

    const hasFormDataBody = options.body instanceof FormData;
    const headers = {
      ...(hasFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    };

    const effectiveMaxRetries = path.includes('/api/v1/auth/')
      ? Math.min(this.maxRetries, 1)
      : this.maxRetries;

    const performFetch = async () => {
      return fetchWithRetry(async () => {
        let response;
        try {
          response = await fetchWithTimeout(url, {
            ...options,
            headers,
            ...(this.includeCredentials && { credentials: 'include' }),
          }, this.timeout);
        } catch (e) {
          const error = new Error(e.message || 'Network error');
          error.status = 0;
          error.isNetworkError = true;
          error.name = e.name === 'AbortError' ? 'TimeoutError' : e.name;
          throw error;
        }

        const data = await parseResponse(response);

        if (!response.ok) {
          if (response.status === 401 && typeof window !== 'undefined' && !_isRetry) {
            const refreshed = await this._tryRefreshToken();
            if (refreshed) {
              return this.fetch(path, options, true);
            }
          }

          const errorDetail = (data && (data.error?.message || data.detail || data.message)) || `Request failed with status ${response.status}`;
          const detail = typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail;
          const error = new Error(detail);
          error.status = response.status;
          error.data = data;
          error.noRetry = response.status >= 400 && response.status < 500;
          throw error;
        }

        // 3. Update Cache on success
        if (isGet) {
          getCache.set(url, { data, timestamp: Date.now() });
        }

        return data;
      }, effectiveMaxRetries);
    };

    if (isGet) {
      const requestPromise = performFetch().finally(() => {
        inflightRequests.delete(url);
      });
      inflightRequests.set(url, requestPromise);
      return requestPromise;
    }

    return performFetch();
  }

  _buildPathWithParams(path, params = {}) {
    const queryString = buildQuery(params || {});
    return queryString ? `${path}?${queryString}` : path;
  }

  _normalizePayloadAndOptions(payload, options = {}) {
    if (isRequestOptions(payload) && Object.keys(options).length === 0) {
      return { payload: undefined, options: payload };
    }
    return { payload, options };
  }

  _prepareRequest(path, payload, options = {}, method = 'GET') {
    const requestOptions = { ...options };
    const fullPath = this._buildPathWithParams(path, requestOptions.params);
    delete requestOptions.params;
    requestOptions.method = method;

    if (payload !== undefined && payload !== null && method !== 'GET') {
      requestOptions.body = payload instanceof FormData ? payload : JSON.stringify(payload);
    }

    return { path: fullPath, options: requestOptions };
  }

  async get(path, params = {}) {
    return this.fetch(this._buildPathWithParams(path, params));
  }

  async post(path, data = {}, options = {}) {
    const normalized = this._normalizePayloadAndOptions(data, options);
    const request = this._prepareRequest(path, normalized.payload, normalized.options, 'POST');
    return this.fetch(request.path, request.options);
  }

  async put(path, data = {}, options = {}) {
    const normalized = this._normalizePayloadAndOptions(data, options);
    const request = this._prepareRequest(path, normalized.payload, normalized.options, 'PUT');
    return this.fetch(request.path, request.options);
  }

  async patch(path, data = {}, options = {}) {
    const normalized = this._normalizePayloadAndOptions(data, options);
    const request = this._prepareRequest(path, normalized.payload, normalized.options, 'PATCH');
    return this.fetch(request.path, request.options);
  }

  async delete(path, options = {}) {
    const normalized = this._normalizePayloadAndOptions(undefined, options);
    const request = this._prepareRequest(path, normalized.payload, normalized.options, 'DELETE');
    return this.fetch(request.path, request.options);
  }

  async uploadFile(path, fileOrData, params = {}) {
    const queryString = buildQuery(params);
    const fullPath = queryString ? `${path}?${queryString}` : path;
    const url = buildUrl(this.baseUrl, fullPath);

    let formData;
    try {
      if (fileOrData instanceof FormData) {
        formData = fileOrData;
      } else if (fileOrData instanceof FileList) {
        formData = new FormData();
        Array.from(fileOrData).forEach((file) => formData.append('files', file));
      } else if (fileOrData instanceof File) {
        formData = new FormData();
        formData.append('file', fileOrData);
      } else {
        formData = new FormData();
        Object.entries(fileOrData).forEach(([key, value]) => formData.append(key, value));
      }
    } catch (e) {
      throw new Error('Failed to prepare upload data: ' + e.message);
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        body: formData,
        ...(this.includeCredentials && { credentials: 'include' }),
      });
    } catch (e) {
      const error = new Error(e.message || 'Network error during upload');
      error.status = 0;
      error.isNetworkError = true;
      throw error;
    }

    const data = await parseResponse(response);

    if (!response.ok) {
      const detail = (data && (data.detail || data.message)) || `Upload failed with status ${response.status}`;
      const error = new Error(detail);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }
}

/**
 * Base URL for API requests (same origin in production).
 *
 * Despite the name, this is the **nginx gateway** origin, not only the Core service.
 * Paths like `/api/v1/site/*` → core, `/api/v1/landing/*` → admin, `/api/v1/cart/*` → commerce,
 * etc. (see `docker/nginx/nginx.conf`). Use this for any browser or SSR `fetch` to `/api/v1/...`.
 *
 * SINGLE SOURCE OF TRUTH — lazy evaluation at call time (critical for SSR).
 *
 * Priority order:
 * 1. Browser — `window.location.origin`
 * 2. Server — `NEXT_PUBLIC_API_URL` (e.g. `http://nginx:80` in Docker)
 * 3. Relative URL fallback (`''`) so requests are same-origin relative paths
 *
 * @returns {string} Gateway base URL for `/api/v1/*` calls
 */
export function getCoreBaseUrl() {
  // Priority 1: Browser environment - use current origin (CSP compliant)
  // If we are on port 3000 (dev), we need to hit port 80 (nginx)
  if (typeof window !== 'undefined') {
    if (window.location.port === '3000') {
      return `${window.location.protocol}//${window.location.hostname}`;
    }
    return window.location.origin;
  }

  // Priority 2: Server-side (SSR) - Use INTERNAL URL if provided
  // This is critical for Docker networking (hitting 'http://nginx' instead of localhost)
  if (typeof process !== 'undefined' && process.env?.NEXT_INTERNAL_API_URL) {
    return process.env.NEXT_INTERNAL_API_URL.trim();
  }

  // Priority 3: Server-side (SSR) fallback to PUBLIC_API_URL
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.trim();
  }

  // Priority 4: Relative URL fallback
  return '';
}

export function getCommerceBaseUrl() {
  // Client-side: use same origin (nginx will proxy to commerce service)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Server-side: use internal URL for direct service-to-service calls
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_INTERNAL_COMMERCE_URL) {
    return process.env.NEXT_PUBLIC_INTERNAL_COMMERCE_URL.trim();
  }

  // SSR fallback: bypass nginx if gateway networking is flaky for server-side fetches
  return 'http://commerce:5002';
  
}

export function getAdminBaseUrl() {
  return getCoreBaseUrl();
}

export function getPaymentBaseUrl() {
  return getCoreBaseUrl();
}

/**
 * Lazy client factory - creates fresh BaseApiClient instances on each call.
 * This is critical for SSR because the URL must be resolved at request time,
 * not at module load time. In Next.js standalone output, environment variables
 * are available at runtime but the module is cached.
 * 
 * Usage: Instead of `commerceClient.get(...)`, use `getCommerceClient().get(...)`
 * Or import `commerceClient` which is now a getter that returns a fresh client.
 */

// Proxy-based lazy clients that create fresh instances on each access
const createLazyClientHandler = (baseUrlGetter) => ({
  get: (_, prop) => {
    const client = new BaseApiClient(baseUrlGetter());
    return client[prop]?.bind(client);
  }
});

// Export lazy getters for all client types
export const coreClient = new Proxy({}, createLazyClientHandler(getCoreBaseUrl));
export const commerceClient = new Proxy({}, createLazyClientHandler(getCommerceBaseUrl));
export const adminClient = new Proxy({}, createLazyClientHandler(getAdminBaseUrl));
export const paymentClient = new Proxy({}, createLazyClientHandler(getPaymentBaseUrl));

export default BaseApiClient;
