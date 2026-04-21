/**
 * Admin API Client - Unified API calls for admin dashboard
 * Uses baseApi for authentication and request handling
 * 
 * Service routing (handled by nginx):
 * - /api/v1/auth/* → Core Service (5001)
 * - /api/v1/users/* → Core Service (5001)
 * - /api/v1/admin/* → Admin Service (5004)
 * - /api/v1/staff/* → Admin Service (5004)
 * - /api/v1/products/* → Commerce Service (5002)
 * - /api/v1/cart/* → Commerce Service (5002)
 * - /api/v1/orders/* → Commerce Service (5002)
 * - /api/v1/payments/* → Payment Service (5003)
 */

import { adminClient } from './baseApi';

// ==================== Dashboard API ====================
export const dashboardApi = {
  getOverview: () => 
    adminClient.get('/api/v1/admin/dashboard/overview'),

  getRevenueAnalytics: (period = '30d') => 
    adminClient.get('/api/v1/admin/analytics/revenue', { period }),

  getCustomerAnalytics: () => 
    adminClient.get('/api/v1/admin/analytics/customers'),

  getTopProducts: (period = '30d', limit = 10) => 
    adminClient.get('/api/v1/admin/analytics/products/top-selling', { period, limit }),

  getProductPerformance: (period = '30d', limit = 20) => 
    adminClient.get('/api/v1/admin/analytics/products/performance', { period, limit }),
};

// ==================== Orders API ====================
export const ordersApi = {
  list: (params = {}) => {
    const { page, limit = 1000, ...rest } = params;
    const normalizedPage = Number(page) > 0 ? Number(page) : 1;

    return adminClient.get('/api/v1/admin/orders', {
      ...rest,
      limit,
      skip: (normalizedPage - 1) * limit,
    });
  },

  get: (id) => 
    adminClient.get(`/api/v1/admin/orders/${id}`),

  updateStatus: (id, { status, pod_number, tracking_number, courier_name, notes }) =>
    adminClient.patch(`/api/v1/admin/orders/${id}/status`, {
      status,
      pod_number: pod_number || tracking_number || undefined,
      tracking_number: pod_number || tracking_number || undefined,
      courier_name: courier_name || undefined,
      notes: notes || undefined,
    }),

  bulkUpdate: ({ order_ids, status, pod_number, courier_name, notes }) =>
    adminClient.patch('/api/v1/admin/orders/bulk-status', {
      order_ids,
      status,
      pod_number: pod_number || undefined,
      courier_name: courier_name || undefined,
      notes: notes || undefined,
    }),

  getTracking: (id) =>
    adminClient.get(`/api/v1/admin/orders/${id}/tracking`),

  exportExcel: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.from_date) query.set('from_date', params.from_date);
    if (params.to_date) query.set('to_date', params.to_date);
    const qs = query.toString();
    return `/api/v1/admin/orders/export/excel${qs ? `?${qs}` : ''}`;
  },

  shipOrder: (id, pod_number, notes) =>
    adminClient.put(`/api/v1/staff/orders/${id}/ship`, {
      tracking_number: pod_number,
      notes: notes || `Order shipped — POD: ${pod_number}`,
    }),

  deliverOrder: (id) =>
    adminClient.put(`/api/v1/staff/orders/${id}/deliver`, {}),

  downloadPodTemplate: () =>
    `/api/v1/admin/orders/pod-template`,

  uploadPodExcel: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/v1/admin/orders/upload-pod-excel', {
      method: 'POST',
      body: formData,
      credentials: 'include', // Send cookies automatically
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },
};

// ==================== AI API ====================
export const aiApi = {
  customerChat: (message, sessionId, language = 'auto') =>
    adminClient.post('/api/v1/ai/customer/chat', { message, session_id: sessionId, language }),

  adminChat: (message, sessionId, images) =>
    adminClient.post('/api/v1/ai/admin/chat', { message, session_id: sessionId, images }),

  getAnalytics: (days = 30) =>
    adminClient.get('/api/v1/ai/admin/analytics', { days }),

  getSessions: (role, days = 30) =>
    adminClient.get('/api/v1/ai/admin/sessions', { role, days }),

  getMonitoring: (days = 30, role = null) =>
    adminClient.get('/api/v1/ai/admin/monitoring', role ? { days, role } : { days }),

  getSessionMessages: (sessionId) =>
    adminClient.get(`/api/v1/ai/admin/sessions/${sessionId}/messages`),

  exportCsv: (days = 30, role = null) => {
    const q = new URLSearchParams({ days });
    if (role) q.set('role', role);
    return fetch(`/api/v1/ai/admin/export/csv?${q}`, {
      credentials: 'include', // Send cookies automatically
    });
  },

  executeAction: (action_type, params) =>
    adminClient.post('/api/v1/ai/admin/execute-action', { action_type, params }),
};

