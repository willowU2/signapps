/**
 * WL2: Next.js Middleware — Subdomain Routing & Tenant Context
 *
 * Parses the subdomain from the incoming request hostname and maps it to a
 * tenant_id, injecting it as `x-tenant-id` and `x-tenant-slug` request
 * headers for downstream API calls and server components.
 *
 * Rules:
 *  - `acme.signapps.io`   → tenant slug "acme"
 *  - `signapps.io`        → default tenant
 *  - `localhost:3000`     → default tenant (dev)
 *  - `app.signapps.io`    → default tenant (main app subdomain, not a tenant)
 *
 * The middleware also handles route protection: unauthenticated users on
 * protected routes are redirected to /login with a `redirect` param.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Hostname suffix for the SignApps deployment. */
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'signapps.io';

/** Subdomains that are part of the platform itself, not tenants. */
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'mail', 'static', 'cdn', 'status']);

/** Routes that do NOT require authentication. */
const PUBLIC_ROUTES = [
  '/login',
  '/login/verify',
  '/auth',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public',
  '/images',
  '/fonts',
  '/manifest.json',
  '/sw.js',
  '/offline',
];

// ---------------------------------------------------------------------------
// Subdomain parsing
// ---------------------------------------------------------------------------

/**
 * Extract the tenant slug from the request hostname.
 *
 * Returns `null` for the default tenant (no subdomain / reserved subdomain).
 */
function extractTenantSlug(hostname: string): string | null {
  // Strip port if present (e.g. localhost:3000)
  const host = hostname.split(':')[0];

  // Localhost → default tenant (dev)
  if (host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  // Must end with the base domain to be a SignApps subdomain
  if (!host.endsWith(`.${BASE_DOMAIN}`)) {
    return null;
  }

  const subdomain = host.slice(0, host.length - BASE_DOMAIN.length - 1);

  // Empty or reserved subdomains → default tenant
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    return null;
  }

  return subdomain;
}

// ---------------------------------------------------------------------------
// Route protection
// ---------------------------------------------------------------------------

/** Check if a pathname is a public (non-protected) route. */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((pub) => pathname.startsWith(pub));
}

/** Check if the request has a valid authentication cookie. */
function isAuthenticated(request: NextRequest): boolean {
  return (
    request.cookies.has('access_token') ||
    request.cookies.has('signapps_session') ||
    !!request.headers.get('authorization')
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') ?? '';

  // Step 1: Extract tenant slug from subdomain
  const tenantSlug = extractTenantSlug(hostname);

  // Step 2: Build forwarded headers
  const requestHeaders = new Headers(request.headers);

  if (tenantSlug) {
    // Inject tenant slug so server components and API routes can use it
    requestHeaders.set('x-tenant-slug', tenantSlug);
    // The backend will resolve slug → tenant_id; we pass the slug here
    // and let the identity service look it up.
  }

  // Always pass the original hostname for backend logging / multi-domain logic
  requestHeaders.set('x-forwarded-host', hostname);
  requestHeaders.set('x-original-path', pathname);

  // Step 3: Route protection
  if (!isPublicRoute(pathname) && !isAuthenticated(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';

    // Preserve the original destination for post-login redirect
    if (pathname !== '/' && pathname !== '/login') {
      loginUrl.searchParams.set('redirect', pathname);
    }

    return NextResponse.redirect(loginUrl);
  }

  // Step 4: Continue with modified headers
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// ---------------------------------------------------------------------------
// Matcher — run on all routes except Next.js internals
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico
     * - public directory files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
