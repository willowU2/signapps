'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Settings,
  Shield,
  Mail,
  HardDrive,
  Puzzle,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Globe,
  Lock,
  Server,
  Key,
  Webhook,
} from 'lucide-react';

// ─── General Settings ───────────────────────────────────────────────
interface GeneralSettings {
  platformName: string;
  logoUrl: string;
  defaultLanguage: string;
  timezone: string;
  description: string;
  maintenanceMode: boolean;
}

const defaultGeneral: GeneralSettings = {
  platformName: 'SignApps Platform',
  logoUrl: '/logo.png',
  defaultLanguage: 'fr',
  timezone: 'Europe/Paris',
  description: 'Plateforme de gestion infrastructure et services',
  maintenanceMode: false,
};

// ─── Security Settings ─────────────────────────────────────────────
interface SecuritySettings {
  minPasswordLength: number;
  passwordExpireDays: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  enforce2FA: boolean;
  maxSessions: number;
  sessionTimeoutMinutes: number;
  lockoutAttempts: number;
  lockoutDurationMinutes: number;
}

const defaultSecurity: SecuritySettings = {
  minPasswordLength: 12,
  passwordExpireDays: 90,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  enforce2FA: false,
  maxSessions: 5,
  sessionTimeoutMinutes: 480,
  lockoutAttempts: 5,
  lockoutDurationMinutes: 30,
};

// ─── Email Settings ─────────────────────────────────────────────────
interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  senderEmail: string;
  senderName: string;
  useTLS: boolean;
  useSTARTTLS: boolean;
}

const defaultEmail: EmailSettings = {
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  senderEmail: 'noreply@signapps.local',
  senderName: 'SignApps Platform',
  useTLS: false,
  useSTARTTLS: true,
};

// ─── Storage Settings ───────────────────────────────────────────────
interface StorageSettings {
  mode: 'local' | 's3';
  localPath: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Region: string;
  maxFileSize: number;
  quotaPerUser: number;
  allowedTypes: string;
}

const defaultStorage: StorageSettings = {
  mode: 'local',
  localPath: './data/storage',
  s3Endpoint: '',
  s3Bucket: '',
  s3AccessKey: '',
  s3SecretKey: '',
  s3Region: 'eu-west-1',
  maxFileSize: 100,
  quotaPerUser: 5120,
  allowedTypes: 'pdf,docx,xlsx,pptx,png,jpg,jpeg,gif,svg,mp4,mp3,zip,tar.gz',
};

// ─── Integration Settings ───────────────────────────────────────────
interface ApiKey {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
}

interface WebhookEntry {
  id: string;
  url: string;
  events: string;
  enabled: boolean;
}

interface IntegrationSettings {
  apiKeys: ApiKey[];
  webhooks: WebhookEntry[];
}

const defaultIntegrations: IntegrationSettings = {
  apiKeys: [
    { id: '1', name: 'OpenAI', key: 'sk-...', enabled: true },
    { id: '2', name: 'Anthropic', key: 'sk-ant-...', enabled: true },
    { id: '3', name: 'Google AI', key: '', enabled: false },
  ],
  webhooks: [
    { id: '1', url: 'https://hooks.slack.com/services/...', events: 'user.created,user.deleted', enabled: true },
  ],
};

