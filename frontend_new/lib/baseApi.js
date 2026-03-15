/**
 * Base API Client for Aarya Clothing
 * 
 * Unified base class for all API clients.
 * Handles authentication, request/response processing, and error handling.
 * 
 * Token storage: localStorage + cookies (for middleware route protection)
 * 
 * Usage:
 *   import { coreClient, setAuthData, clearAuthData } from './baseApi';
 *   const data = await coreClient.fetch('/api/v1/products');
 */

 const REQUEST_OPTION_KEYS = new Set(['params', 'headers', 'credentials', 'signal', 'cache', 'mode', 'redirect', 'referrer', 'integrity', 'keepalive']);

// ==================== Cookie Helpers ====================

/**
 * Set a cookie with expiration and security options
 */
function setCookie(name, value, days = 7) {
  if (typeof document === 'undefined') return;

  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const encodedValue = encodeURIComponent(value);

    // Use SameSite=Lax for CSRF protection, consider Secure in production
    const secureFlag = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${name}=${encodedValue};expires=${expires.toUTCString()};path=/;SameSite=Lax${secureFlag}`;
  } catch (e) {
    console.error('Failed to set cookie:', e);
  }
}

/**
 * Remove a cookie
 */
function removeCookie(name) {
  if (typeof document === 'undefined') return;

  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  } catch (e) {
    console.warn('Failed to remove cookie:', e);
  }
}

// ==================== Token Management ====================

/**
 * Get the authentication token
 * Note: Returns null since tokens are now HttpOnly cookies
 * Cookies are sent automatically by the browser with credentials: 'include'
 */
export function getAuthToken() {
  return null;
}

/**
 * Get the refresh token
 * Note: Returns null since tokens are now HttpOnly cookies
 * Backend reads refresh token from cookie during refresh
 */
export function getRefreshToken() {
  return null;
}

/**
 * Store authentication data (user only - tokens are set by backend as HttpOnly cookies)
 * @param {Object} params - { user, access_token, refresh_token }
 */
export function setAuthData({ user, access_token, refresh_token }) {
  if (typeof window === 'undefined') return;

  try {
    // Store user data in localStorage (safe - doesn't contain tokens)
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    
    // Note: Tokens are NO LONGER stored here by frontend
    // Backend sets HttpOnly cookies via Set-Cookie header
    // This prevents XSS attacks from stealing tokens
  } catch (e) {
    console.error('Failed to store auth data:', e);
  }
}

/**
 * Clear all authentication data from localStorage
 * Note: HttpOnly cookies are cleared by backend on logout
 */
export function clearAuthData() {
  if (typeof window === 'undefined') return;

  try {
    // Clear user data from localStorage
    localStorage.removeItem('user');
    
    // Note: We no longer clear tokens here since they're HttpOnly
    // Backend should clear them via Set-Cookie with expiry in the past
  } catch (e) {
    console.error('Failed to clear auth data:', e);
  }
}

/**
 * Get stored user data from localStorage
 * Note: User data is safe to store in localStorage (no sensitive tokens)
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null;

  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.warn('Failed to get stored user:', e);
    return null;
  }
}

// ==================== Legacy Functions (for backward compatibility) ====================

export function setTokens(tokens) {
  setAuthData({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
}

export function clearTokens() {
  clearAuthData();
}

export function setStoredUser(user) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('user', JSON.stringify(user));
    setCookie('user', JSON.stringify(user));
  } catch (e) {
    console.error('Failed to store user:', e);
  }
}

// ==================== Utility Functions ====================

export function buildQuery(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, value);
    }
  });
  return searchParams.toString();
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
    console.warn('Failed to parse response:', e);
    return {};
  }
}

export function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '');
}

export function buildUrl(baseUrl, path) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function isRequestOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof FormData) {
    return false;
  }

  return Object.keys(value).length > 0 && Object.keys(value).every((key) => REQUEST_OPTION_KEYS.has(key));
}

// ==================== Base API Client Class ====================

export class BaseApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.includeCredentials = options.includeCredentials !== false;
    this._refreshing = null; // Lock to prevent concurrent refresh attempts
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Uses a lock so multiple 401s only trigger one refresh.
   */
  async _tryRefreshToken() {
    // If a refresh is already in progress, wait for it
    if (this._refreshing) {
      return this._refreshing;
    }

    this._refreshing = (async () => {
      try {
        // Refresh token is HttpOnly cookie - backend will read it from cookie
        // No need to read or send it in request body
        const response = await fetch(buildUrl(this.baseUrl, '/api/v1/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Empty body - backend reads from cookie
          ...(this.includeCredentials && { credentials: 'include' }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        if (data.access_token) {
          // Backend sets new HttpOnly cookies
          // Refresh user data from server
          try {
            const userResponse = await fetch(buildUrl(this.baseUrl, '/api/v1/users/me'), {
              ...(this.includeCredentials && { credentials: 'include' }),
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              localStorage.setItem('user', JSON.stringify(userData));
            }
          } catch (e) {
            console.warn('Failed to refresh user data:', e);
          }
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        this._refreshing = null;
      }
    })();

    return this._refreshing;
  }

  async fetch(path, options = {}, _isRetry = false) {
    const url = buildUrl(this.baseUrl, path);
    const hasFormDataBody = options.body instanceof FormData;

    const headers = {
      ...(hasFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    };

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        ...(this.includeCredentials && { credentials: 'include' }),
      });
    } catch (e) {
      const error = new Error(e.message || 'Network error');
      error.status = 0;
      error.isNetworkError = true;
      throw error;
    }

    const data = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined' && !_isRetry) {
        const refreshed = await this._tryRefreshToken();
        if (refreshed) {
          return this.fetch(path, options, true);
        }
        clearAuthData();
      }

      const errorDetail = (data && (data.error?.message || data.detail || data.message)) || `Request failed with status ${response.status}`;
      const detail = typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail;
      const error = new Error(detail);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
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

// ==================== Pre-configured Clients ====================

/**
 * Get the API base URL (nginx proxy)
 */
export function getCoreBaseUrl() {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:6005';
}

export function getCommerceBaseUrl() {
  return getCoreBaseUrl();
}

export function getAdminBaseUrl() {
  return getCoreBaseUrl();
}

export function getPaymentBaseUrl() {
  return getCoreBaseUrl();
}

// Export singleton instances
export const coreClient = new BaseApiClient(getCoreBaseUrl());
export const commerceClient = new BaseApiClient(getCommerceBaseUrl());
export const adminClient = new BaseApiClient(getAdminBaseUrl());
export const paymentClient = new BaseApiClient(getPaymentBaseUrl());

export default BaseApiClient;
