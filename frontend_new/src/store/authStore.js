import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Cookie-based auth store.
 *
 * Tokens live in HttpOnly cookies set by the backend; the browser sends them
 * automatically when we use `credentials: 'include'`. Zustand only tracks the
 * user object so the UI knows who's signed in.
 *
 * "Stay logged in" — the backend issues 90-day (default) or 365-day
 * (remember_me) refresh cookies and slides the expiry on each request, so
 * customers don't have to log in again like Amazon/Flipkart.
 */

const fetchJson = async (url, init = {}) => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
  let data = null
  try {
    data = await res.json()
  } catch (_) {
    /* no body */
  }
  if (!res.ok) {
    const detail = data?.detail
    const msg =
      typeof detail === 'string'
        ? detail
        : detail?.message ||
          detail?.error ||
          data?.message ||
          `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      login: async (credentials) => {
        set({ loading: true, error: null })
        try {
          // OTP login uses a dedicated endpoint
          const url =
            credentials.login_method === 'otp'
              ? '/api/v1/auth/login-otp-verify'
              : '/api/v1/auth/login'
          const data = await fetchJson(url, {
            method: 'POST',
            body: JSON.stringify(credentials),
          })
          set({
            user: data.user,
            isAuthenticated: true,
            loading: false,
            error: null,
          })
          return data
        } catch (error) {
          set({ error: error.message, loading: false, isAuthenticated: false })
          throw error
        }
      },

      register: async (userData) => {
        set({ loading: true, error: null })
        try {
          const data = await fetchJson('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
          })
          set({ loading: false, error: null })
          return data
        } catch (error) {
          set({ error: error.message, loading: false })
          throw error
        }
      },

      logout: async () => {
        set({ loading: true, error: null })
        try {
          await fetch('/api/v1/auth/logout', {
            method: 'POST',
            credentials: 'include',
          })
        } catch (_) {
          /* clear local state regardless */
        }
        set({ user: null, isAuthenticated: false, loading: false, error: null })
      },

      refreshToken: async () => {
        try {
          const data = await fetchJson('/api/v1/auth/refresh', { method: 'POST' })
          if (data?.user) set({ user: data.user, isAuthenticated: true })
          return data
        } catch (error) {
          set({ user: null, isAuthenticated: false, error: error.message })
          throw error
        }
      },

      checkAuth: async () => {
        set({ loading: true, error: null })
        try {
          const userData = await fetchJson('/api/v1/users/me', { method: 'GET' })
          set({
            user: userData,
            isAuthenticated: true,
            loading: false,
            error: null,
          })
          return true
        } catch (_) {
          set({ user: null, isAuthenticated: false, loading: false })
          return false
        }
      },

      updateProfile: async (profileData) => {
        set({ loading: true, error: null })
        try {
          const userData = await fetchJson('/api/v1/users/me', {
            method: 'PUT',
            body: JSON.stringify(profileData),
          })
          set({ user: userData, loading: false, error: null })
          return userData
        } catch (error) {
          set({ error: error.message, loading: false })
          throw error
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        set({ loading: true, error: null })
        try {
          await fetchJson('/api/v1/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
              current_password: currentPassword,
              new_password: newPassword,
            }),
          })
          set({ loading: false, error: null })
          return true
        } catch (error) {
          set({ error: error.message, loading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'aarya-auth',
      // Cookies hold the tokens; we only persist the user identity so the UI
      // can render straight away (it gets re-validated by checkAuth on mount).
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export const useAuth = () => {
  const auth = useAuthStore()
  return {
    ...auth,
    isStaff:
      auth.user?.role === 'staff' ||
      auth.user?.role === 'admin' ||
      auth.user?.role === 'super_admin',
    isAdmin: auth.user?.role === 'admin' || auth.user?.role === 'super_admin',
    isSuperAdmin: auth.user?.role === 'super_admin',
  }
}

export default useAuthStore
