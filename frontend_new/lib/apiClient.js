/**
 * Consolidated API Client for Aarya Clothing
 * 
 * Single unified API client replacing multiple duplicate clients.
 * Handles authentication, requests, error handling for all services.
 * 
 * Usage:
 *   import { apiClient } from './apiClient';
 *   const products = await apiClient.get('/api/v1/products');
 *   
 *   // Modular API functions
 *   import { productsApi, ordersApi, authApi } from './apiClient';
 *   const product = await productsApi.get(productId);
 */

const REQUEST_OPTION_KEYS = new Set(['params', 'headers', 'credentials', 'signal', 'cache', 'mode', 'redirect', 'keepalive']);

// ==================== Cookie Helpers ====================

function setCookie(name, value, days = 7) {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const encodedValue = encodeURIComponent(value);
    const secureFlag = window.location.protocol === 'https:' ? ';Secure' : '';
    document.cookie = `${name}=${encodedValue};expires=${expires.toUTCString()};path=/;SameSite=Lax${secureFlag}`;
  } catch (e) {
    console.error('Failed to set cookie:', e);
  }
}

function removeCookie(name) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  } catch (e) {
    console.warn('Failed to remove cookie:', e);
  }
}

// ==================== Token Management ====================

function getStoredTokens() {
  if (typeof window === 'undefined') return null;
  try {
    const authData = localStorage.getItem('auth');
    return authData ? JSON.parse(authData) : null;
  } catch (e) {
    console.warn('Failed to parse stored tokens:', e);
    return null;
  }
}

function setStoredTokens(tokens) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('auth', JSON.stringify(tokens));
    if (tokens.access_token) {
      setCookie('access_token', tokens.access_token, 1);
    }
    if (tokens.refresh_token) {
      setCookie('refresh_token', tokens.refresh_token, 7);
    }
  } catch (e) {
    console.error('Failed to store tokens:', e);
  }
}

function clearStoredTokens() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('auth');
    removeCookie('access_token');
    removeCookie('refresh_token');
  } catch (e) {
    console.error('Failed to clear tokens:', e);
  }
}

function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.warn('Failed to get stored user:', e);
    return null;
  }
}

function getAccessToken() {
  const tokens = getStoredTokens();
  return tokens?.access_token || null;
}

// ==================== Base URL Helpers ====================

function getCoreBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005';
}

function getAdminBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005';
}

function getCommerceBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005';
}

