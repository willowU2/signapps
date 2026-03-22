'use client';
import { SpinnerInfinity } from 'spinners-react';


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
      const value = JSON.stringify({ state: { isAuthenticated: authenticated } });
      document.cookie = `auth-storage=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

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
      } catch {
        // Token expired or invalid, clear auth state
        logout();
        syncAuthCookie(false);
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
          <SpinnerInfinity size={32} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
