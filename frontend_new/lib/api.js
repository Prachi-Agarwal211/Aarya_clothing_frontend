/**
 * api.js — backward-compatibility shim.
 *
 * All logic has moved to customerApi.js (single source of truth).
 * Import from '@/lib/customerApi' in new code.
 * This file re-exports everything so existing imports keep working.
 */

export {
  authApi,
  landingApi,
  apiFetch,
  coreClient,
  commerceClient,
  paymentClient,
  productsApi,
  categoriesApi,
  collectionsApi,
  cartApi,
  ordersApi,
  addressesApi,
  wishlistApi,
  reviewsApi,
  userApi,
  paymentApi,
  chatApi,
  returnsApi,
} from './customerApi';

export { setAuthData, clearAuthData } from './baseApi';

// Named function aliases (used by app/page.js, siteConfigContext.js, auth pages)
export { landingApi as landingPublicApi } from './customerApi';

import { landingApi, authApi, coreClient } from './customerApi';
import { setAuthData as _setAuthData, clearAuthData as _clearAuthData } from './baseApi';

export const getLandingAll    = () => landingApi.getAll();
export const getLandingConfig = () => landingApi.getConfig();
export const getLandingImages = (section) => landingApi.getImages(section);
export const getSiteConfig    = () => landingApi.getSiteConfig();
export const getApiBase       = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005';

// ==================== Backward Compatibility Auth Functions ====================
// These wrap the new authApi methods to maintain old function signatures
// Used by legacy code that imports directly from @/lib/api

export const login = async (credentials) => {
  const response = await authApi.login(credentials);
  // Store user data (tokens are in HttpOnly cookies)
  if (response?.user) {
    _setAuthData({ user: response.user });
  }
  return response;
};

export const logout = async () => {
  _clearAuthData();
  try {
    await authApi.logout();
  } catch (e) {
    // Non-fatal - clear state regardless
    console.warn('Logout API call failed:', e);
  }
};

export const register = async (data) => {
  return authApi.register(data);
};

export const forgotPassword = async (identifier, otpType = 'SMS') => {
  return authApi.forgotPassword(identifier, otpType);
};

export const resetPassword = async (token, password) => {
  return authApi.resetPassword(token, password);
};

export const getCurrentUser = async () => {
  return authApi.getCurrentUser();
};

export const changePassword = async (data) => {
  return authApi.changePassword(data);
};

export const verifyEmail = async (token) => {
  return authApi.verifyEmail(token);
};

export const resendVerification = async (email) => {
  return authApi.resendVerification(email);
};

export default {
  getLandingAll,
  getLandingConfig,
  getLandingImages,
  getSiteConfig,
  getApiBase,
  login,
  logout,
  register,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  changePassword,
  verifyEmail,
  resendVerification,
};
