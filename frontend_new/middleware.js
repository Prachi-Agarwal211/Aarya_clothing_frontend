import { NextResponse } from 'next/server';
import { 
  USER_ROLES, 
  getRedirectForRole, 
  isStaff, 
  isAdmin,
  isSuperAdmin,
  ROLE_ACCESS 
} from '@/lib/roles';

/**
 * Next.js Middleware for Route Protection
 *
 * Handles:
 * - Admin routes protection (requires admin/staff role)
 * - Protected routes (cart, profile, /auth/change-password, etc.)
 * - Auth routes redirect (redirect authenticated users away from login/register)
 * - Static files and public assets bypass
 *
 * Uses centralized role configuration from @/lib/roles
 */

// Public routes (no login required)
// Note: /new-arrivals redirects to landing page (/#new-arrivals section)
const PUBLIC_ROUTES = ['/', '/products', '/collections', '/about'];

// Auth routes where authenticated users shouldn't go
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

// Convert to Set for O(1) lookups in middleware
const PUBLIC_ROUTE_SET = new Set(PUBLIC_ROUTES);
const AUTH_ROUTE_SET = new Set(AUTH_ROUTES);

/**
 * Parse JWT token safely in Edge runtime
 * 
 * FIX: Improved error handling, token structure validation, and expiration check
 */
function parseJwt(token) {
  // Validate input
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  try {
    // Trim whitespace that might cause parsing issues
    token = token.trim();
    
    // Validate JWT structure (must have 3 parts)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[Middleware] Invalid JWT structure - expected 3 parts, got', parts.length);
      return null;
    }
    
    const [header, base64Url, signature] = parts;
    
    // Validate each part exists
    if (!header || !base64Url || !signature) {
      console.warn('[Middleware] Invalid JWT - empty part detected');
      return null;
    }
    
    // Convert base64url to base64
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Handle padding issues (base64 should be multiple of 4)
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    
    // Decode base64 to string
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const parsed = JSON.parse(jsonPayload);
    
    // Validate token has required fields
    if (!parsed.sub || !parsed.exp) {
      console.warn('[Middleware] Invalid JWT payload - missing sub or exp');
      return null;
    }
    
    // Check expiration (exp is in seconds, convert to milliseconds)
    if (parsed.exp && parsed.exp * 1000 < Date.now()) {
      // Token expired - this is normal, don't log as error
      return null;
    }

    // DEBUG: Log role extraction for troubleshooting
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] JWT parsed successfully:', {
        sub: parsed.sub,
        role: parsed.role,
        exp: parsed.exp,
        hasRole: !!parsed.role
      });
    }

    return parsed;
  } catch (e) {
    // Log at warn level since expired/malformed tokens are expected sometimes
    console.warn('[Middleware] JWT parse error:', e.message, 'Token starts with:', token?.substring(0, 30) + '...');
    return null;
  }
}

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip middleware for static files, images, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') || // Files with extensions (images, fonts, etc.)
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Get authentic access token
  const accessToken = request.cookies.get('access_token')?.value;
  const decodedToken = parseJwt(accessToken);

  // Check if token exists and is not expired
  const isTokenValid = decodedToken && decodedToken.exp && (decodedToken.exp * 1000 > Date.now());
  const isAuthenticated = !!isTokenValid;

  // Check if refresh token exists (for token refresh scenarios)
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const hasRefreshToken = !!refreshToken;

  // Get user role from token
  const userRole = decodedToken?.role;

  // Route classification using centralized role helpers
  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthRoute = AUTH_ROUTE_SET.has(pathname) || AUTH_ROUTES.some(route => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTE_SET.has(pathname) || PUBLIC_ROUTES.some(route => pathname.startsWith(route + '/'));

  // Handle admin routes - require admin/staff role
  if (isAdminRoute) {
    // If not authenticated and no refresh token, redirect to login
    if (!isAuthenticated && !hasRefreshToken) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect_url', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // If authenticated, check role permissions using centralized helper
    if (isAuthenticated && !isStaff(userRole)) {
      // Logged in but not staff/admin - redirect to home with error
      // Log unauthorized access attempt for security monitoring
      console.warn(`[Security] Unauthorized admin access attempt by user ${decodedToken.sub} with role ${userRole}`);
      
      const homeUrl = new URL('/', request.url);
      homeUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(homeUrl);
    }

    // Role-based redirects for root admin route (only if authenticated)
    if (isAuthenticated && (pathname === '/admin' || pathname === '/admin/')) {
      if (userRole === USER_ROLES.STAFF) {
        return NextResponse.redirect(new URL('/admin/staff', request.url));
      }
      if (userRole === USER_ROLES.SUPER_ADMIN) {
        return NextResponse.redirect(new URL('/admin/super', request.url));
      }
    }

    // Specific handling for staff accessing super admin routes
    if (userRole === USER_ROLES.STAFF && pathname.startsWith('/admin/super')) {
      return NextResponse.redirect(new URL('/admin/staff', request.url));
    }

    // Specific handling for admin accessing super admin routes
    if (userRole === USER_ROLES.ADMIN && pathname.startsWith('/admin/super')) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    // Authorized - proceed
    return NextResponse.next();
  }

  // Handle protected routes - require authentication
  const protectedRoutes = [
    '/cart',
    '/checkout',
    '/dashboard',
    '/profile',
    '/orders',
    '/auth/change-password',
  ];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Allow through if refresh_token exists — client-side authContext will
    // handle the 401 from the API and silently refresh the access_token.
    // Only hard-redirect when there is truly no session at all.
    if (!isAuthenticated && !hasRefreshToken) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect_url', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Handle auth routes - redirect authenticated users away from login/register
  if (isAuthRoute && isAuthenticated) {
    // Honor redirect_url param or default by role using centralized helper
    const redirectParam = request.nextUrl.searchParams.get('redirect_url');
    let redirectUrl;

    if (redirectParam && redirectParam.startsWith('/')) {
      redirectUrl = new URL(redirectParam, request.url);
    } else {
      // Use centralized redirect logic
      redirectUrl = new URL(getRedirectForRole(userRole), request.url);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // All other routes - proceed normally
  return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*$).*)',
  ],
};
