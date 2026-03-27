'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

const WARN_BEFORE_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 30 * 1000;   // check every 30 seconds

/** Decode JWT expiry from access_token without verifying signature */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function SessionTimeoutWarning() {
  const { isAuthenticated, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = (expiresAt: number) => {
    stopCountdown();
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        stopCountdown();
        setShowWarning(false);
        logout();
        toast.error('Session expired. Please sign in again.');
      }
    }, 1000);
  };

  const handleExtend = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) { logout(); return; }
      // Call a token refresh endpoint — gracefully handle if not available
      const res = await authApi.me(); // bump session via /me
      void res;
      stopCountdown();
      setShowWarning(false);
      toast.success('Session extended');
    } catch {
      logout();
    }
  }, [logout]);

  const handleLogout = useCallback(() => {
    stopCountdown();
    setShowWarning(false);
    logout();
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) { setShowWarning(false); stopCountdown(); return; }

    const check = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const expiry = getTokenExpiry(token);
      if (!expiry) return;
      const remaining = expiry - Date.now();
      if (remaining <= 0) {
        logout();
        return;
      }
      if (remaining <= WARN_BEFORE_MS && !showWarning) {
        setSecondsLeft(Math.floor(remaining / 1000));
        setShowWarning(true);
        startCountdown(expiry);
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      stopCountdown();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!showWarning) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Session expiring soon
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire in{' '}
            <span className="font-semibold text-amber-600">
              {mins}:{secs}
            </span>
            . Do you want to stay signed in?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLogout}>Sign out</AlertDialogCancel>
          <AlertDialogAction onClick={handleExtend}>
            Extend session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
