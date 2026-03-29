'use client';

import { useState } from 'react';
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
  Monitor,
  Trash2,
  QrCode,
  AlertTriangle,
} from 'lucide-react';
import { ActiveSessions } from '@/components/settings/active-sessions';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';

// ---------------------------------------------------------------------------
// Mock recovery codes
// ---------------------------------------------------------------------------

const MOCK_RECOVERY_CODES = [
  'A1B2-C3D4-E5F6',
  'G7H8-I9J0-K1L2',
  'M3N4-O5P6-Q7R8',
  'S9T0-U1V2-W3X4',
  'Y5Z6-A7B8-C9D0',
  'E1F2-G3H4-I5J6',
  'K7L8-M9N0-O1P2',
  'Q3R4-S5T6-U7V8',
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SecuritySettingsPage() {
  usePageTitle('Securite');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);

  // TOTP setup flow
  const handleToggle2FA = (enabled: boolean) => {
    if (enabled) {
      setShowSetup(true);
    } else {
      setDisableConfirmOpen(true);
    }
  };

  const handleVerify = () => {
    if (verificationCode.length !== 6) {
      toast.error('Le code doit contenir 6 chiffres');
      return;
    }
    // Mock verification — always succeeds
    setTwoFactorEnabled(true);
    setShowSetup(false);
    setVerificationCode('');
    setShowRecoveryCodes(true);
    toast.success('Authentification a deux facteurs activee');
  };

  const handleDisable2FA = () => {
    setTwoFactorEnabled(false);
    setShowSetup(false);
    setShowRecoveryCodes(false);
    setDisableConfirmOpen(false);
    toast.success('Authentification a deux facteurs desactivee');
  };

  const handleCancelSetup = () => {
    setShowSetup(false);
    setVerificationCode('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success('Copie dans le presse-papiers');
  };

  const copyAllCodes = () => {
    navigator.clipboard.writeText(MOCK_RECOVERY_CODES.join('\n'));
    toast.success('Tous les codes copies');
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Sécurité du compte"
          description="Authentification à deux facteurs, sessions actives et codes de récupération"
          icon={<ShieldCheck className="h-5 w-5" />}
        />

        {/* ---------------------------------------------------------------- */}
        {/* 2FA Toggle */}
        {/* ---------------------------------------------------------------- */}
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
                {twoFactorEnabled && (
                  <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                )}
                <Switch
                  checked={twoFactorEnabled || showSetup}
                  onCheckedChange={handleToggle2FA}
                />
              </div>
            </div>
          </CardHeader>

          {/* TOTP Setup form */}
          {showSetup && !twoFactorEnabled && (
            <CardContent className="border-t pt-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* QR Code placeholder */}
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-medium">
                    1. Scannez ce QR code avec votre application
                  </p>
                  <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                    <QrCode className="h-16 w-16 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Ou entrez cette cle manuellement :
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                      JBSW Y3DP EHPK 3PXP
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard('JBSWY3DPEHPK3PXP')}
                    >
                      {copiedCode === 'JBSWY3DPEHPK3PXP' ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Verification */}
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
                    <Button onClick={handleVerify} disabled={verificationCode.length !== 6}>
                      Verifier et activer
                    </Button>
                    <Button variant="outline" onClick={handleCancelSetup}>
                      Annuler
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Recovery Codes */}
        {/* ---------------------------------------------------------------- */}
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
                disabled={!twoFactorEnabled}
              >
                {showRecoveryCodes ? 'Masquer' : 'Afficher'}
              </Button>
            </div>
          </CardHeader>
          {showRecoveryCodes && twoFactorEnabled && (
            <CardContent className="border-t pt-4 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Conservez ces codes dans un endroit sur. Chaque code ne peut etre utilise
                  qu&apos;une seule fois.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MOCK_RECOVERY_CODES.map((code) => (
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
                <Button variant="outline" size="sm" onClick={copyAllCodes}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copier tous les codes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success('Nouveaux codes generes (demo)')}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerer
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Active Sessions */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardContent className="pt-6">
            <ActiveSessions />
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Disable 2FA confirmation dialog */}
        {/* ---------------------------------------------------------------- */}
        <AlertDialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desactiver l&apos;authentification a deux facteurs ?</AlertDialogTitle>
              <AlertDialogDescription>
                Votre compte sera moins protege. Les codes de recuperation existants seront
                invalides.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDisable2FA}
                className="bg-destructive text-destructive-foreground"
              >
                Desactiver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
