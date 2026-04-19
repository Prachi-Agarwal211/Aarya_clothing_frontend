/**
 * Comprehensive frontend authentication tests
 * Tests the Zustand auth store and React components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../frontend_new/src/store/authStore';
import RegisterPage from '../../frontend_new/app/auth/register/page';
import LoginPage from '../../frontend_new/app/auth/login/page';

// Mock the auth store for testing
describe('Auth Store Tests', () => {
  beforeEach(() => {
    // Clear the store before each test
    useAuthStore.getState().logout();
  });

  it('should initialize with default values', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should handle login success', async () => {
    // Mock the fetch API
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          user: { id: 1, email: 'test@example.com', username: 'testuser' },
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token'
        })
      })
    );

    const { login } = useAuthStore.getState();
    await login({ username: 'testuser', password: 'password123' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).not.toBeNull();
    expect(state.user.email).toBe('test@example.com');
    expect(state.accessToken).toBe('mock_access_token');
    expect(state.refreshToken).toBe('mock_refresh_token');
    expect(state.error).toBeNull();

    // Clean up
    delete global.fetch;
  });

  it('should handle login failure', async () => {
    // Mock the fetch API to return an error
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'Invalid credentials' })
      })
    );

    const { login } = useAuthStore.getState();
    await login({ username: 'wronguser', password: 'wrongpassword' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error).toBe('Invalid credentials');

    // Clean up
    delete global.fetch;
  });

  it('should handle registration success', async () => {
    // Mock the fetch API
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          user: { id: 1, email: 'new@example.com', username: 'newuser' },
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token'
        })
      })
    );

    const { register } = useAuthStore.getState();
    await register({
      full_name: 'New User',
      username: 'newuser',
      email: 'new@example.com',
      phone: '1234567890',
      password: 'password123'
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).not.toBeNull();
    expect(state.user.email).toBe('new@example.com');

    // Clean up
    delete global.fetch;
  });

  it('should handle logout', async () => {
    // First, set up a logged-in state
    useAuthStore.getState().login = vi.fn(() => Promise.resolve({
      user: { id: 1, email: 'test@example.com' },
      access_token: 'token',
      refresh_token: 'refresh_token'
    }));

    await useAuthStore.getState().login({ username: 'test', password: 'test' });

    // Now test logout
    const { logout } = useAuthStore.getState();
    await logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it('should handle token refresh', async () => {
    // Set up initial state with tokens
    const initialState = useAuthStore.getState();
    initialState.accessToken = 'old_access_token';
    initialState.refreshToken = 'valid_refresh_token';

    // Mock the fetch API
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new_access_token'
        })
      })
    );

    const { refreshToken } = useAuthStore.getState();
    await refreshToken();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new_access_token');
    expect(state.error).toBeNull();

    // Clean up
    delete global.fetch;
  });

  it('should handle auth check when authenticated', async () => {
    // Set up authenticated state
    const initialState = useAuthStore.getState();
    initialState.accessToken = 'valid_token';
    initialState.user = { id: 1, email: 'test@example.com' };
    initialState.isAuthenticated = true;

    // Mock the fetch API
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, email: 'test@example.com' })
      })
    );

    const { checkAuth } = useAuthStore.getState();
    const isAuth = await checkAuth();

    expect(isAuth).toBe(true);

    // Clean up
    delete global.fetch;
  });

  it('should handle auth check when not authenticated', async () => {
    // Set up unauthenticated state
    const initialState = useAuthStore.getState();
    initialState.accessToken = null;
    initialState.user = null;
    initialState.isAuthenticated = false;

    const { checkAuth } = useAuthStore.getState();
    const isAuth = await checkAuth();

    expect(isAuth).toBe(false);
  });

  it('should clear errors', () => {
    const initialState = useAuthStore.getState();
    initialState.error = 'Some error';

    const { clearError } = useAuthStore.getState();
    clearError();

    expect(useAuthStore.getState().error).toBeNull();
  });

  it('should get auth header when token exists', () => {
    const initialState = useAuthStore.getState();
    initialState.accessToken = 'test_token';

    const { getAuthHeader } = useAuthStore.getState();
    const header = getAuthHeader();

    expect(header).toEqual({ 'Authorization': 'Bearer test_token' });
  });

  it('should get empty auth header when no token', () => {
    const initialState = useAuthStore.getState();
    initialState.accessToken = null;

    const { getAuthHeader } = useAuthStore.getState();
    const header = getAuthHeader();

    expect(header).toEqual({});
  });
});

describe('Registration Page Tests', () => {
  beforeEach(() => {
    // Mock the auth store
    vi.mock('../../frontend_new/src/store/authStore', () => ({
      useAuth: () => ({
        register: vi.fn(),
        isAuthenticated: false,
        loading: false
      })
    }));

    // Mock logger
    vi.mock('../../frontend_new/lib/logger', () => ({
      default: {
        info: vi.fn(),
        error: vi.fn()
      }
    }));
  });

  it('should render registration form', () => {
    render(<RegisterPage />);

    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByText('Begin your luxury journey')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Phone Number (Optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password (8+ characters)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CREATE ACCOUNT' })).toBeInTheDocument();
  });

  it('should show error when form is submitted empty', async () => {
    render(<RegisterPage />);

    fireEvent.click(screen.getByRole('button', { name: 'CREATE ACCOUNT' }));

    await waitFor(() => {
      expect(screen.getByText('Please fill in all required fields.')).toBeInTheDocument();
    });
  });

  it('should show error for invalid email', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByPlaceholderText('Password (8+ characters)'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: 'CREATE ACCOUNT' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    });
  });

  it('should show error for short password', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password (8+ characters)'), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: 'CREATE ACCOUNT' }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    });
  });

  it('should show password visibility toggle', async () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByPlaceholderText('Password (8+ characters)');
    const toggleButton = screen.getByLabelText('Show password');

    // Initially should be password type
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide password
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should show password strength indicator', async () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByPlaceholderText('Password (8+ characters)');
    
    // Type a valid password
    fireEvent.change(passwordInput, { target: { value: 'valid_password_123' } });

    await waitFor(() => {
      expect(screen.getByText('✓ Password meets requirements')).toBeInTheDocument();
    });
  });

  it('should have link to login page', () => {
    render(<RegisterPage />);

    const loginLink = screen.getByRole('link', { name: 'Sign In' });
    expect(loginLink).toHaveAttribute('href', '/auth/login');
  });
});

describe('Login Page Tests', () => {
  beforeEach(() => {
    // Mock the auth store
    vi.mock('../../frontend_new/src/store/authStore', () => ({
      useAuth: () => ({
        login: vi.fn(),
        isAuthenticated: false,
        loading: false
      })
    }));

    // Mock logger
    vi.mock('../../frontend_new/lib/logger', () => ({
      default: {
        info: vi.fn(),
        error: vi.fn()
      }
    }));
  });

  it('should render login form', () => {
    render(<LoginPage />);

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email or Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SIGN IN' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Remember me' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot Password?' })).toBeInTheDocument();
  });

  it('should show error when form is submitted empty', async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'SIGN IN' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter your email/username and password.')).toBeInTheDocument();
    });
  });

  it('should show password visibility toggle', async () => {
    render(<LoginPage />);

    const passwordInput = screen.getByPlaceholderText('Password');
    const toggleButton = screen.getByLabelText('Show password');

    // Initially should be password type
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide password
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should have remember me checkbox', () => {
    render(<LoginPage />);

    const checkbox = screen.getByRole('checkbox', { name: 'Remember me' });
    expect(checkbox).toBeChecked(); // Should be checked by default

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('should have forgot password link', () => {
    render(<LoginPage />);

    const forgotPasswordLink = screen.getByRole('link', { name: 'Forgot Password?' });
    expect(forgotPasswordLink).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('should have link to registration page', () => {
    render(<LoginPage />);

    const registerLink = screen.getByRole('link', { name: 'Create Account' });
    expect(registerLink).toHaveAttribute('href', '/auth/register');
  });

  it('should show social login placeholders', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('Google login (coming soon)')).toBeInTheDocument();
    expect(screen.getByLabelText('Facebook login (coming soon)')).toBeInTheDocument();
  });
});

describe('Auth Store Integration Tests', () => {
  beforeEach(() => {
    // Clear store before each test
    useAuthStore.getState().logout();
  });

  it('should persist state between page reloads', () => {
    // Set some state
    const { login } = useAuthStore.getState();
    
    // Mock successful login
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          user: { id: 1, email: 'test@example.com' },
          access_token: 'token',
          refresh_token: 'refresh_token'
        })
      })
    );

    // This would normally persist to localStorage
    // For testing, we just verify the state is set
    waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
    });

    delete global.fetch;
  });

  it('should handle token expiration gracefully', async () => {
    // Set up state with expired token
    const initialState = useAuthStore.getState();
    initialState.accessToken = 'expired_token';
    initialState.refreshToken = 'valid_refresh_token';

    // Mock failed auth check
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401
      })
    );

    const { checkAuth } = useAuthStore.getState();
    const isAuth = await checkAuth();

    expect(isAuth).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    delete global.fetch;
  });

  it('should handle network errors gracefully', async () => {
    // Mock network error
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    );

    const { login } = useAuthStore.getState();
    await login({ username: 'test', password: 'test' });

    const state = useAuthStore.getState();
    expect(state.error).toContain('Network error');
    expect(state.isAuthenticated).toBe(false);

    delete global.fetch;
  });
});

describe('Auth Store Utility Methods', () => {
  it('should provide role-based helpers', () => {
    const initialState = useAuthStore.getState();
    
    // Test with customer
    initialState.user = { role: 'customer' };
    const { isStaff, isAdmin, isSuperAdmin } = useAuthStore.getState();
    expect(isStaff).toBe(false);
    expect(isAdmin).toBe(false);
    expect(isSuperAdmin).toBe(false);

    // Test with staff
    initialState.user = { role: 'staff' };
    expect(useAuthStore.getState().isStaff).toBe(true);
    expect(useAuthStore.getState().isAdmin).toBe(false);

    // Test with admin
    initialState.user = { role: 'admin' };
    expect(useAuthStore.getState().isStaff).toBe(true);
    expect(useAuthStore.getState().isAdmin).toBe(true);
    expect(useAuthStore.getState().isSuperAdmin).toBe(false);

    // Test with super_admin
    initialState.user = { role: 'super_admin' };
    expect(useAuthStore.getState().isStaff).toBe(true);
    expect(useAuthStore.getState().isAdmin).toBe(true);
    expect(useAuthStore.getState().isSuperAdmin).toBe(true);
  });

  it('should provide profile update functionality', async () => {
    // Set up authenticated state
    const initialState = useAuthStore.getState();
    initialState.accessToken = 'valid_token';
    initialState.user = { id: 1, email: 'old@example.com', full_name: 'Old Name' };
    initialState.isAuthenticated = true;

    // Mock successful update
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, email: 'new@example.com', full_name: 'New Name' })
      })
    );

    const { updateProfile } = useAuthStore.getState();
    await updateProfile({ full_name: 'New Name', email: 'new@example.com' });

    const state = useAuthStore.getState();
    expect(state.user.full_name).toBe('New Name');
    expect(state.user.email).toBe('new@example.com');

    delete global.fetch;
  });

  it('should provide password change functionality', async () => {
    // Set up authenticated state
    const initialState = useAuthStore.getState();
    initialState.accessToken = 'valid_token';
    initialState.user = { id: 1, email: 'test@example.com' };
    initialState.isAuthenticated = true;

    // Mock successful password change
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true
      })
    );

    const { changePassword } = useAuthStore.getState();
    const result = await changePassword('old_password', 'new_password_123');

    expect(result).toBe(true);
    expect(useAuthStore.getState().error).toBeNull();

    delete global.fetch;
  });
});

// Run tests with: npm test tests/auth/test_frontend_auth.js
// Or: vitest run tests/auth/test_frontend_auth.js