// ==================== AI Settings API (Super Admin Only) ====================
export const aiSettingsApi = {
  getAll: () =>
    adminClient.get('/api/v1/super/ai-settings'),

  update: (key, value) =>
    adminClient.put(`/api/v1/super/ai-settings/${key}`, { value }),

  bulkUpdate: (settings) =>
    adminClient.put('/api/v1/super/ai-settings/bulk', { settings }),

  testKey: (api_key, provider = 'gemini') =>
    adminClient.post('/api/v1/super/ai-settings/test-key', { api_key, provider }),
};

// ==================== AI Monitoring API (Super Admin Only) ====================
export const aiMonitoringApi = {
  get: (days = 30, role = null) => {
    const params = { days };
    if (role) params.role = role;
    return adminClient.get('/api/v1/super/ai-monitoring', params);
  },
};

// ==================== Users/Customers API ====================
export const usersApi = {
  list: (params = {}) => 
    adminClient.get('/api/v1/admin/users', params),

  count: (params = {}) =>
    adminClient.get('/api/v1/admin/users/count', params),

  get: (id) => 
    adminClient.get(`/api/v1/admin/users/${id}`),

  create: (data) =>
    adminClient.post('/api/v1/admin/users', data),

  update: (id, data) =>
    adminClient.patch(`/api/v1/admin/users/${id}`, data),

  updateStatus: (id, isActive) => 
    adminClient.put(`/api/v1/admin/users/${id}/status`, { is_active: isActive }),

  bulkStatus: (userIds, isActive) =>
    adminClient.patch('/api/v1/admin/users/bulk-status', { user_ids: userIds, is_active: isActive }),
};

// ==================== Products API ====================
export const productsApi = {
  list: (params = {}) => {
    return adminClient.get('/api/v1/admin/products', params);
  },

  get: (id) => {
    return adminClient.get(`/api/v1/admin/products/${id}`);
  },

  create: (data) => {
    return adminClient.post('/api/v1/admin/products', data);
  },

  update: (id, data) => {
    return adminClient.patch(`/api/v1/admin/products/${id}`, data);
  },

  delete: (id) => {
    return adminClient.delete(`/api/v1/admin/products/${id}`);
  },

  // Image management
  uploadImage: (productId, file, isPrimary = false, altText = '') => {
    const params = new URLSearchParams();
    if (isPrimary) params.append('is_primary', 'true');
    if (altText) params.append('alt_text', altText);
    return adminClient.uploadFile(
      `/api/v1/admin/products/${productId}/images?${params}`, file
    );
  },

  deleteImage: (productId, imageId) =>
    adminClient.delete(`/api/v1/admin/products/${productId}/images/${imageId}`),

  reorderImages: (productId, imageIds) =>
    adminClient.patch(`/api/v1/admin/products/${productId}/images/reorder`, imageIds),

  setPrimaryImage: (productId, imageId) =>
    adminClient.patch(`/api/v1/admin/products/${productId}/images/${imageId}/primary`),

  // Variant/Inventory management (unified)
  getVariants: (productId) =>
    adminClient.get(`/api/v1/admin/products/${productId}/variants`),

  createVariant: (productId, data) =>
    adminClient.post(`/api/v1/admin/products/${productId}/variants`, data),
  // data: { sku, size, color, quantity, low_stock_threshold, price? }

  updateVariant: (productId, variantId, data) =>
    adminClient.patch(`/api/v1/admin/products/${productId}/variants/${variantId}`, data),

  deleteVariant: (productId, variantId) =>
    adminClient.delete(`/api/v1/admin/products/${productId}/variants/${variantId}`),

  adjustVariantStock: (productId, variantId, adjustment, reason = '') =>
    adminClient.post(`/api/v1/admin/products/${productId}/variants/${variantId}/adjust-stock`, {
      sku: '',  // Will be determined by backend
      adjustment,
      reason
    }),

  // Bulk operations
  bulkPrice: (data) =>
    adminClient.post('/api/v1/admin/products/bulk/price', data),
  // data: { product_ids, price?, mrp?, price_adjustment?, price_percentage? }

  bulkStatus: (data) =>
    adminClient.post('/api/v1/admin/products/bulk/status', data),
  // data: { product_ids, is_active?, is_featured?, is_new_arrival? }

  bulkAssignCollection: (data) =>
    adminClient.post('/api/v1/admin/products/bulk/collection', data),
  // data: { product_ids, collection_id }

  bulkInventory: (updates) =>
    adminClient.post('/api/v1/admin/products/bulk/inventory', { updates }),
  // updates: [{ sku, quantity }, ...]

  bulkDelete: (productIds) =>
    adminClient.post('/api/v1/admin/products/bulk/delete', { product_ids: productIds }),
};

