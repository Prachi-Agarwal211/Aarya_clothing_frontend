/**
 * apiClient.js — backward-compatibility shim.
 *
 * All logic has moved to:
 *   - customerApi.js  → all API namespaces (single source of truth)
 *   - baseApi.js      → BaseApiClient HTTP class, token helpers, URL helpers
 *
 * Import from '@/lib/customerApi' in new code.
 * This file re-exports everything so existing imports keep working.
 */

import { coreClient } from './customerApi';

export {
  authApi,
  productsApi,
  collectionsApi,
  categoriesApi,
  cartApi,
  ordersApi,
  returnsApi,
  addressesApi,
  chatApi,
  paymentApi,
  wishlistApi,
  reviewsApi,
  userApi,
  landingApi as siteConfigApi,
  apiFetch,
  coreClient as apiClient,
  coreClient,
  commerceClient,
  paymentClient,
} from './customerApi';

export {
  BaseApiClient,
  getCoreBaseUrl,
  getCommerceBaseUrl,
  getAdminBaseUrl,
  getPaymentBaseUrl,
  setAuthData,
  clearAuthData,
  getStoredUser,
  getAccessToken,
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
  setCookie,
  removeCookie,
} from './baseApi';

export default coreClient;
