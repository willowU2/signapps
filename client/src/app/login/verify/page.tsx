'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { parseApiError } from '@/lib/errors';

export default function VerifyPage() {
  const router = useRouter();
  const { mfaSessionToken, setUser, setMfaSessionToken, redirectAfterLogin } = useAuthStore();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no MFA session token
  useEffect(() => {
    if (!mfaSessionToken) {
      router.push('/login');
    }
  }, [mfaSessionToken, router]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every((digit) => digit !== '') && newCode.join('').length === 6) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (codeString?: string) => {
    const verificationCode = codeString || code.join('');
    if (verificationCode.length !== 6 || !mfaSessionToken) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authApi.mfaVerify(mfaSessionToken, verificationCode);

      if (response.data.access_token && response.data.refresh_token) {
        // Tokens are stored securely in HttpOnly cookies by the backend

        // Set user in store
        if (response.data.user) {
          setUser(response.data.user);
        }

        // Sync cookie immediately so middleware sees authenticated state
        const cookieValue = JSON.stringify({ state: { isAuthenticated: true } });
        const secure = window.location.protocol === 'https:' ? ' Secure;' : '';
        document.cookie = `auth-storage=${encodeURIComponent(cookieValue)}; path=/;${secure} max-age=31536000; SameSite=Lax`;

        // Clear MFA session token
        setMfaSessionToken(null);

        // Redirect to dashboard or saved redirect path
        const redirectPath = redirectAfterLogin || '/dashboard';
        router.push(redirectPath);
      }
    } catch (err: unknown) {
      setError(parseApiError(err));
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaSessionToken(null);
    router.push('/login');
  };

  if (!mfaSessionToken) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="h-14 w-12 text-center text-2xl font-semibold"
                  disabled={isSubmitting}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <Button
              onClick={() => handleSubmit()}
              className="w-full"
              disabled={isSubmitting || code.some((d) => !d)}
            >
              {isSubmitting ? (
                <>
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to login
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Lost access to your authenticator? Contact your administrator for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