// ==================== Collections API (unified categories = collections) ====================
export const collectionsApi = {
  list: (params = {}) =>
    adminClient.get('/api/v1/admin/collections', params),

  create: (data) =>
    adminClient.post('/api/v1/admin/collections', data),

  update: (id, data) =>
    adminClient.patch(`/api/v1/admin/collections/${id}`, data),

  delete: (id) =>
    adminClient.delete(`/api/v1/admin/collections/${id}`),

  uploadImage: (collectionId, file) =>
    adminClient.uploadFile(`/api/v1/admin/categories/${collectionId}/image`, file),

  deleteImage: (collectionId) =>
    adminClient.delete(`/api/v1/admin/categories/${collectionId}/image`),

  bulkStatus: (ids, isActive) =>
    adminClient.post('/api/v1/admin/collections/bulk/status', { ids, is_active: isActive }),

  bulkReorder: (items) =>
    adminClient.post('/api/v1/admin/collections/bulk/reorder', { items }),
  // items: [{ id, display_order }, ...]
};

// Backward compat alias
export const categoriesApi = collectionsApi;

// ==================== Inventory API ====================
export const inventoryApi = {
  list: (params = {}) =>
    adminClient.get('/api/v1/admin/inventory', params),

  getLowStock: () =>
    adminClient.get('/api/v1/admin/inventory/low-stock'),

  getOutOfStock: () =>
    adminClient.get('/api/v1/admin/inventory/out-of-stock'),

  create: (data) =>
    adminClient.post('/api/v1/admin/inventory', data),

  update: (id, data) =>
    adminClient.patch(`/api/v1/admin/inventory/${id}`, data),

  adjustStock: (data) =>
    adminClient.post('/api/v1/admin/inventory/adjust', data),
  // data: { sku, adjustment, reason }

  bulkUpdate: (updates) =>
    adminClient.post('/api/v1/admin/products/bulk/inventory', { updates }),
  // updates: [{ sku, quantity }, ...]

  getMovements: (params = {}) =>
    adminClient.get('/api/v1/admin/inventory/movements', params),
};

// ==================== Chat API ====================
export const chatApi = {
  getRooms: (status = null) => 
    adminClient.get('/api/v1/admin/chat/rooms', status ? { status } : {}),

  getMessages: (roomId) => 
    adminClient.get(`/api/v1/admin/chat/rooms/${roomId}/messages`),

  sendMessage: (roomId, message, senderType = 'admin') => 
    adminClient.post(`/api/v1/admin/chat/rooms/${roomId}/messages`, { message, sender_type: senderType }),

  assignRoom: (roomId) => 
    adminClient.put(`/api/v1/admin/chat/rooms/${roomId}/assign`),

  closeRoom: (roomId) => 
    adminClient.put(`/api/v1/admin/chat/rooms/${roomId}/close`),
};

