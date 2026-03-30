'use client';

// SE1: Security settings page — real MFA/TOTP API integration
// Replaces mock-only implementation with live backend calls.

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  ShieldCheck,
  Smartphone,
  Key,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ActiveSessions } from '@/components/settings/active-sessions';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';
import { authApi } from '@/lib/api/identity';

export default function SecuritySettingsPage() {
  usePageTitle('Securite');

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  useEffect(() => {
    authApi
      .mfaStatus()
      .then((res: { data: unknown }) => {
        const data = res.data as { enabled?: boolean };
        setMfaEnabled(!!data.enabled);
      })
      .catch(() => {})
      .finally(() => setMfaLoading(false));
  }, []);

  const handleToggle2FA = async (enabled: boolean) => {
    if (enabled) {
      setSetupLoading(true);
      try {
        const res = await authApi.mfaSetup();
        setQrCode((res.data.qr_code ?? res.data.qr_code_url) ?? null);
        setSecret(res.data.secret ?? null);
        setBackupCodes(res.data.backup_codes ?? []);
        setShowSetup(true);
      } catch {
        toast.error("Impossible d'initialiser la configuration MFA");
      } finally {
        setSetupLoading(false);
      }
    } else {
      setDisableConfirmOpen(true);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Le code doit contenir 6 chiffres');
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await authApi.mfaVerify('', verificationCode);
      const data = res.data as { success?: boolean };
      if (data.success) {
        setMfaEnabled(true);
        setShowSetup(false);
        setVerificationCode('');
        setShowRecoveryCodes(true);
        toast.success('Authentification a deux facteurs activee');
      } else {
        toast.error('Code invalide. Veuillez reessayer.');
      }
    } catch {
      toast.error('Code invalide ou expire');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword || !disableCode) {
      toast.error('Mot de passe et code TOTP requis');
      return;
    }
    setDisableLoading(true);
    try {
      await authApi.mfaDisable({ password: disablePassword, code: disableCode });
      setMfaEnabled(false);
      setShowSetup(false);
      setShowRecoveryCodes(false);
      setDisableConfirmOpen(false);
      setQrCode(null);
      setSecret(null);
      setBackupCodes([]);
      setDisablePassword('');
      setDisableCode('');
      toast.success('Authentification a deux facteurs desactivee');
    } catch {
      toast.error('Impossible de desactiver le MFA. Verifiez votre mot de passe et code.');
    } finally {
      setDisableLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setShowSetup(false);
    setVerificationCode('');
    setQrCode(null);
    setSecret(null);
    setBackupCodes([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Copie dans le presse-papiers');
  };

  const formattedSecret = secret
    ? secret.match(/.{1,4}/g)?.join(' ') ?? secret
    : null;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Securite du compte"
          description="Authentification a deux facteurs, sessions actives et codes de recuperation"
          icon={<ShieldCheck className="h-5 w-5" />}
        />

        {/* 2FA card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">
                    Authentification a deux facteurs (TOTP)
                  </CardTitle>
                  <CardDescription>
                    Protegez votre compte avec une application d&apos;authentification (Google
                    Authenticator, Authy, etc.)
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {mfaEnabled && (
                  <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                )}
                {mfaLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={mfaEnabled || showSetup}
                    onCheckedChange={handleToggle2FA}
                    disabled={setupLoading}
                  />
                )}
              </div>
            </div>
          </CardHeader>

          {showSetup && !mfaEnabled && (
            <CardContent className="border-t pt-6 space-y-6">
              {setupLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm font-medium">
                      1. Scannez ce QR code avec votre application
                    </p>
                    <div className="w-48 h-48 bg-white dark:bg-white rounded-lg flex items-center justify-center border overflow-hidden">
                      {qrCode ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrCode} alt="QR Code TOTP" className="w-full h-full object-contain" />
                      ) : (
                        <QrCode className="h-16 w-16 text-muted-foreground/40" />
                      )}
                    </div>
                    {formattedSecret && (
                      <>
                        <p className="text-xs text-muted-foreground text-center">
                          Ou entrez cette cle manuellement :
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                            {formattedSecret}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(secret!)}
                          >
                            {copiedCode === secret ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-medium">
                      2. Entrez le code a 6 chiffres affiche par l&apos;application
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="totpCode">Code de verification</Label>
                      <Input
                        id="totpCode"
                        placeholder="000000"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) =>
                          setVerificationCode(e.target.value.replace(/\D/g, ''))
                        }
                        className="font-mono text-lg tracking-widest text-center"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleVerify}
                        disabled={verificationCode.length !== 6 || verifyLoading}
                      >
                        {verifyLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Verification...
                          </>
                        ) : (
                          'Verifier et activer'
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleCancelSetup}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Recovery codes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Codes de recuperation</CardTitle>
                  <CardDescription>
                    Utilisez ces codes pour acceder a votre compte si vous perdez votre appareil
                    d&apos;authentification
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecoveryCodes(!showRecoveryCodes)}
                disabled={!mfaEnabled || backupCodes.length === 0}
              >
                {showRecoveryCodes ? 'Masquer' : 'Afficher'}
              </Button>
            </div>
          </CardHeader>
          {showRecoveryCodes && mfaEnabled && backupCodes.length > 0 && (
            <CardContent className="border-t pt-4 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Conservez ces codes dans un endroit sur. Chaque code ne peut etre utilise
                  qu&apos;une seule fois.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div
                    key={code}
                    className="flex items-center justify-between bg-muted rounded px-3 py-2"
                  >
                    <code className="text-sm font-mono">{code}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(code)}
                    >
                      {copiedCode === code ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(backupCodes.join('\n')).then(() => toast.success('Tous les codes copies'))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copier tous les codes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await authApi.mfaSetup();
                      setBackupCodes(res.data.backup_codes ?? []);
                      toast.success('Nouveaux codes de recuperation generes');
                    } catch {
                      toast.error('Impossible de regenerer les codes');
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerer
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Active sessions */}
        <Card>
          <CardContent className="pt-6">
            <ActiveSessions />
          </CardContent>
        </Card>

        {/* Disable 2FA dialog */}
        <AlertDialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desactiver l&apos;authentification a deux facteurs ?</AlertDialogTitle>
              <AlertDialogDescription>
                Votre compte sera moins protege. Les codes de recuperation existants seront
                invalides.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 px-6">
              <div className="space-y-1">
                <Label htmlFor="disable-password" className="text-sm">Mot de passe actuel</Label>
                <Input
                  id="disable-password"
                  type="password"
                  placeholder="..."
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="disable-code" className="text-sm">Code TOTP actuel</Label>
                <Input
                  id="disable-code"
                  placeholder="000000"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  className="font-mono tracking-widest text-center"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disableLoading}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDisable2FA}
                className="bg-destructive text-destructive-foreground"
                disabled={disableLoading || !disablePassword || disableCode.length !== 6}
              >
                {disableLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Desactiver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