// ==================== API Client Class ====================

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async _request(endpoint, options = {}) {
    const url = new URL(endpoint, this.baseURL);
    
    // Add query params
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    // Get auth token
    const token = getAccessToken();
    
    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Build fetch options
    const fetchOptions = {
      ...options,
      headers,
    };

    // Remove non-fetch options
    delete fetchOptions.params;

    try {
      const response = await fetch(url.toString(), fetchOptions);
      
      // Handle error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.detail || errorData.message || 'Request failed',
          response.status,
          errorData.code || 'API_ERROR',
          errorData
        );
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 0, 'NETWORK_ERROR', { originalError: error.message });
    }
  }

  async get(endpoint, params) {
    return this._request(endpoint, { method: 'GET', params });
  }

  async post(endpoint, data) {
    return this._request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  async put(endpoint, data) {
    return this._request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  async patch(endpoint, data) {
    return this._request(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async delete(endpoint) {
    return this._request(endpoint, { method: 'DELETE' });
  }
}

// ==================== Error Class ====================

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ==================== Single Client Instance ====================

const apiClient = new ApiClient(getCoreBaseUrl());

// ==================== Modular API Functions ====================

export const authApi = {
  login: (credentials) => apiClient.post('/api/v1/auth/login', credentials),
  register: (data) => apiClient.post('/api/v1/auth/register', data),
  logout: () => {
    clearStoredTokens();
    return Promise.resolve();
  },
  forgotPassword: (email) => apiClient.post('/api/v1/auth/forgot-password', { email }),
  resetPassword: (token, password) => apiClient.post('/api/v1/auth/reset-password', { token, password }),
  changePassword: (data) => apiClient.post('/api/v1/auth/change-password', data),
  verifyEmail: (token) => apiClient.post('/api/v1/auth/verify-email', { token }),
  resendVerification: (email) => apiClient.post('/api/v1/auth/resend-verification', { email }),
  getCurrentUser: () => apiClient.get('/api/v1/auth/me'),
};

export const productsApi = {
  list: (params) => apiClient.get('/api/v1/products', params),
  get: (id) => apiClient.get(`/api/v1/products/${id}`),
  search: (query) => apiClient.get('/api/v1/products/search', { q: query }),
  getRelated: (id) => apiClient.get(`/api/v1/products/${id}/related`),
};

export const collectionsApi = {
  list: () => apiClient.get('/api/v1/collections'),
  get: (slug) => apiClient.get(`/api/v1/collections/${slug}`),
  getProducts: (slug, params) => apiClient.get(`/api/v1/collections/${slug}/products`, params),
};

export const categoriesApi = {
  list: () => apiClient.get('/api/v1/categories'),
  get: (slug) => apiClient.get(`/api/v1/categories/${slug}`),
};

export const cartApi = {
  get: () => apiClient.get('/api/v1/cart'),
  addItem: (data) => apiClient.post('/api/v1/cart/items', data),
  updateQuantity: (productId, quantity) => apiClient.put(`/api/v1/cart/items/${productId}`, { quantity }),
  removeItem: (productId) => apiClient.delete(`/api/v1/cart/items/${productId}`),
  clear: () => apiClient.delete('/api/v1/cart'),
  applyPromo: (code) => apiClient.post('/api/v1/cart/promo', { code }),
};

export const ordersApi = {
  list: (params) => apiClient.get('/api/v1/orders', params),
  get: (id) => apiClient.get(`/api/v1/orders/${id}`),
  create: (data) => apiClient.post('/api/v1/orders', data),
  cancel: (id, reason) => apiClient.post(`/api/v1/orders/${id}/cancel`, { reason }),
  getTracking: (id) => apiClient.get(`/api/v1/orders/${id}/tracking`),
  getEvents: (id) => apiClient.get(`/api/v1/orders/${id}/events`),
};

export const returnsApi = {
  list: () => apiClient.get('/api/v1/returns'),
  get: (id) => apiClient.get(`/api/v1/returns/${id}`),
  create: (data) => apiClient.post('/api/v1/returns', data),
  cancel: (id) => apiClient.post(`/api/v1/returns/${id}/cancel`),
};

export const addressesApi = {
  list: () => apiClient.get('/api/v1/addresses'),
  get: (id) => apiClient.get(`/api/v1/addresses/${id}`),
  create: (data) => apiClient.post('/api/v1/addresses', data),
  update: (id, data) => apiClient.put(`/api/v1/addresses/${id}`, data),
  delete: (id) => apiClient.delete(`/api/v1/addresses/${id}`),
};

export const profileApi = {
  get: () => apiClient.get('/api/v1/profile'),
  update: (data) => apiClient.put('/api/v1/profile', data),
  getOrders: (params) => apiClient.get('/api/v1/profile/orders', params),
  getReturns: () => apiClient.get('/api/v1/profile/returns'),
};

export const chatApi = {
  getRooms: () => apiClient.get('/api/v1/chat/rooms'),
  createRoom: (subject) => apiClient.post('/api/v1/chat/rooms', { subject }),
  getMessages: (roomId) => apiClient.get(`/api/v1/chat/rooms/${roomId}/messages`),
  sendMessage: (roomId, message) => apiClient.post(`/api/v1/chat/rooms/${roomId}/messages`, { message }),
};

export const siteConfigApi = {
  get: () => apiClient.get('/api/v1/site-config'),
  getLanding: () => apiClient.get('/api/v1/site-config/landing'),
};

export const uploadApi = {
  upload: async (file, folder = 'products') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    
    const token = getAccessToken();
    const response = await fetch(`${getCoreBaseUrl()}/api/v1/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error.detail || 'Upload failed', response.status, 'UPLOAD_ERROR', error);
    }
    
    return response.json();
  },
};

// Export for advanced usage
export { apiClient, ApiClient, ApiError, getCoreBaseUrl, getAdminBaseUrl, getCommerceBaseUrl };

// Export auth helpers
export {
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
  getStoredUser,
  getAccessToken,
  setCookie,
  removeCookie,
};

// Default export
export default apiClient;
