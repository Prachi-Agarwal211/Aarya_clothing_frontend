/**
 * Customer API Client - Unified API calls for customer-facing pages
 * Integrates with Commerce Service (8010), Core Service (8001), and Payment Service (8020)
 * 
 * Refactored to use the shared BaseApiClient from baseApi.js
 */

import {
  BaseApiClient,
  getCoreBaseUrl,
  getCommerceBaseUrl,
  getPaymentBaseUrl,
  coreClient,
  commerceClient,
  paymentClient,
} from './baseApi';
import { sanitizeSearch } from './sanitize';

// ==================== Products API ====================
export const productsApi = {
  list: (params = {}) => {
    return commerceClient.get('/api/v1/products/browse', params);
  },

  get: (id) => {
    return commerceClient.get(`/api/v1/products/${id}`);
  },

  getBySlug: (slug) => {
    return commerceClient.get(`/api/v1/products/slug/${slug}`);
  },

  getFeatured: (limit = 8) =>
    commerceClient.get('/api/v1/products/featured', { limit }),

  getNewArrivals: (params = 8) =>
    commerceClient.get(
      '/api/v1/products/new-arrivals',
      typeof params === 'number' ? { limit: params } : params,
    ),

  search: (query, params = {}) =>
    // Sanitize search query to prevent XSS attacks
    commerceClient.get('/api/v1/products/search', { q: sanitizeSearch(query), ...params }),

  getRelated: (productId, limit = 4) =>
    commerceClient.get(`/api/v1/products/${productId}/related`, { limit }).catch(() =>
      commerceClient.get('/api/v1/products/featured', { limit })
    ),
};

// ==================== Collections API ====================
// Single canonical API — backend exposes /api/v1/collections
export const collectionsApi = {
  list: (params = {}) =>
    commerceClient.get('/api/v1/collections', params),

  get: (id) =>
    commerceClient.get(`/api/v1/collections/${id}`),

  getBySlug: (slug) =>
    commerceClient.get(`/api/v1/collections/slug/${slug}`),
};

// Backward-compat alias — new code should use collectionsApi
export const categoriesApi = collectionsApi;

// ==================== Cart API ====================
export const cartApi = {
  get: () =>
    commerceClient.get('/api/v1/cart'),

  addItem: (productId, quantity = 1, variantId = null) =>
    commerceClient.post('/api/v1/cart/items', {
      product_id: productId,
      quantity,
      variant_id: variantId,
    }),

  updateItem: (productId, quantity, variantId = null) =>
    commerceClient.put(`/api/v1/cart/items/${productId}`, { quantity, variant_id: variantId }),

  removeItem: (productId, variantId = null) =>
    commerceClient.delete(`/api/v1/cart/items/${productId}`, { params: { variant_id: variantId } }),

  clear: () =>
    commerceClient.delete('/api/v1/cart'),

  // Set delivery state for GST calculation (CGST+SGST vs IGST)
  setDeliveryState: (deliveryState, customerGstin = null) =>
    commerceClient.post('/api/v1/cart/delivery-state', {
      delivery_state: deliveryState,
      customer_gstin: customerGstin,
    }),

  // Validate stock for all cart items before checkout
  validateStock: () =>
    commerceClient.post('/api/v1/checkout/validate'),
};

// ==================== Invoices API ====================
export const invoicesApi = {
  getForOrder: (orderId) =>
    commerceClient.get(`/api/v1/orders/${orderId}`),
};

// ==================== Orders API ====================
export const ordersApi = {
  create: (data) =>
    commerceClient.post('/api/v1/orders', data),

  list: (params = {}) =>
    commerceClient.get('/api/v1/orders', params),

  get: (id) =>
    commerceClient.get(`/api/v1/orders/${id}`),

  // Alias for get — used in checkout confirm page refresh guard
  getById: (id) =>
    commerceClient.get(`/api/v1/orders/${id}`),

  cancel: (id) =>
    commerceClient.post(`/api/v1/orders/${id}/cancel`),

  track: (id) =>
    commerceClient.get(`/api/v1/orders/${id}/tracking`),
};