// ==================== Landing Config API ====================
export const landingApi = {
  getConfig: () => 
    adminClient.get('/api/v1/admin/landing/config'),

  updateSection: (section, config, isActive = null) => 
    adminClient.put(`/api/v1/admin/landing/config/${section}`, { config, is_active: isActive }),

  getImages: (section = null) => 
    adminClient.get('/api/v1/admin/landing/images', section ? { section } : {}),

  addImage: (data) => 
    adminClient.post('/api/v1/admin/landing/images', data),

  uploadImage: async (file, section, metadata = {}) => {
    const params = new URLSearchParams({ section });
    if (metadata.title) params.append('title', metadata.title);
    if (metadata.subtitle) params.append('subtitle', metadata.subtitle);
    if (metadata.link_url) params.append('link_url', metadata.link_url);
    if (metadata.display_order != null) params.append('display_order', metadata.display_order);
    if (metadata.device_variant) params.append('device_variant', metadata.device_variant);
    return adminClient.uploadFile(`/api/v1/admin/landing/images/upload?${params}`, file);
  },

  updateImage: (imageId, data) => {
    const params = new URLSearchParams();
    if (data.title != null) params.append('title', data.title);
    if (data.subtitle != null) params.append('subtitle', data.subtitle);
    if (data.link_url != null) params.append('link_url', data.link_url);
    if (data.display_order != null) params.append('display_order', data.display_order);
    if (data.is_active != null) params.append('is_active', data.is_active);
    return adminClient.patch(`/api/v1/admin/landing/images/${imageId}?${params}`);
  },

  reorderImages: (section, orderedIds) =>
    adminClient.post(`/api/v1/admin/landing/images/reorder?section=${encodeURIComponent(section)}`, orderedIds),

  deleteImage: (imageId) => 
    adminClient.delete(`/api/v1/admin/landing/images/${imageId}`),

  // Landing Products (admin-selected products for sections like newArrivals)
  getLandingProducts: (section = null) =>
    adminClient.get('/api/v1/admin/landing/products', section ? { section } : {}),

  addLandingProduct: (data) =>
    adminClient.post('/api/v1/admin/landing/products', data),

  updateLandingProduct: (landingProductId, data) => {
    const params = new URLSearchParams();
    if (data.display_order != null) params.append('display_order', data.display_order);
    if (data.is_active != null) params.append('is_active', data.is_active);
    return adminClient.patch(`/api/v1/admin/landing/products/${landingProductId}`, data);
  },

  deleteLandingProduct: (landingProductId) =>
    adminClient.delete(`/api/v1/admin/landing/products/${landingProductId}`),

  reorderLandingProducts: (section, orderedIds) =>
    adminClient.post(`/api/v1/admin/landing/products/reorder?section=${encodeURIComponent(section)}`, orderedIds),
};

// ==================== Site Config API ====================
export const siteConfigApi = {
  getConfig: () => 
    adminClient.get('/api/v1/admin/site/config'),
    
  updateConfig: (data) => 
    adminClient.put('/api/v1/admin/site/config', data),
};

// ==================== Upload API ====================
export const uploadApi = {
  getPresignedUrl: (filename, folder = 'landing', contentType = 'image/jpeg') =>
    adminClient.post('/api/v1/admin/upload/presigned-url', null, { params: {
      filename,
      folder,
      content_type: contentType
    } }),

  uploadImage: (file, folder = 'landing') =>
    adminClient.uploadFile(`/api/v1/admin/upload/image?folder=${folder}`, file),

  deleteImage: (imageUrl) =>
    adminClient.delete(`/api/v1/admin/upload/image?image_url=${encodeURIComponent(imageUrl)}`),

  uploadVideo: (file, folder = 'videos') =>
    adminClient.uploadFile(`/api/v1/admin/upload/video?folder=${folder}`, file),

  deleteVideo: (videoUrl) =>
    adminClient.delete(`/api/v1/admin/upload/video?video_url=${encodeURIComponent(videoUrl)}`),

  uploadLandingVideo: (file, deviceVariant = 'desktop') =>
    adminClient.uploadFile(`/api/v1/admin/landing/videos/upload?device_variant=${deviceVariant}`, file),
};

// ==================== Staff API ====================
export const staffApi = {
  getDashboard: () => 
    adminClient.get('/api/v1/staff/dashboard'),

  getPendingOrders: () => 
    adminClient.get('/api/v1/staff/orders/confirmed'),

  getProcessingOrders: () => 
    adminClient.get('/api/v1/staff/orders/confirmed'),

  processOrder: (orderId, notes = '') => 
    adminClient.put(`/api/v1/staff/orders/${orderId}/ship`, { notes }),

  shipOrder: (orderId, trackingNumber, notes = '') => 
    adminClient.put(`/api/v1/staff/orders/${orderId}/ship`, { tracking_number: trackingNumber, notes }),

  bulkProcessOrders: (orderIds, notes = '') => 
    adminClient.post('/api/v1/staff/reservations/confirm', { order_ids: orderIds, notes }),

  getTasks: () => 
    adminClient.get('/api/v1/staff/tasks'),

  completeTask: (taskId, notes = '') => 
    adminClient.post(`/api/v1/staff/tasks/${taskId}/complete`, { notes }),

  getNotifications: () => 
    adminClient.get('/api/v1/staff/notifications'),

  markNotificationRead: (notifId) => 
    adminClient.put(`/api/v1/staff/notifications/${notifId}/read`),

  getQuickActions: () => 
    adminClient.get('/api/v1/staff/quick-actions'),

  getInventorySummary: () => 
    adminClient.get('/api/v1/staff/reports/inventory/summary'),

  getProcessedOrdersReport: () => 
    adminClient.get('/api/v1/staff/reports/orders/processed'),
};

