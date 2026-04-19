import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Production-ready Zustand auth store
const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      
      // Actions
      login: async (credentials) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || 'Login failed')
          }
          
          const data = await response.json()
          
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            loading: false,
            error: null
          })
          
          return data
        } catch (error) {
          set({
            error: error.message || 'Login failed',
            loading: false,
            isAuthenticated: false
          })
          throw error
        }
      },
      
      register: async (userData) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || 'Registration failed')
          }
          
          const data = await response.json()
          
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            loading: false,
            error: null
          })
          
          return data
        } catch (error) {
          set({
            error: error.message || 'Registration failed',
            loading: false,
            isAuthenticated: false
          })
          throw error
        }
      },
      
      logout: async () => {
        set({ loading: true, error: null })
        
        try {
          // Invalidate session on backend
          const token = get().accessToken
          if (token) {
            await fetch('/api/v1/auth/logout', {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })
          }
          
          // Clear local state
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            error: null
          })
        } catch (error) {
          // Even if backend fails, clear local state
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            error: null
          })
        }
      },
      
      refreshToken: async () => {
        set({ loading: true, error: null })
        
        try {
          const refreshToken = get().refreshToken
          if (!refreshToken) {
            throw new Error('No refresh token available')
          }
          
          const response = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || 'Token refresh failed')
          }
          
          const data = await response.json()
          
          set({
            accessToken: data.access_token,
            loading: false,
            error: null
          })
          
          return data
        } catch (error) {
          set({
            error: error.message || 'Token refresh failed',
            loading: false,
            isAuthenticated: false
          })
          throw error
        }
      },
      
      checkAuth: async () => {
        set({ loading: true, error: null })
        
        try {
          const token = get().accessToken
          if (!token) {
            set({ loading: false, isAuthenticated: false })
            return false
          }
          
          const response = await fetch('/api/v1/users/me', {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            set({ 
              loading: false, 
              isAuthenticated: false,
              user: null,
              accessToken: null,
              refreshToken: null
            })
            return false
          }
          
          const userData = await response.json()
          
          set({
            user: userData,
            isAuthenticated: true,
            loading: false,
            error: null
          })
          
          return true
        } catch (error) {
          set({
            error: error.message || 'Auth check failed',
            loading: false,
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null
          })
          return false
        }
      },
      
      updateProfile: async (profileData) => {
        set({ loading: true, error: null })
        
        try {
          const token = get().accessToken
          if (!token) {
            throw new Error('Not authenticated')
          }
          
          const response = await fetch('/api/v1/users/me', {
            method: 'PUT',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || 'Profile update failed')
          }
          
          const userData = await response.json()
          
          set({
            user: userData,
            loading: false,
            error: null
          })
          
          return userData
        } catch (error) {
          set({
            error: error.message || 'Profile update failed',
            loading: false
          })
          throw error
        }
      },
      
      changePassword: async (oldPassword, newPassword) => {
        set({ loading: true, error: null })
        
        try {
          const token = get().accessToken
          if (!token) {
            throw new Error('Not authenticated')
          }
          
          const response = await fetch('/api/v1/auth/change-password', {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.detail || 'Password change failed')
          }
          
          set({ loading: false, error: null })
          return true
        } catch (error) {
          set({
            error: error.message || 'Password change failed',
            loading: false
          })
          throw error
        }
      },
      
      // Utility methods
      getAuthHeader: () => {
        const token = get().accessToken
        return token ? { 'Authorization': `Bearer ${token}` } : {}
      },
      
      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

export const useAuth = () => {
  const auth = useAuthStore()
  
  return {
    ...auth,
    // Helper methods
    isStaff: auth.user?.role === 'staff' || auth.user?.role === 'admin' || auth.user?.role === 'super_admin',
    isAdmin: auth.user?.role === 'admin' || auth.user?.role === 'super_admin',
    isSuperAdmin: auth.user?.role === 'super_admin'
  }
}

export default useAuthStore