// ==================== Addresses API ====================
export const addressesApi = {
  list: () =>
    commerceClient.get('/api/v1/addresses'),

  get: (id) =>
    commerceClient.get(`/api/v1/addresses/${id}`),

  create: (data) =>
    commerceClient.post('/api/v1/addresses', data),

  update: (id, data) =>
    commerceClient.patch(`/api/v1/addresses/${id}`, data),

  delete: (id) =>
    commerceClient.delete(`/api/v1/addresses/${id}`),

  setDefault: (id) =>
    commerceClient.patch(`/api/v1/addresses/${id}`, { is_default: true }),
};

// ==================== Reviews API ====================
export const reviewsApi = {
  list: (productId, params = {}) =>
    commerceClient.get(`/api/v1/products/${productId}/reviews`, params),

  create: (data) =>
    commerceClient.post('/api/v1/reviews', data),

  uploadImage: async (formData) => {
    // Route is served by commerce (nginx → /api/v1/reviews/*)
    return commerceClient.uploadFile('/api/v1/reviews/upload-image', formData);
  },

  markHelpful: (reviewId) =>
    commerceClient.post(`/api/v1/reviews/${reviewId}/helpful`),

  delete: (reviewId) =>
    commerceClient.delete(`/api/v1/reviews/${reviewId}`),
};

// ==================== User Profile API ====================
export const userApi = {
  getProfile: () =>
    coreClient.get('/api/v1/users/me'),

  updateProfile: (data) =>
    coreClient.patch('/api/v1/users/me', data),

  changePassword: (data) =>
    coreClient.post('/api/v1/auth/change-password', data),
};

// ==================== Payment API ====================
export const paymentApi = {
  // Get public payment configuration (Razorpay only)
  getConfig: () =>
    paymentClient.get('/api/v1/payment/config'),

  // Razorpay: create order → returns { id, amount, currency, ... }
  createRazorpayOrder: (data) =>
    paymentClient.post('/api/v1/payments/razorpay/create-order', data),

  // Razorpay: verify HMAC signature after checkout completes
  verifyRazorpaySignature: (data) =>
    paymentClient.post('/api/v1/payments/razorpay/verify-signature', data),

  // Razorpay: create UPI QR code → returns { qr_code_id, image_url, expires_at, ... }
  createQrCode: (data) =>
    paymentClient.post('/api/v1/payments/razorpay/create-qr-code', data),

  // Razorpay: check QR code payment status
  checkQrStatus: (qrCodeId) =>
    paymentClient.post(`/api/v1/payments/razorpay/qr-status/${qrCodeId}`),

  getMethods: () =>
    paymentClient.get('/api/v1/payment/methods'),
};

// ==================== Chat API ====================
export const chatApi = {
  createRoom: (subject = null, orderId = null) =>
    commerceClient.post('/api/v1/chat/rooms', { subject, order_id: orderId }),

  getRooms: () =>
    commerceClient.get('/api/v1/chat/rooms/mine'),

  getMessages: (roomId) =>
    commerceClient.get(`/api/v1/chat/rooms/${roomId}/messages`),

  sendMessage: (roomId, message) =>
    commerceClient.post(`/api/v1/chat/rooms/${roomId}/messages`, { message }),
};

// ==================== Returns API ====================
export const returnsApi = {
  // Create a new return/exchange request
  create: (orderId, data) =>
    commerceClient.post('/api/v1/returns', {
      order_id: orderId,
      reason: data.reason,
      description: data.description,
      type: data.type || 'return',
      items: data.items || [],
      video_url: data.video_url || null,
      exchange_preference: data.exchange_preference || null,
    }),

  // List user's return requests
  list: (params = {}) =>
    commerceClient.get('/api/v1/returns', params),

  // Get return request details
  get: (id) =>
    commerceClient.get(`/api/v1/returns/${id}`),

  // Cancel a return request
  cancel: (id) =>
    commerceClient.post(`/api/v1/returns/${id}/cancel`),

  // Get return eligibility for an order
  getEligibility: (orderId) =>
    commerceClient.get(`/api/v1/returns/eligibility/${orderId}`),

  // Upload return images
  uploadImages: async (returnId, files) => {
    return commerceClient.uploadFile(`/api/v1/returns/${returnId}/images`, files);
  },

  // Upload return video
  uploadVideo: async (file, onProgress, signal) => {
    // For video uploads, we need to handle large files
    // Using XMLHttpRequest to track progress with abort support
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('video', file);

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload cancelled'));
        });
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve({ url: xhr.responseText });
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      // Get the base URL
      const baseUrl = getCommerceBaseUrl();
      xhr.open('POST', `${baseUrl}/api/v1/returns/upload-video`);
      xhr.withCredentials = true;
      
      xhr.send(formData);
    });
  },
};

