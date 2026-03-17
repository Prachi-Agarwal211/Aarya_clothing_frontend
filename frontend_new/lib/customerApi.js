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
} from './baseApi';

// Create client instances for different services
const coreClient = new BaseApiClient(getCoreBaseUrl());
const commerceClient = new BaseApiClient(getCommerceBaseUrl());
const paymentClient = new BaseApiClient(getPaymentBaseUrl());

// ==================== Products API ====================
export const productsApi = {
  list: (params = {}) =>
    commerceClient.get('/api/v1/products', params),

  get: (id) =>
    commerceClient.get(`/api/v1/products/${id}`),

  getBySlug: (slug) =>
    commerceClient.get(`/api/v1/products/slug/${slug}`),

  getFeatured: (limit = 8) =>
    commerceClient.get('/api/v1/products/featured', { limit }),

  getNewArrivals: (params = 8) =>
    commerceClient.get(
      '/api/v1/products/new-arrivals',
      typeof params === 'number' ? { limit: params } : params,
    ),

  search: (query, params = {}) =>
    commerceClient.get('/api/v1/products/search', { q: query, ...params }),
};

// ==================== Categories API ====================
export const categoriesApi = {
  list: () =>
    commerceClient.get('/api/v1/categories'),

  get: (id) =>
    commerceClient.get(`/api/v1/categories/${id}`),

  getBySlug: (slug) =>
    commerceClient.get(`/api/v1/categories/slug/${slug}`),

  getTree: () =>
    commerceClient.get('/api/v1/categories/tree'),
};

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
    commerceClient.put(`/api/v1/cart/items/${productId}`, { quantity }, { params: { variant_id: variantId } }),

  removeItem: (productId, variantId = null) =>
    commerceClient.delete(`/api/v1/cart/items/${productId}`, { params: { variant_id: variantId } }),

  clear: () =>
    commerceClient.delete('/api/v1/cart'),

  applyCoupon: (code) =>
    commerceClient.post(`/api/v1/cart/coupon?promo_code=${encodeURIComponent(code)}`),

  removeCoupon: () =>
    commerceClient.delete('/api/v1/cart/coupon'),

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

// ==================== Wishlist API ====================
export const wishlistApi = {
  get: () =>
    commerceClient.get('/api/v1/wishlist'),

  list: () =>
    commerceClient.get('/api/v1/wishlist'),

  add: (productId) =>
    commerceClient.post('/api/v1/wishlist/items', { product_id: productId }),

  remove: (productId) =>
    commerceClient.delete(`/api/v1/wishlist/items/${productId}`),

  check: (productId) =>
    commerceClient.get(`/api/v1/wishlist/check/${productId}`),
};

// ==================== Reviews API ====================
export const reviewsApi = {
  list: (productId, params = {}) =>
    commerceClient.get(`/api/v1/products/${productId}/reviews`, params),

  create: (productId, data) =>
    commerceClient.post('/api/v1/reviews', { ...data, product_id: productId }),

  update: (reviewId, data) =>
    Promise.reject(new Error(`Review updates are not supported for review ${reviewId}`)),

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
  // Get public payment configuration (includes Razorpay key_id)
  getConfig: () =>
    paymentClient.get('/api/v1/payment/config'),

  // Razorpay: create order → returns { id, amount, currency, ... }
  createRazorpayOrder: (data) =>
    paymentClient.post('/api/v1/payments/razorpay/create-order', data),

  // Razorpay: verify HMAC signature after checkout completes
  verifyRazorpaySignature: (data) =>
    paymentClient.post('/api/v1/payments/razorpay/verify-signature', data),

  getMethods: () =>
    paymentClient.get('/api/v1/payments/methods'),
};

// ==================== Promotions API ====================
export const promotionsApi = {
  validate: (code, orderTotal, userId = null) =>
    commerceClient.post('/api/v1/promotions/validate', {
      code,
      order_total: orderTotal,
      user_id: userId
    }),
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
};

// Export all APIs as a single object
export const customerApi = {
  products: productsApi,
  categories: categoriesApi,
  cart: cartApi,
  orders: ordersApi,
  addresses: addressesApi,
  wishlist: wishlistApi,
  reviews: reviewsApi,
  user: userApi,
  payment: paymentApi,
  promotions: promotionsApi,
  chat: chatApi,
  returns: returnsApi,
};

export default customerApi;
