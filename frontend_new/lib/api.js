/**
 * Core API Client for Aarya Clothing
 * Handles authentication and core service API calls
 * 
 * SECURITY: Auth bypass has been completely removed.
 * All requests require proper authentication via JWT tokens.
 */

import { coreClient, adminClient, setAuthData, clearAuthData, getRefreshToken } from './baseApi';

// ==================== Authentication API ====================

/**
 * Login with credentials
 * SECURITY: Tokens are stored in HttpOnly cookies by backend, not localStorage
 */
export async function login(credentials) {
  const response = await coreClient.post('/api/v1/auth/login', credentials);
  
  // SECURITY: Only store user data, NOT tokens
  // Tokens are automatically stored in HttpOnly cookies by backend
  setAuthData({
    user: response.user,
  });
  
  return response;
}

/**
 * Logout and clear all stored tokens
 */
export async function logout() {
  clearAuthData();
  try {
    await coreClient.post('/api/v1/auth/logout');
  } catch (e) {
    console.warn("Logout API call failed", e);
  }
}

/**
 * Register a new user
 */
export async function register(userData) {
  return coreClient.post('/api/v1/auth/register', userData);
}

/**
 * Refresh the access token
 * SECURITY: Tokens are stored in HttpOnly cookies by backend
 */
export async function refreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');
  
  const response = await coreClient.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
  
  // SECURITY: Tokens are in HttpOnly cookies, no localStorage storage needed
  // Only update user data if present
  if (response.user) {
    setAuthData({ user: response.user });
  }
  
  return response;
}

/**
 * Send OTP for phone verification
 */
export async function sendOtp(phone) {
  return coreClient.post('/api/v1/auth/send-otp', { phone });
}

/**
 * Verify OTP code
 */
export async function verifyOtp(phone, otp) {
  return coreClient.post('/api/v1/auth/verify-otp', { phone, otp });
}

/**
 * Request password reset
 */
export async function forgotPassword(email) {
  return coreClient.post('/api/v1/auth/forgot-password', { email });
}

/**
 * Reset password with token
 */
export async function resetPassword(token, newPassword) {
  return coreClient.post('/api/v1/auth/reset-password', { token, new_password: newPassword });
}

// ==================== User API ====================

/**
 * Get current user profile
 */
export async function getCurrentUser() {
  return coreClient.get('/api/v1/users/me');
}

/**
 * Update current user profile
 */
export async function updateProfile(data) {
  return coreClient.patch('/api/v1/users/me', data);
}

/**
 * Change user password
 */
export async function changePassword(data) {
  return coreClient.post('/api/v1/auth/change-password', data);
}

// ==================== Public Landing API (No Auth Required) ====================

/**
 * Get landing page configuration (public, no auth required)
 */
export async function getLandingConfig() {
  return adminClient.get('/api/v1/landing/config');
}

/**
 * Get landing page images (public, no auth required)
 */
export async function getLandingImages(section = null) {
  const params = section ? { section } : {};
  return adminClient.get('/api/v1/landing/images', params);
}

/**
 * Get all landing page data in a single request (public, no auth required)
 * This is the recommended endpoint for the landing page
 */
export async function getLandingAll() {
  return adminClient.get('/api/v1/landing/all');
}

/**
 * Get site-wide configuration (logo, video URLs, etc.) from backend.
 * Frontend should use this instead of hard-coded R2 URLs.
 * Backend is the single source of truth for all asset URLs.
 */
export async function getSiteConfig() {
  return adminClient.get('/api/v1/site/config');
}

// ==================== Exports ====================

export { coreClient };
export const apiFetch = coreClient.fetch.bind(coreClient);
export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005';
}

// Landing API object for convenience
export const landingPublicApi = {
  getConfig: getLandingConfig,
  getImages: getLandingImages,
  getAll: getLandingAll,
};

export default {
  login,
  logout,
  register,
  refreshToken,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  changePassword,
  apiFetch,
  getApiBase,
  getLandingConfig,
  getLandingImages,
  getLandingAll,
  landingPublicApi,
};