// ==================== Landing / Site Config API ====================
// Landing: `/api/v1/landing/*` → admin. Site config: `/api/v1/site/*` → core.
// coreClient uses getCoreBaseUrl() (nginx gateway — see baseApi.js); naming is historical.
export const landingApi = {
  /**
   * @param {object} [requestOptions] - Pass `{ signal }` to abort (e.g. client-side timeout).
   */
  getAll: (requestOptions = {}) => {
    if (requestOptions?.signal) {
      return coreClient.fetch('/api/v1/landing/all', { signal: requestOptions.signal });
    }
    return coreClient.get('/api/v1/landing/all');
  },

  getConfig: () =>
    coreClient.get('/api/v1/landing/config'),

  getImages: (section = null) =>
    coreClient.get('/api/v1/landing/images', section ? { section } : {}),

  getSiteConfig: () =>
    coreClient.get('/api/v1/site/config'),
};

// ==================== Auth API ====================
export const authApi = {
  login: (credentials) =>
    coreClient.post('/api/v1/auth/login', credentials),

  register: (data) =>
    coreClient.post('/api/v1/auth/register', data),

  logout: () =>
    coreClient.post('/api/v1/auth/logout'),

  forgotPassword: (identifier, otpType = 'EMAIL') =>
    coreClient.post('/api/v1/auth/forgot-password-otp', { identifier, otp_type: otpType }),

  verifyResetOtp: (identifier, otpCode, otpType = 'EMAIL') =>
    coreClient.post('/api/v1/auth/verify-reset-otp', { identifier, otp_code: otpCode, otp_type: otpType }),

  resetPasswordWithOtp: (identifier, otpCode, newPassword, otpType = 'EMAIL') =>
    coreClient.post('/api/v1/auth/reset-password-with-otp', {
      identifier,
      otp_code: otpCode,
      new_password: newPassword,
      otp_type: otpType,
    }),

  changePassword: (data) =>
    coreClient.post('/api/v1/auth/change-password', data),

  verifyEmail: (token) =>
    coreClient.post('/api/v1/auth/verify-email', { token }),

  // FastAPI expects `email` as a query parameter on this POST route
  resendVerification: (email) =>
    coreClient.post(
      `/api/v1/auth/resend-verification?email=${encodeURIComponent(email)}`,
      {},
    ),

  getCurrentUser: () =>
    coreClient.get('/api/v1/users/me'),

  verifyOtpRegistration: (params) =>
    coreClient.post('/api/v1/auth/verify-otp-registration', {
      otp_code: params.otp_code,
      ...(params.email != null ? { email: params.email } : {}),
      ...(params.phone != null ? { phone: params.phone } : {}),
      otp_type: params.otp_type,
    }),

  resendVerificationOtp: (params) =>
    coreClient.post('/api/v1/auth/send-verification-otp', {
      ...(params.email != null ? { email: params.email } : {}),
      ...(params.phone != null ? { phone: params.phone } : {}),
      otp_type: params.otp_type,
    }),
};

// Low-level fetch bound to coreClient — for one-off requests that don't fit a namespace
export const apiFetch = coreClient.fetch.bind(coreClient);

// Export all APIs as a single object
export const customerApi = {
  products: productsApi,
  categories: categoriesApi,
  collections: collectionsApi,
  cart: cartApi,
  orders: ordersApi,
  addresses: addressesApi,
  reviews: reviewsApi,
  user: userApi,
  payment: paymentApi,
  chat: chatApi,
  returns: returnsApi,
  landing: landingApi,
  auth: authApi,
};

export { coreClient, commerceClient, paymentClient };

export default customerApi;
