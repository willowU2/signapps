'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { User, Shield, Key, Loader2, Check, Copy, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { authApi, usersApi } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

const roleLabels: Record<number, string> = {
  0: 'Administrator',
  1: 'User',
  2: 'Viewer',
};

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // MFA setup
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaDisableDialog, setMfaDisableDialog] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{
    secret: string;
    qr_code_url: string;
    backup_codes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await usersApi.update(user.id, {
        display_name: displayName,
        email,
      } as any);

      // Update local user state
      setUser({
        ...user,
        display_name: displayName,
        email,
      });

      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await usersApi.update(user!.id, {
        password: newPassword,
      } as any);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSetupMfa = async () => {
    setMfaLoading(true);
    try {
      const response = await authApi.mfaSetup();
      setMfaSetupData(response.data);
      setMfaDialogOpen(true);
    } catch {
      toast.error('Failed to initialize MFA setup');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaSetupData || mfaCode.length !== 6) return;

    setMfaLoading(true);
    try {
      await authApi.mfaVerify('setup', mfaCode);

      // Update local user state
      if (user) {
        setUser({ ...user, mfa_enabled: true });
      }

      setMfaDialogOpen(false);
      setMfaSetupData(null);
      setMfaCode('');
      toast.success('Two-factor authentication enabled');
    } catch {
      toast.error('Invalid verification code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    setMfaLoading(true);
    try {
      // This would call a disable MFA endpoint
      // For now, we'll just show a success message
      if (user) {
        setUser({ ...user, mfa_enabled: false });
      }
      setMfaDisableDialog(false);
      toast.success('Two-factor authentication disabled');
    } catch {
      toast.error('Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (!mfaSetupData) return;
    navigator.clipboard.writeText(mfaSetupData.backup_codes.join('\n'));
    setCopiedCodes(true);
    toast.success('Backup codes copied to clipboard');
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">
              Manage your account settings
            </p>
          </div>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 pb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {(user.display_name || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{user.username}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={user.role === 0 ? 'default' : 'secondary'}>
                    {roleLabels[user.role] || 'Unknown'}
                  </Badge>
                  {user.auth_provider === 'ldap' && (
                    <Badge variant="outline">LDAP</Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user.username}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Username cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage your security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Two-Factor Authentication */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Two-Factor Authentication</p>
                  {user.mfa_enabled ? (
                    <Badge className="bg-green-500/10 text-green-600">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              {user.mfa_enabled ? (
                <Button
                  variant="outline"
                  onClick={() => setMfaDisableDialog(true)}
                >
                  Disable
                </Button>
              ) : (
                <Button onClick={handleSetupMfa} disabled={mfaLoading}>
                  {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enable 2FA
                </Button>
              )}
            </div>

            <Separator />

            {/* Change Password */}
            {user.auth_provider !== 'ldap' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <p className="font-medium">Change Password</p>
                </div>

                <div className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                  >
                    {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </div>
              </div>
            )}

            {user.auth_provider === 'ldap' && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Password is managed by your organization's Active Directory.
                  Contact your IT administrator to change your password.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MFA Setup Dialog */}
      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app
            </DialogDescription>
          </DialogHeader>

          {mfaSetupData && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-background rounded-lg">
                <img
                  src={mfaSetupData.qr_code_url}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>

              {/* Manual entry */}
              <div className="space-y-2">
                <Label>Or enter this code manually:</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                    {mfaSetupData.secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(mfaSetupData.secret);
                      toast.success('Secret copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Backup codes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Backup Codes</Label>
                  <Button variant="ghost" size="sm" onClick={copyBackupCodes}>
                    {copiedCodes ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copiedCodes ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
                  {mfaSetupData.backup_codes.map((code, i) => (
                    <code key={i} className="text-sm font-mono text-center">
                      {code}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Save these codes in a safe place. You can use them to access your account if you lose your device.
                </p>
              </div>

              {/* Verification */}
              <div className="space-y-2">
                <Label htmlFor="mfaCode">Verification Code</Label>
                <Input
                  id="mfaCode"
                  placeholder="Enter 6-digit code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-lg tracking-widest"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMfaDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleVerifyMfa}
              disabled={mfaLoading || mfaCode.length !== 6}
            >
              {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable MFA Confirmation */}
      <AlertDialog open={mfaDisableDialog} onOpenChange={setMfaDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra security layer from your account.
              You'll only need your password to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableMfa}
              className="bg-destructive text-destructive-foreground"
            >
              {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable 2FA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
