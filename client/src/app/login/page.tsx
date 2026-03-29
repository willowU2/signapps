'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LdapLoginDialog } from '@/components/auth/ldap-login-dialog';
import { parseApiError } from '@/lib/errors';
import { logActivity } from '@/hooks/use-activity-tracker';
import { usePageTitle } from '@/hooks/use-page-title';

const loginSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

type LoginForm = z.infer<typeof loginSchema>;

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

export default function LoginPage() {
  usePageTitle('Connexion');
  const router = useRouter();
  const { setUser, setMfaSessionToken, redirectAfterLogin, setRedirectAfterLogin } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showLdapDialog, setShowLdapDialog] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rate limiting state
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutUntil) {
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
        setLockoutRemaining(remaining);
        if (remaining <= 0) {
          setLockoutUntil(null);
          setLockoutRemaining(0);
          if (lockoutTimerRef.current) {
            clearInterval(lockoutTimerRef.current);
            lockoutTimerRef.current = null;
          }
        }
      };
      tick();
      lockoutTimerRef.current = setInterval(tick, 1000);
      return () => {
        if (lockoutTimerRef.current) {
          clearInterval(lockoutTimerRef.current);
          lockoutTimerRef.current = null;
        }
      };
    }
  }, [lockoutUntil]);

  const TRUST_DEVICE_KEY = 'trusted_device_until';
  const isDeviceTrusted = () => {
    if (typeof window === 'undefined') return false;
    const until = localStorage.getItem(TRUST_DEVICE_KEY);
    if (!until) return false;
    return new Date(until).getTime() > Date.now();
  };

  const searchParams = useSearchParams();
  const autoParam = searchParams.get('auto');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = useCallback(async (data: LoginForm) => {
    // Block submission during lockout
    if (lockoutUntil && Date.now() < lockoutUntil) return;

    try {
      setError(null);

      const response = await authApi.login({
        username: data.username,
        password: data.password,
        remember_me: rememberMe,
      });

      // Reset failed attempts on success
      setFailedAttempts(0);
      setLockoutUntil(null);

      // Check if MFA is required
      if (response.data.mfa_required && response.data.mfa_session_token) {
        setMfaSessionToken(response.data.mfa_session_token);
        router.push('/login/verify');
        return;
      }

      // Store tokens
      if (response.data.access_token && response.data.refresh_token) {
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);

        // Trust device for 30 days
        if (trustDevice) {
          const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          localStorage.setItem(TRUST_DEVICE_KEY, until);
        }

        // Set user data from response or fetch it
        if (response.data.user) {
          setUser(response.data.user);
        } else {
          const userResponse = await authApi.me();
          setUser(userResponse.data);
        }

        // Sync cookie immediately so middleware sees authenticated state
        const cookieValue = JSON.stringify({ state: { isAuthenticated: true } });
        document.cookie = `auth-storage=${encodeURIComponent(cookieValue)}; path=/; max-age=31536000; SameSite=Lax`;

        // Log login activity
        logActivity('login', data.username, 'Connexion reussie');

        // Redirect to saved path or dashboard
        const redirectPath = redirectAfterLogin || '/dashboard';
        setRedirectAfterLogin(null);
        router.push(redirectPath);
      }
    } catch (err: unknown) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setError(parseApiError(err));

      // Trigger lockout after MAX_ATTEMPTS failures
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutEnd = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockoutUntil(lockoutEnd);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedAttempts, lockoutUntil, rememberMe, trustDevice, redirectAfterLogin]);

  // Auto-login logic for Development Environment
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && autoParam === 'admin') {
      const savedToken = localStorage.getItem('access_token');
      // Only auto-login if not already authenticated (no token)
      if (!savedToken) {
        onSubmit({ username: 'admin', password: 'admin' });
      } else {
        // If already logged in, redirect straight to dashboard
        router.push(redirectAfterLogin || '/dashboard');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoParam]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-4"
      suppressHydrationWarning
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <span className="text-2xl font-bold text-primary-foreground">S</span>
          </div>
          <CardTitle className="text-2xl">Bon retour</CardTitle>
          <CardDescription>Connectez-vous à votre compte SignApps</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
            {/* Rate limiting warning */}
            {isLockedOut && lockoutRemaining > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  Trop de tentatives. Réessayez dans{' '}
                  <span className="font-bold tabular-nums">{lockoutRemaining}</span>{' '}
                  seconde{lockoutRemaining > 1 ? 's' : ''}.
                </span>
              </div>
            )}

            {/* Failed attempts counter (before lockout) */}
            {failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && !isLockedOut && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-700 dark:text-amber-400">
                Tentative {failedAttempts}/{MAX_ATTEMPTS} — {MAX_ATTEMPTS - failedAttempts} essai{MAX_ATTEMPTS - failedAttempts > 1 ? 's' : ''} restant{MAX_ATTEMPTS - failedAttempts > 1 ? 's' : ''} avant verrouillage temporaire.
              </div>
            )}

            {error && !isLockedOut && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Nom d&apos;utilisateur</Label>
              <Input
                id="username"
                placeholder="Entrez votre nom d'utilisateur"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Entrez votre mot de passe"
                  {...register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Se souvenir de moi
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trust-device"
                  checked={trustDevice}
                  onCheckedChange={(checked) => setTrustDevice(checked === true)}
                />
                <Label htmlFor="trust-device" className="text-sm font-normal cursor-pointer">
                  Faire confiance à cet appareil pendant 30 jours
                </Label>
              </div>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={isSubmitting || isLockedOut}
              onClick={handleSubmit(onSubmit)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion en cours...
<<<<<<< Updated upstream
                </>
              ) : isLockedOut ? (
                <>
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Verrouillé ({lockoutRemaining}s)
=======
>>>>>>> Stashed changes
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                Ou continuer avec
              </span>
            </div>

            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => setShowLdapDialog(true)}
            >
              LDAP / Active Directory
            </Button>
          </div>
        </CardContent>
      </Card>

      <LdapLoginDialog
        open={showLdapDialog}
        onOpenChange={setShowLdapDialog}
      />
    </div>
  );
}
