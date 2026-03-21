'use client';

import { useState, useEffect } from 'react';
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
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LdapLoginDialog } from '@/components/auth/ldap-login-dialog';
import { parseApiError } from '@/lib/errors';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setMfaSessionToken, redirectAfterLogin, setRedirectAfterLogin } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showLdapDialog, setShowLdapDialog] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const autoParam = searchParams.get('auto');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);

      const response = await authApi.login({
        username: data.username,
        password: data.password,
        remember_me: rememberMe,
      });

      // Check if MFA is required
      if (response.data.mfa_required && response.data.mfa_session_token) {
        setMfaSessionToken(response.data.mfa_session_token);
        router.push('/login/verify');
        return;
      }

      // Store tokens
      if (response.data.access_token && response.data.refresh_token) {
        // Tokens are now stored securely in HttpOnly cookies by the backend

        // Set user data from response or fetch it
        if (response.data.user) {
          setUser(response.data.user);
        } else {
          const userResponse = await authApi.me();
          setUser(userResponse.data);
        }

        // Sync cookie immediately so middleware sees authenticated state
        const cookieValue = JSON.stringify({ state: { isAuthenticated: true } });
        const cookieProps = rememberMe ? 'max-age=31536000;' : '';
        document.cookie = `auth-storage=${encodeURIComponent(cookieValue)}; path=/; ${cookieProps} SameSite=Lax`;
        
        // Save remember state for session lifecycle tracking
        localStorage.setItem('remember_me', rememberMe ? 'true' : 'false');

        // Redirect to saved path or dashboard
        const redirectPath = redirectAfterLogin || '/dashboard';
        setRedirectAfterLogin(null);
        router.push(redirectPath);
      }
    } catch (err: unknown) {
      setError(parseApiError(err));
    }
  };

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
      className="flex min-h-screen w-full bg-background relative"
      suppressHydrationWarning
    >
      {/* Left Column: Form Setup */}
      <div className="flex flex-col justify-center flex-1 px-8 lg:flex-none lg:w-[480px] xl:w-[560px] lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4d51f2] shadow-sm text-white font-bold text-xl">
                S
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-[#4d51f2]">SignApps</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-3">Welcome Back!</h1>
            <p className="text-[15px] text-muted-foreground font-medium">Please enter login details below</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" suppressHydrationWarning>
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive font-medium border border-destructive/20">
                {error}
              </div>
            )}

            <div className="relative pt-2">
              <Label 
                htmlFor="username" 
                className="absolute left-4 top-0 bg-background px-1.5 text-[12px] font-bold text-foreground/80 z-10"
              >
                Username
              </Label>
              <Input
                id="username"
                className="h-[52px] bg-transparent shadow-sm rounded-xl border-border focus-visible:ring-1 focus-visible:ring-[#4d51f2] focus-visible:border-[#4d51f2] text-[15px] px-4"
                placeholder="Enter the username"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive mt-1.5 font-medium">{errors.username.message}</p>
              )}
            </div>

            <div className="relative pt-2">
              <Label 
                htmlFor="password" 
                className="absolute left-4 top-0 bg-background px-1.5 text-[12px] font-bold text-foreground/80 z-10"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  className="h-[52px] bg-transparent shadow-sm rounded-xl border-border focus-visible:ring-1 focus-visible:ring-[#4d51f2] focus-visible:border-[#4d51f2] text-[15px] px-4"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter the Password"
                  {...register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-4 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive mt-1.5 font-medium">{errors.password.message}</p>
              )}
              
              <div className="flex w-full justify-start items-center mt-3 px-1">
                 <div className="flex items-center space-x-2.5">
                   <Checkbox
                     id="remember"
                     checked={rememberMe}
                     onCheckedChange={(checked) => setRememberMe(checked === true)}
                     className="rounded-[4px] border-muted-foreground/40 data-[state=checked]:bg-[#4d51f2] data-[state=checked]:border-[#4d51f2]"
                   />
                   <Label htmlFor="remember" className="text-[13px] font-semibold cursor-pointer text-muted-foreground">
                     Remember me
                   </Label>
                 </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-[52px] rounded-xl text-base bg-[#4d51f2] hover:bg-[#4d51f2]/90 text-white shadow-sm font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0"
              disabled={isSubmitting}
              suppressHydrationWarning
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <Separator className="bg-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4 text-[13px] font-semibold text-muted-foreground">
                Or continue
              </span>
            </div>

            <Button
              variant="outline"
              className="mt-8 w-full h-[52px] rounded-xl text-[15px] text-foreground font-bold border-border hover:bg-accent/50 shadow-sm transition-all"
              onClick={() => setShowLdapDialog(true)}
            >
              <ShieldCheck className="mr-2 h-5 w-5 text-[#4d51f2]" />
              LDAP / Active Directory
            </Button>
          </div>
        </div>
      </div>

      {/* Right Column: Purple Illustration Panel */}
      <div className="relative hidden flex-1 lg:flex flex-col items-center justify-center p-6 pl-0">
         <div className="w-full h-full relative rounded-3xl bg-[#9292fc] overflow-hidden flex flex-col items-center justify-center shadow-lg">
            {/* Soft subtle gradient at the bottom for text readability */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#6c6cf0] via-[#6c6cf0]/60 to-transparent z-10 pointer-events-none"></div>

            {/* The actual illustration is scaled down and centered */}
            <img 
              src="/login_illustration.png" 
              alt="Platform Illustration" 
              className="w-[65%] max-w-[450px] object-contain mix-blend-multiply opacity-95 transition-transform duration-700 hover:scale-105 z-20 mb-20"
            />
            
            <div className="absolute bottom-16 left-0 right-0 z-30 px-12 text-center">
               <p className="text-white drop-shadow-sm max-w-[420px] mx-auto text-[17px] font-medium italic">
                 Manage your microservices, users, and infrastructure in an easy and more efficient way with SignApps...
               </p>
               
               {/* 3 dot navigation indicators for visual authenticity to mockup */}
               <div className="flex gap-2 justify-center mt-8">
                 <div className="h-2 w-8 rounded-full bg-white shadow-sm"></div>
                 <div className="h-2 w-2 rounded-full bg-white/40 shadow-sm"></div>
                 <div className="h-2 w-2 rounded-full bg-white/40 shadow-sm"></div>
               </div>
            </div>
         </div>
      </div>

      <LdapLoginDialog
        open={showLdapDialog}
        onOpenChange={setShowLdapDialog}
      />
    </div>
  );
}
