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

// Re-export all token management functions from apiClient.js
export {
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
  getStoredUser,
  getAccessToken,
  setCookie,
  removeCookie,
} from './apiClient';

// Re-export auth data functions (aliases for apiClient.js functions)
export function setAuthData({ user, access_token, refresh_token }) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    // Tokens are set by backend as HttpOnly cookies
  } catch (e) {
    console.error('Failed to store auth data:', e);
  }
}

export function clearAuthData() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('user');
  } catch (e) {
    console.error('Failed to clear auth data:', e);
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
  return `${normalizedBase}${normalizedPath}`;
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
    console.warn('Failed to parse response:', e);
    return {};
  }
}

export class BaseApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.includeCredentials = options.includeCredentials !== false;
    this._refreshing = null;
  }

  async _tryRefreshToken() {
    if (this._refreshing) {
      return this._refreshing;
    }

    this._refreshing = (async () => {
      try {
        // FIX: Use credentials: 'include' to send refresh token cookie
        // Backend expects refresh token from cookie, not request body
        const response = await fetch(buildUrl(this.baseUrl, '/api/v1/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',  // Always include cookies for token refresh
        });

        if (!response.ok) {
          console.warn('[TokenRefresh] Refresh token invalid or expired');
          // Clear stale tokens on refresh failure
          if (typeof window !== 'undefined') {
            clearAuthData();
            clearStoredTokens();
          }
          return false;
        }

        const data = await response.json();
        if (data.access_token) {
          console.log('[TokenRefresh] Successfully refreshed access token');
          // Update tokens in cookies (backend sets them, but we ensure they're updated)
          if (typeof window !== 'undefined' && data.tokens) {
            setStoredTokens(data.tokens);
          }
          
          try {
            const userResponse = await fetch(buildUrl(this.baseUrl, '/api/v1/users/me'), {
              credentials: 'include',  // Always include cookies
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              localStorage.setItem('user', JSON.stringify(userData));
            }
          } catch (e) {
            console.warn('[TokenRefresh] Failed to refresh user data:', e);
          }
          return true;
        }
        console.warn('[TokenRefresh] No access_token in refresh response');
        return false;
      } catch (e) {
        console.error('[TokenRefresh] Refresh request failed:', e.message);
        // Clear stale tokens on error
        if (typeof window !== 'undefined') {
          clearAuthData();
          clearStoredTokens();
        }
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

// Pre-configured clients
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
