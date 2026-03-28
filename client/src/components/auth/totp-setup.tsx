"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Copy, Check, AlertCircle, Loader2 } from "lucide-react";
import { IDENTITY_URL } from "@/lib/api/core";
import axios from "axios";
import { toast } from "sonner";

interface MfaSetupData {
  secret: string;
  qr_code: string;
  backup_codes: string[];
}

type SetupStep = "idle" | "scanning" | "verifying" | "done";

export function TotpSetup() {
  const [step, setStep] = useState<SetupStep>("idle");
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const initSetup = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post(`${IDENTITY_URL}/auth/mfa/setup`, {}, {
        withCredentials: true,
      });
      setSetupData(res.data);
      setStep("scanning");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : "Setup failed";
      toast.error(msg || "Failed to initiate TOTP setup");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      toast.error("Saisissez le code à 6 chiffres de votre application d'authentification");
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post(`${IDENTITY_URL}/auth/mfa/verify`, { code }, {
        withCredentials: true,
      });
      if (res.data.success) {
        setStep("done");
        toast.success("Authentification à deux facteurs activée");
      } else {
        toast.error(res.data.message || "Invalid code, please retry");
      }
    } catch {
      toast.error("Vérification échouée. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = async () => {
    if (!setupData) return;
    await navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const copyBackupCodes = async () => {
    if (!setupData) return;
    await navigator.clipboard.writeText(setupData.backup_codes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  if (step === "done") {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <ShieldCheck className="h-16 w-16 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">2FA Enabled</h3>
        <p className="text-sm text-gray-600">
          Your account is now protected with two-factor authentication.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold">Set Up Two-Factor Authentication</h2>
      </div>

      {step === "idle" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Add an extra layer of security to your account using an authenticator app
            (Google Authenticator, Authy, etc.).
          </p>
          <Button onClick={initSetup} disabled={isLoading} className="w-full gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Start Setup
          </Button>
        </div>
      )}

      {step === "scanning" && setupData && (
        <div className="space-y-5">
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-2">Step 1: Scan with your authenticator app</p>
            <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-4">
              <img
                src={setupData.qr_code}
                alt="TOTP QR Code"
                className="h-48 w-48"
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">Or enter manually:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-gray-100 px-3 py-2 font-mono text-xs break-all">
                {setupData.secret}
              </code>
              <Button variant="outline" size="sm" onClick={copySecret} className="shrink-0">
                {copiedSecret ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Backup codes (save these):</p>
              <Button variant="ghost" size="sm" onClick={copyBackupCodes} className="gap-1 text-xs">
                {copiedCodes ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copy all
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
              {setupData.backup_codes.map((c, i) => (
                <code key={i} className="font-mono text-xs text-amber-800">{c}</code>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-amber-700">
              <AlertCircle className="h-3 w-3" />
              Store these in a safe place. Each code can only be used once.
            </div>
          </div>

          <Button onClick={() => setStep("verifying")} className="w-full">
            Continue to Verification
          </Button>
        </div>
      )}

      {step === "verifying" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Step 2:</span> Enter the 6-digit code from your authenticator app to confirm setup.
          </p>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl font-mono tracking-widest"
            onKeyDown={(e) => e.key === "Enter" && verifyCode()}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("scanning")} className="flex-1">
              Back
            </Button>
            <Button onClick={verifyCode} disabled={isLoading || code.length !== 6} className="flex-1 gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify & Enable
            </Button>
          </div>
          {setupData && (
            <p className="text-xs text-gray-500 text-center">
              <Badge variant="secondary" className="text-xs">Recovery</Badge>{" "}
              You can also use a backup code if your device is unavailable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
