'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff, Loader2, Network } from 'lucide-react';
import { parseApiError } from '@/lib/errors';

const ldapLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LdapLoginForm = z.infer<typeof ldapLoginSchema>;

interface LdapLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LdapLoginDialog({ open, onOpenChange }: LdapLoginDialogProps) {
  const router = useRouter();
  const { setUser, setMfaSessionToken, redirectAfterLogin, setRedirectAfterLogin } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LdapLoginForm>({
    resolver: zodResolver(ldapLoginSchema),
  });

  const onSubmit = async (data: LdapLoginForm) => {
    try {
      setError(null);
      const response = await authApi.login({
        username: data.username,
        password: data.password,
        remember_me: rememberMe
      });

      // Check if MFA is required
      if (response.data.mfa_required && response.data.mfa_session_token) {
        setMfaSessionToken(response.data.mfa_session_token);
        onOpenChange(false);
        router.push('/login/verify');
        return;
      }

      // Store tokens
      if (response.data.access_token && response.data.refresh_token) {
        // Tokens are now stored securely in HttpOnly cookies by the backend

        // Set user data
        if (response.data.user) {
          setUser(response.data.user);
        } else {
          const userResponse = await authApi.me();
          setUser(userResponse.data);
        }

        // Redirect
        const redirectPath = redirectAfterLogin || '/dashboard';
        setRedirectAfterLogin(null);
        onOpenChange(false);
        router.push(redirectPath);
      }
    } catch (err: unknown) {
      setError(parseApiError(err));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center">LDAP / Active Directory</DialogTitle>
          <DialogDescription className="text-center">
            Sign in with your corporate credentials
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ldap-username">Username</Label>
            <Input
              id="ldap-username"
              placeholder="domain\\username or username@domain"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ldap-password">Password</Label>
            <div className="relative">
              <Input
                id="ldap-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="ldap-remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <Label htmlFor="ldap-remember" className="text-sm font-normal cursor-pointer">
              Remember me
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Sign In with LDAP'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
