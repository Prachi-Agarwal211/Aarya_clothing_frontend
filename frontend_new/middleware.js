import { NextResponse } from 'next/server';

/**
 * Next.js Middleware for Route Protection
 * 
 * Handles:
 * - Admin routes protection (requires admin/staff role)
 * - Profile routes protection (requires authentication)
 * - Auth routes redirect (redirect authenticated users away from login/register)
 * - Static files and public assets bypass
 * 
 * OPTIMIZED: Simplified auth routes, public product browsing allowed
 */

// Public routes (no login required) - OPTIMIZED: Products/collections now public
const PUBLIC_ROUTES = ['/', '/products', '/collections', '/new-arrivals', '/about'];

// Auth routes where authenticated users shouldn't go
// OPTIMIZED: Reduced from 10 to 5 routes
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/change-password',
];

// Convert to Set for O(1) lookups in middleware
const PUBLIC_ROUTE_SET = new Set(PUBLIC_ROUTES);
const AUTH_ROUTE_SET = new Set(AUTH_ROUTES);

/**
 * Parse JWT token safely in Edge runtime
 */
function parseJwt(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn('Failed to parse JWT token:', e.message);
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

  // Get user role from token instead of dummy cookie
  const userRole = decodedToken?.role;
  const isStaff = ['admin', 'super_admin', 'staff'].includes(userRole);
  const isAdmin = ['admin', 'super_admin'].includes(userRole);

  // Route classification
  const isAdminRoute = pathname.startsWith('/admin');
  const isProfileRoute = pathname.startsWith('/profile');
  const isAuthRoute = AUTH_ROUTE_SET.has(pathname) || AUTH_ROUTES.some(route => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTE_SET.has(pathname) || PUBLIC_ROUTES.some(route => pathname.startsWith(route + '/'));

  // Handle admin routes - require admin/staff role
  if (isAdminRoute) {
    // If not authenticated and no refresh token, redirect to login
    // If refresh token exists, allow request through (client will refresh)
    if (!isAuthenticated && !hasRefreshToken) {
      // Not logged in and no refresh token - redirect to login with return URL
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect_url', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // If authenticated, check role permissions
    if (isAuthenticated && !isStaff) {
      // Logged in but not admin/staff - redirect to home
      const homeUrl = new URL('/', request.url);
      homeUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(homeUrl);
    }

    // Role-based redirects for root admin route (only if authenticated)
    if (isAuthenticated && (pathname === '/admin' || pathname === '/admin/')) {
      if (userRole === 'staff') {
        return NextResponse.redirect(new URL('/admin/staff', request.url));
      }
      if (userRole === 'super_admin') {
        return NextResponse.redirect(new URL('/admin/super', request.url));
      }
    }

    // Specific handling for staff accessing super admin routes
    if (userRole === 'staff' && pathname.startsWith('/admin/super')) {
      return NextResponse.redirect(new URL('/admin/staff', request.url));
    }

    // Specific handling for admin accessing super admin routes
    if (userRole === 'admin' && pathname.startsWith('/admin/super')) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    // Authorized - proceed
    return NextResponse.next();
  }

  // Handle protected routes - require authentication
  // OPTIMIZED: Cart, checkout, profile, and dashboard require login
  const protectedRoutes = ['/cart', '/checkout', '/dashboard', '/profile'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect_url', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    // Authorized - proceed
    return NextResponse.next();
  }

  // Handle auth routes - redirect authenticated users away from login/register
  if (isAuthRoute && isAuthenticated) {
    // Already logged in - honor redirect_url param or default by role
    const redirectParam = request.nextUrl.searchParams.get('redirect_url') || request.nextUrl.searchParams.get('redirect');
    let redirectUrl;

    if (redirectParam && redirectParam.startsWith('/')) {
      // User was heading somewhere before hitting auth — send them there
      redirectUrl = new URL(redirectParam, request.url);
    } else {
      // Default dashboard based on role
      if (userRole === 'super_admin') {
        redirectUrl = new URL('/admin/super', request.url);
      } else if (userRole === 'admin') {
        redirectUrl = new URL('/admin', request.url);
      } else if (userRole === 'staff') {
        redirectUrl = new URL('/admin/staff', request.url);
      } else {
        redirectUrl = new URL('/products', request.url);
      }
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
