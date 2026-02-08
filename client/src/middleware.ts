import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/login/verify'];

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/login/verify'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get token from cookies or check if auth-storage exists
  // Note: In client-side, we use localStorage which isn't accessible in middleware
  // So we use a cookie-based approach for middleware checks
  const authStorage = request.cookies.get('auth-storage');

  let isAuthenticated = false;
  if (authStorage) {
    try {
      const decoded = decodeURIComponent(authStorage.value);
      const parsed = JSON.parse(decoded);
      isAuthenticated = parsed?.state?.isAuthenticated === true;
    } catch {
      isAuthenticated = false;
    }
  }

  // If accessing auth routes while authenticated, redirect to dashboard
  if (isAuthenticated && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If accessing protected routes while not authenticated, redirect to login
  if (!isAuthenticated && !publicRoutes.some((route) => pathname.startsWith(route))) {
    // Skip middleware for static assets and API routes
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.includes('.') // Static files like favicon.ico
    ) {
      return NextResponse.next();
    }

    // Store the original URL to redirect back after login
    const redirectUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      redirectUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
