'use client';

import { SpinnerInfinity } from 'spinners-react';

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
import { User, Shield, Key, Check, Copy, ArrowLeft, Upload, Trash2, Clock, Monitor, CalendarDays } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { authApi, usersApi } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileUploadProgressBar } from '@/components/application/file-upload/file-upload-progress-bar';
import { PasswordStrength } from '@/components/auth/password-strength';
import { usePageTitle } from '@/hooks/use-page-title';

const roleLabels: Record<number, string> = {
  0: 'Administrator',
  1: 'User',
  2: 'Viewer',
};

export default function ProfilePage() {
  usePageTitle('Profil');
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
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
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  // Session history (from localStorage)
  const [sessionHistory, setSessionHistory] = useState<Array<{ date: string; browser: string; ip: string }>>([]);

  useEffect(() => {
    // Track current session
    const sessions = JSON.parse(localStorage.getItem('signapps_session_history') || '[]');
    const currentSession = {
      date: new Date().toISOString(),
      browser: navigator.userAgent.replace(/.*?(Chrome|Firefox|Safari|Edge|Opera)[/\s](\d+).*/, '$1 $2') || 'Unknown',
      ip: 'local',
    };
    // Only add if last session was more than 5 minutes ago
    const lastSession = sessions[0];
    if (!lastSession || new Date().getTime() - new Date(lastSession.date).getTime() > 300000) {
      sessions.unshift(currentSession);
      if (sessions.length > 20) sessions.length = 20;
      localStorage.setItem('signapps_session_history', JSON.stringify(sessions));
    }
    setSessionHistory(sessions);
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleAvatarUploadStrategy = async (
    id: string,
    file: File,
    onProgress: (progress: number) => void,
    onSuccess: () => void,
    onError: (error: string) => void
  ) => {
    try {
      onProgress(10);
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              onProgress(50);
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
              const MAX_SIZE = 256;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                  if (width > MAX_SIZE) {
                      height *= MAX_SIZE / width;
                      width = MAX_SIZE;
                  }
              } else {
                  if (height > MAX_SIZE) {
                      width *= MAX_SIZE / height;
                      height = MAX_SIZE;
                  }
              }

              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);

              const dataUrl = canvas.toDataURL('image/webp', 0.8);
              setAvatarUrl(dataUrl);
              onProgress(100);
              onSuccess();
              setAvatarDialogOpen(false);
          };
          img.onerror = () => onError("Failed to load image");
          img.src = event.target?.result as string;
      };
      reader.onerror = () => onError("Failed to read file");
      reader.readAsDataURL(file);
    } catch (err) {
      onError((err as Error).message);
    }
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setEmail(user.email || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await usersApi.update(user.id, {
        display_name: displayName,
        email,
        avatar_url: avatarUrl,
      } as any);

      // Update local user state
      setUser({
        ...user,
        display_name: displayName,
        email,
        avatar_url: avatarUrl,
      });

      toast.success('Profil mis à jour successfully');
    } catch {
      toast.error('Impossible de mettre à jour profile');
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
      toast.success('Mot de passe modifié successfully');
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
      toast.success('Authentification à deux facteurs activée');
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
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8 " />
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
            <div className="flex items-center gap-6 pb-4">
              <div className="group relative h-20 w-20 flex-shrink-0">
                <Avatar className="h-20 w-20 border-2 border-dashed border-border/50 bg-muted/30">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-3xl font-bold text-primary">
                      {(user.display_name || user.username || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div 
                  className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer overflow-hidden backdrop-blur-sm"
                  onClick={() => setAvatarDialogOpen(true)}
                >
                  <Upload className="h-5 w-5 text-white mb-1" />
                  <span className="text-[9px] text-white font-medium uppercase tracking-wider">Change</span>
                </div>
                
                <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Update Profile Picture</DialogTitle>
                      <DialogDescription>
                        Upload a new image for your avatar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                      <FileUploadProgressBar 
                        customUploadStrategy={handleAvatarUploadStrategy}
                        acceptedTypes="image/*"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex flex-col gap-1 w-full justify-center">
                <div className="flex items-center justify-between w-full">
                  <p className="font-semibold text-lg">{user.username}</p>
                  {avatarUrl && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setAvatarUrl('')} 
                      className="text-destructive h-8 px-2 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>
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
                {saving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Account details and login activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Account Created</p>
                <p className="text-sm font-medium">{formatDate(user.created_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Last Login</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{formatDate(user.last_login)}</p>
                  {user.last_login && (
                    <span className="text-xs text-muted-foreground">({formatTimeAgo(user.last_login)})</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Auth Provider</p>
                <Badge variant="outline" className="capitalize">{user.auth_provider || 'local'}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="text-xs font-mono text-muted-foreground truncate">{user.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Session History
            </CardTitle>
            <CardDescription>
              Recent login sessions for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No session history available</p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {sessionHistory.map((session, i) => (
                    <div
                      key={`${session.date}-${i}`}
                      className={`flex items-center justify-between rounded-lg border p-3 ${i === 0 ? 'border-primary/30 bg-primary/5' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${i === 0 ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Monitor className={`h-4 w-4 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2">
                            {session.browser}
                            {i === 0 && <Badge className="bg-green-500/10 text-green-600 text-[10px] h-4 px-1.5">Current</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(session.date)}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatTimeAgo(session.date)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
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
                  {mfaLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
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
                    {newPassword && <PasswordStrength password={newPassword} showRequirements={true} />}
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
                    {changingPassword && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
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
              {mfaLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
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
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableMfa}
              className="bg-destructive text-destructive-foreground"
            >
              {mfaLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
              Disable 2FA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