// ─── Password Visibility Helper ─────────────────────────────────────
function PasswordInput({ value, onChange, placeholder, id }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const [general, setGeneral] = useState<GeneralSettings>(defaultGeneral);
  const [security, setSecurity] = useState<SecuritySettings>(defaultSecurity);
  const [email, setEmail] = useState<EmailSettings>(defaultEmail);
  const [storage, setStorage] = useState<StorageSettings>(defaultStorage);
  const [integrations, setIntegrations] = useState<IntegrationSettings>(defaultIntegrations);

  const handleSave = (section: string) => {
    toast.success(`${section} sauvegard\u00e9 avec succ\u00e8s`);
  };

  const addApiKey = () => {
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: '',
      key: '',
      enabled: true,
    };
    setIntegrations((prev) => ({ ...prev, apiKeys: [...prev.apiKeys, newKey] }));
  };

  const removeApiKey = (id: string) => {
    setIntegrations((prev) => ({
      ...prev,
      apiKeys: prev.apiKeys.filter((k) => k.id !== id),
    }));
  };

  const updateApiKey = (id: string, field: keyof ApiKey, value: string | boolean) => {
    setIntegrations((prev) => ({
      ...prev,
      apiKeys: prev.apiKeys.map((k) => (k.id === id ? { ...k, [field]: value } : k)),
    }));
  };

  const addWebhook = () => {
    const newHook: WebhookEntry = {
      id: Date.now().toString(),
      url: '',
      events: '',
      enabled: true,
    };
    setIntegrations((prev) => ({ ...prev, webhooks: [...prev.webhooks, newHook] }));
  };

  const removeWebhook = (id: string) => {
    setIntegrations((prev) => ({
      ...prev,
      webhooks: prev.webhooks.filter((w) => w.id !== id),
    }));
  };

  const updateWebhook = (id: string, field: keyof WebhookEntry, value: string | boolean) => {
    setIntegrations((prev) => ({
      ...prev,
      webhooks: prev.webhooks.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="size-8" />
          Param\u00e8tres de la plateforme
        </h1>
        <p className="text-muted-foreground mt-1">
          Configuration g\u00e9n\u00e9rale, s\u00e9curit\u00e9, messagerie, stockage et int\u00e9grations.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="general" className="gap-2">
            <Globe className="size-4" />
            G\u00e9n\u00e9ral
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="size-4" />
            S\u00e9curit\u00e9
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="size-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <HardDrive className="size-4" />
            Stockage
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Puzzle className="size-4" />
            Int\u00e9grations
          </TabsTrigger>
        </TabsList>

        {/* ── G\u00e9n\u00e9ral ────────────────────────────────────────────── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-5" />
                Param\u00e8tres g\u00e9n\u00e9raux
              </CardTitle>
              <CardDescription>
                Informations de base de la plateforme et pr\u00e9f\u00e9rences r\u00e9gionales.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="platformName">Nom de la plateforme</Label>
                  <Input
                    id="platformName"
                    value={general.platformName}
                    onChange={(e) => setGeneral({ ...general, platformName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">URL du logo</Label>
                  <Input
                    id="logoUrl"
                    value={general.logoUrl}
                    onChange={(e) => setGeneral({ ...general, logoUrl: e.target.value })}
                    placeholder="/logo.png ou https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Langue par d\u00e9faut</Label>
                  <Select
                    value={general.defaultLanguage}
                    onValueChange={(v) => setGeneral({ ...general, defaultLanguage: v })}
                  >
                    <SelectTrigger id="language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Fran\u00e7ais</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="es">Espa\u00f1ol</SelectItem>
                      <SelectItem value="nl">Nederlands</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuseau horaire</Label>
                  <Select
                    value={general.timezone}
                    onValueChange={(v) => setGeneral({ ...general, timezone: v })}
                  >
                    <SelectTrigger id="timezone" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Paris">Europe/Paris (UTC+1)</SelectItem>
                      <SelectItem value="Europe/Brussels">Europe/Brussels (UTC+1)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                      <SelectItem value="Europe/Berlin">Europe/Berlin (UTC+1)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles (UTC-8)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={general.description}
                  onChange={(e) => setGeneral({ ...general, description: e.target.value })}
                  rows={3}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mode maintenance</Label>
                  <p className="text-sm text-muted-foreground">
                    Restreindre l&apos;acc\u00e8s \u00e0 la plateforme aux administrateurs uniquement.
                  </p>
                </div>
                <Switch
                  checked={general.maintenanceMode}
                  onCheckedChange={(v) => setGeneral({ ...general, maintenanceMode: v })}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave('Param\u00e8tres g\u00e9n\u00e9raux')} className="gap-2">
                  <Save className="size-4" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── S\u00e9curit\u00e9 ──────────────────────────────────────────── */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="size-5" />
                  Politique de mot de passe
                </CardTitle>
                <CardDescription>
                  D\u00e9finissez les exigences de complexit\u00e9 et d&apos;expiration des mots de passe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minPassword">Longueur minimale</Label>
                    <Input
                      id="minPassword"
                      type="number"
                      min={6}
                      max={128}
                      value={security.minPasswordLength}
                      onChange={(e) => setSecurity({ ...security, minPasswordLength: parseInt(e.target.value) || 8 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expireDays">Expiration (jours)</Label>
                    <Input
                      id="expireDays"
                      type="number"
                      min={0}
                      value={security.passwordExpireDays}
                      onChange={(e) => setSecurity({ ...security, passwordExpireDays: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">0 = pas d&apos;expiration</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="requireUpper" className="cursor-pointer">Majuscules requises</Label>
                    <Switch
                      id="requireUpper"
                      checked={security.requireUppercase}
                      onCheckedChange={(v) => setSecurity({ ...security, requireUppercase: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="requireNum" className="cursor-pointer">Chiffres requis</Label>
                    <Switch
                      id="requireNum"
                      checked={security.requireNumbers}
                      onCheckedChange={(v) => setSecurity({ ...security, requireNumbers: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="requireSpecial" className="cursor-pointer">Caract\u00e8res sp\u00e9ciaux</Label>
                    <Switch
                      id="requireSpecial"
                      checked={security.requireSpecialChars}
                      onCheckedChange={(v) => setSecurity({ ...security, requireSpecialChars: v })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5" />
                  Authentification et sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>2FA obligatoire</Label>
                    <p className="text-sm text-muted-foreground">
                      Forcer l&apos;authentification \u00e0 deux facteurs pour tous les utilisateurs.
                    </p>
                  </div>
                  <Switch
                    checked={security.enforce2FA}
                    onCheckedChange={(v) => setSecurity({ ...security, enforce2FA: v })}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maxSessions">Sessions max par utilisateur</Label>
                    <Input
                      id="maxSessions"
                      type="number"
                      min={1}
                      max={50}
                      value={security.maxSessions}
                      onChange={(e) => setSecurity({ ...security, maxSessions: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Timeout session (minutes)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      min={5}
                      value={security.sessionTimeoutMinutes}
                      onChange={(e) => setSecurity({ ...security, sessionTimeoutMinutes: parseInt(e.target.value) || 480 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lockoutAttempts">Tentatives avant verrouillage</Label>
                    <Input
                      id="lockoutAttempts"
                      type="number"
                      min={1}
                      value={security.lockoutAttempts}
                      onChange={(e) => setSecurity({ ...security, lockoutAttempts: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lockoutDuration">Dur\u00e9e de verrouillage (minutes)</Label>
                    <Input
                      id="lockoutDuration"
                      type="number"
                      min={1}
                      value={security.lockoutDurationMinutes}
                      onChange={(e) => setSecurity({ ...security, lockoutDurationMinutes: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleSave('S\u00e9curit\u00e9')} className="gap-2">
                    <Save className="size-4" />
                    Sauvegarder
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Email ──────────────────────────────────────────────── */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-5" />
                Configuration SMTP
              </CardTitle>
              <CardDescription>
                Param\u00e8tres du serveur de messagerie pour l&apos;envoi d&apos;emails transactionnels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">H\u00f4te SMTP</Label>
                  <Input
                    id="smtpHost"
                    value={email.smtpHost}
                    onChange={(e) => setEmail({ ...email, smtpHost: e.target.value })}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={email.smtpPort}
                    onChange={(e) => setEmail({ ...email, smtpPort: parseInt(e.target.value) || 587 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">Utilisateur</Label>
                  <Input
                    id="smtpUser"
                    value={email.smtpUser}
                    onChange={(e) => setEmail({ ...email, smtpUser: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">Mot de passe</Label>
                  <PasswordInput
                    id="smtpPassword"
                    value={email.smtpPassword}
                    onChange={(v) => setEmail({ ...email, smtpPassword: v })}
                    placeholder="Mot de passe SMTP"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senderEmail">Email exp\u00e9diteur</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    value={email.senderEmail}
                    onChange={(e) => setEmail({ ...email, senderEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderName">Nom exp\u00e9diteur</Label>
                  <Input
                    id="senderName"
                    value={email.senderName}
                    onChange={(e) => setEmail({ ...email, senderName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="useTLS" className="cursor-pointer">TLS (port 465)</Label>
                  <Switch
                    id="useTLS"
                    checked={email.useTLS}
                    onCheckedChange={(v) => setEmail({ ...email, useTLS: v, useSTARTTLS: v ? false : email.useSTARTTLS })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="useSTARTTLS" className="cursor-pointer">STARTTLS (port 587)</Label>
                  <Switch
                    id="useSTARTTLS"
                    checked={email.useSTARTTLS}
                    onCheckedChange={(v) => setEmail({ ...email, useSTARTTLS: v, useTLS: v ? false : email.useTLS })}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => toast.info('Test d\'envoi simulé avec succès')}
                  className="gap-2"
                >
                  <Mail className="size-4" />
                  Envoyer un email de test
                </Button>
                <Button onClick={() => handleSave('Email')} className="gap-2">
                  <Save className="size-4" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Stockage ───────────────────────────────────────────── */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="size-5" />
                Configuration du stockage
              </CardTitle>
              <CardDescription>
                Mode de stockage des fichiers, quotas et types de fichiers autoris\u00e9s.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Mode de stockage</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setStorage({ ...storage, mode: 'local' })}
                    className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                      storage.mode === 'local'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/25'
                    }`}
                  >
                    <Server className="size-8 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Stockage local</p>
                      <p className="text-sm text-muted-foreground">Fichiers sur le syst\u00e8me de fichiers du serveur</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStorage({ ...storage, mode: 's3' })}
                    className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                      storage.mode === 's3'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/25'
                    }`}
                  >
                    <HardDrive className="size-8 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">S3 / Compatible</p>
                      <p className="text-sm text-muted-foreground">Amazon S3, MinIO, ou compatible</p>
                    </div>
                  </button>
                </div>
              </div>

              <Separator />

              {storage.mode === 'local' ? (
                <div className="space-y-2">
                  <Label htmlFor="localPath">Chemin local</Label>
                  <Input
                    id="localPath"
                    value={storage.localPath}
                    onChange={(e) => setStorage({ ...storage, localPath: e.target.value })}
                    placeholder="./data/storage"
                  />
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="s3Endpoint">Endpoint S3</Label>
                    <Input
                      id="s3Endpoint"
                      value={storage.s3Endpoint}
                      onChange={(e) => setStorage({ ...storage, s3Endpoint: e.target.value })}
                      placeholder="https://s3.amazonaws.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s3Bucket">Bucket</Label>
                    <Input
                      id="s3Bucket"
                      value={storage.s3Bucket}
                      onChange={(e) => setStorage({ ...storage, s3Bucket: e.target.value })}
                      placeholder="signapps-storage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s3Region">R\u00e9gion</Label>
                    <Input
                      id="s3Region"
                      value={storage.s3Region}
                      onChange={(e) => setStorage({ ...storage, s3Region: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s3AccessKey">Access Key</Label>
                    <PasswordInput
                      id="s3AccessKey"
                      value={storage.s3AccessKey}
                      onChange={(v) => setStorage({ ...storage, s3AccessKey: v })}
                      placeholder="AKIA..."
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="s3SecretKey">Secret Key</Label>
                    <PasswordInput
                      id="s3SecretKey"
                      value={storage.s3SecretKey}
                      onChange={(v) => setStorage({ ...storage, s3SecretKey: v })}
                      placeholder="Cl\u00e9 secr\u00e8te S3"
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maxFileSize">Taille max par fichier (Mo)</Label>
                  <Input
                    id="maxFileSize"
                    type="number"
                    min={1}
                    value={storage.maxFileSize}
                    onChange={(e) => setStorage({ ...storage, maxFileSize: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quotaPerUser">Quota par utilisateur (Mo)</Label>
                  <Input
                    id="quotaPerUser"
                    type="number"
                    min={0}
                    value={storage.quotaPerUser}
                    onChange={(e) => setStorage({ ...storage, quotaPerUser: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">0 = illimit\u00e9</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowedTypes">Types de fichiers autoris\u00e9s</Label>
                <Textarea
                  id="allowedTypes"
                  value={storage.allowedTypes}
                  onChange={(e) => setStorage({ ...storage, allowedTypes: e.target.value })}
                  placeholder="pdf,docx,xlsx,png,jpg..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">Extensions s\u00e9par\u00e9es par des virgules</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave('Stockage')} className="gap-2">
                  <Save className="size-4" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Int\u00e9grations ───────────────────────────────────────── */}
        <TabsContent value="integrations">
          <div className="space-y-6">
            {/* API Keys */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="size-5" />
                      Cl\u00e9s API
                    </CardTitle>
                    <CardDescription>
                      G\u00e9rez les cl\u00e9s d&apos;acc\u00e8s aux services externes (LLM, etc.).
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addApiKey} className="gap-2">
                    <Plus className="size-4" />
                    Ajouter
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.apiKeys.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Aucune cl\u00e9 API configur\u00e9e.
                  </p>
                )}
                {integrations.apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1 grid gap-3 sm:grid-cols-3">
                      <Input
                        value={apiKey.name}
                        onChange={(e) => updateApiKey(apiKey.id, 'name', e.target.value)}
                        placeholder="Nom du service"
                      />
                      <div className="sm:col-span-2">
                        <PasswordInput
                          value={apiKey.key}
                          onChange={(v) => updateApiKey(apiKey.id, 'key', v)}
                          placeholder="Cl\u00e9 API"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={apiKey.enabled ? 'default' : 'secondary'} className="cursor-pointer select-none">
                        {apiKey.enabled ? 'Actif' : 'Inactif'}
                      </Badge>
                      <Switch
                        checked={apiKey.enabled}
                        onCheckedChange={(v) => updateApiKey(apiKey.id, 'enabled', v)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeApiKey(apiKey.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Webhook className="size-5" />
                      Webhooks
                    </CardTitle>
                    <CardDescription>
                      Envoyez des notifications vers des services externes lors d&apos;\u00e9v\u00e9nements.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addWebhook} className="gap-2">
                    <Plus className="size-4" />
                    Ajouter
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.webhooks.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Aucun webhook configur\u00e9.
                  </p>
                )}
                {integrations.webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1 grid gap-3 sm:grid-cols-2">
                      <Input
                        value={webhook.url}
                        onChange={(e) => updateWebhook(webhook.id, 'url', e.target.value)}
                        placeholder="https://hooks.example.com/..."
                      />
                      <Input
                        value={webhook.events}
                        onChange={(e) => updateWebhook(webhook.id, 'events', e.target.value)}
                        placeholder="\u00c9v\u00e9nements (user.created, file.uploaded...)"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={webhook.enabled ? 'default' : 'secondary'} className="cursor-pointer select-none">
                        {webhook.enabled ? 'Actif' : 'Inactif'}
                      </Badge>
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={(v) => updateWebhook(webhook.id, 'enabled', v)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWebhook(webhook.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button onClick={() => handleSave('Int\u00e9grations')} className="gap-2">
                    <Save className="size-4" />
                    Sauvegarder
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
