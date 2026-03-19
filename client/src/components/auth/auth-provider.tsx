'use client';

import { useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// Routes that don't require authentication
const publicRoutes = ['/login', '/login/verify'];

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    isLoading,
    setUser,
    setLoading,
    setRedirectAfterLogin,
    logout,
  } = useAuthStore();

  // Sync auth state to cookie for middleware
  const syncAuthCookie = useCallback((authenticated: boolean) => {
    if (typeof document !== 'undefined') {
      const isRemembered = localStorage.getItem('remember_me') === 'true';
      const cookieProps = isRemembered ? 'max-age=31536000;' : '';
      const value = JSON.stringify({ state: { isAuthenticated: authenticated } });
      document.cookie = `auth-storage=${encodeURIComponent(value)}; path=/; ${cookieProps} SameSite=Lax`;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      const isRemembered = localStorage.getItem('remember_me') === 'true';
      const authCookie = document.cookie.split(';').map(c => c.trim()).find(row => row.startsWith('auth-storage='));

      // Clean up local storage if the user did NOT want to be remembered AND the session cookie is gone (browser closed).
      if (accessToken && !isRemembered && !authCookie) {
         localStorage.removeItem('access_token');
         localStorage.removeItem('refresh_token');
         localStorage.removeItem('remember_me');
         setLoading(false);
         syncAuthCookie(false);
         return;
      }

      if (!accessToken) {
        setLoading(false);
        syncAuthCookie(false);
        return;
      }

      try {
        // Verify token by fetching user data
        const response = await authApi.me();
        setUser(response.data);
        syncAuthCookie(true);
      } catch (err: any) {
        console.error("AUTH ERROR:", err);
        // Only tear down the session if explicitly rejected. Transient network errors should not cause a forced logout.
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          logout();
          syncAuthCookie(false);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [setUser, setLoading, logout, syncAuthCookie]);

  // Handle route protection
  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (!isAuthenticated && !isPublicRoute) {
      // Store the intended destination
      if (pathname !== '/') {
        setRedirectAfterLogin(pathname);
      }
      router.push('/login');
    }

    // Handle redirect parameter after login
    if (isAuthenticated && pathname === '/login') {
      const redirect = searchParams.get('redirect');
      if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, pathname, router, searchParams, setRedirectAfterLogin]);

  // Show loading state while initializing
  if (isLoading && !publicRoutes.some((route) => pathname.startsWith(route))) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        suppressHydrationWarning
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