// ==================== Returns API ====================
export const returnsApi = {
  list: (params = {}) =>
    adminClient.get('/api/v1/admin/returns', {
      ...params,
      status_filter: params.status && params.status !== 'all' ? params.status : undefined,
    }),

  get: (id) =>
    adminClient.get(`/api/v1/admin/returns/${id}`),

  updateStatus: (id, { status, note, refund_amount, tracking_number }) => {
    if (status === 'approved') {
      return adminClient.post(`/api/v1/admin/returns/${id}/approve`, refund_amount != null ? { refund_amount } : {});
    }

    if (status === 'rejected') {
      return adminClient.post(`/api/v1/admin/returns/${id}/reject`, { reason: note || '' });
    }

    if (status === 'received') {
      return adminClient.post(`/api/v1/admin/returns/${id}/receive`, tracking_number ? { tracking_number } : {});
    }

    if (status === 'refunded') {
      return adminClient.post(`/api/v1/admin/returns/${id}/refund`, { refund_transaction_id: note || `manual_refund_${id}` });
    }

    return Promise.reject(new Error(`Unsupported return status transition: ${status}`));
  },

  approve: (id, refundAmount = null) =>
    adminClient.post(`/api/v1/admin/returns/${id}/approve`, refundAmount ? { refund_amount: refundAmount } : {}),

  reject: (id, reason) =>
    adminClient.post(`/api/v1/admin/returns/${id}/reject`, { reason }),

  markReceived: (id, trackingNumber = null) =>
    adminClient.post(`/api/v1/admin/returns/${id}/receive`, trackingNumber ? { tracking_number: trackingNumber } : {}),

  processRefund: (id, refundData) => {
    const refundTransactionId = typeof refundData === 'string'
      ? refundData
      : refundData?.refund_transaction_id || refundData?.note || `manual_refund_${id}`;

    return adminClient.post(`/api/v1/admin/returns/${id}/refund`, { refund_transaction_id: refundTransactionId });
  },

  bulkApprove: (returnIds, refundAmount = null) =>
    adminClient.post('/api/v1/admin/returns/bulk/approve', {
      return_ids: returnIds,
      refund_amount: refundAmount
    }),

  bulkReject: (returnIds, reason) =>
    adminClient.post('/api/v1/admin/returns/bulk/reject', {
      return_ids: returnIds,
      reason
    }),
};

// ==================== Super Admin AI Dashboard API ====================
export const aiDashboardApi = {
  getTools: () =>
    adminClient.get('/api/v1/admin/ai-dashboard/tools'),

  executeQuery: (tool, args = {}) =>
    adminClient.post('/api/v1/admin/ai-dashboard/query', { tool, args }),

  getInsights: (focusArea = 'all') =>
    adminClient.get('/api/v1/admin/ai-dashboard/insights', { focus_area: focusArea }),

  getPendingActions: (status = 'pending') =>
    adminClient.get('/api/v1/admin/ai-dashboard/pending-actions', { status }),

  approveAction: (actionId) =>
    adminClient.post(`/api/v1/admin/ai-dashboard/pending-actions/${actionId}/approve`),

  rejectAction: (actionId, reason) =>
    adminClient.post(`/api/v1/admin/ai-dashboard/pending-actions/${actionId}/reject`, null, { params: { reason } }),
};

// ==================== Staff Management API ====================
export const staffManagementApi = {
  // Custom Roles
  createRole: (roleData) =>
    adminClient.post('/api/v1/admin/staff/roles', roleData),

  listRoles: (activeOnly = false) =>
    adminClient.get('/api/v1/admin/staff/roles', { active_only: activeOnly }),

  getRole: (roleId) =>
    adminClient.get(`/api/v1/admin/staff/roles/${roleId}`),

  updateRole: (roleId, roleData) =>
    adminClient.put(`/api/v1/admin/staff/roles/${roleId}`, roleData),

  deleteRole: (roleId) =>
    adminClient.delete(`/api/v1/admin/staff/roles/${roleId}`),

  getPermissionPresets: () =>
    adminClient.get('/api/v1/admin/staff/permission-presets'),

  // Staff Accounts
  createAccount: (accountData) =>
    adminClient.post('/api/v1/admin/staff/accounts', accountData),

  listAccounts: (params = {}) =>
    adminClient.get('/api/v1/admin/staff/accounts', params),

  getAccount: (userId) =>
    adminClient.get(`/api/v1/admin/staff/accounts/${userId}`),

  updateAccount: (userId, accountData) =>
    adminClient.put(`/api/v1/admin/staff/accounts/${userId}`, accountData),

  deactivateAccount: (userId) =>
    adminClient.post(`/api/v1/admin/staff/accounts/${userId}/deactivate`),

  deleteAccount: (userId) =>
    adminClient.delete(`/api/v1/admin/staff/accounts/${userId}`),

  // Access Control
  createIPRestriction: (restrictionData) =>
    adminClient.post('/api/v1/admin/staff/access/ip-restrictions', restrictionData),

  getIPRestrictions: (staffId) =>
    adminClient.get(`/api/v1/admin/staff/access/ip-restrictions/${staffId}`),

  deleteIPRestriction: (restrictionId) =>
    adminClient.delete(`/api/v1/admin/staff/access/ip-restrictions/${restrictionId}`),

  createTimeRestriction: (restrictionData) =>
    adminClient.post('/api/v1/admin/staff/access/time-restrictions', restrictionData),

  getTimeRestrictions: (staffId) =>
    adminClient.get(`/api/v1/admin/staff/access/time-restrictions/${staffId}`),

  deleteTimeRestriction: (restrictionId) =>
    adminClient.delete(`/api/v1/admin/staff/access/time-restrictions/${restrictionId}`),

  // Security
  setup2FA: (staffId) =>
    adminClient.post('/api/v1/admin/staff/security/2fa/setup', { staff_id: staffId, enable: true }),

  verify2FA: (staffId, code) =>
    adminClient.post('/api/v1/admin/staff/security/2fa/verify', { staff_id: staffId, code }),

  toggle2FA: (staffId, enable) =>
    adminClient.post('/api/v1/admin/staff/security/2fa/toggle', { staff_id: staffId, enable }),

  // Session Management
  getSessions: (userId) =>
    adminClient.get(`/api/v1/admin/staff/sessions/${userId}`),

  invalidateSession: (sessionId) =>
    adminClient.delete(`/api/v1/admin/staff/sessions/${sessionId}`),

  invalidateAllSessions: (userId) =>
    adminClient.post(`/api/v1/admin/staff/sessions/${userId}/invalidate-all`),

  // Audit Logs
  getAuditLogs: (params = {}) =>
    adminClient.get('/api/v1/admin/staff/audit-logs', params),

  exportAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `/api/v1/admin/staff/audit-logs/export${qs ? `?${qs}` : ''}`;
  },

  // Tasks
  createTask: (taskData) =>
    adminClient.post('/api/v1/admin/staff/tasks', taskData),

  listTasks: (params = {}) =>
    adminClient.get('/api/v1/admin/staff/tasks', params),

  updateTask: (taskId, taskData) =>
    adminClient.put(`/api/v1/admin/staff/tasks/${taskId}`, taskData),

  // Staff Dashboard
  getStaffDashboard: () =>
    adminClient.get('/api/v1/admin/staff/dashboard'),

  getActivityTimeline: (limit = 50) =>
    adminClient.get('/api/v1/admin/staff/activity-timeline', { limit }),

  // Permission Checks
  checkPermission: (module, action) =>
    adminClient.get('/api/v1/admin/staff/permissions/check', { module, action }),

  getModulePermissions: (module) =>
    adminClient.get('/api/v1/admin/staff/permissions/modules', { module }),
};

// Export all APIs as a single object
export const adminApi = {
  dashboard: dashboardApi,
  orders: ordersApi,
  users: usersApi,
  products: productsApi,
  collections: collectionsApi,
  categories: collectionsApi,  // backward compat
  inventory: inventoryApi,
  chat: chatApi,
  landing: landingApi,
  siteConfig: siteConfigApi,
  upload: uploadApi,
  staff: staffApi,
  returns: returnsApi,
  aiSettings: aiSettingsApi,
  aiDashboard: aiDashboardApi,
  staffManagement: staffManagementApi,
};

export default adminApi;
export { adminClient };
