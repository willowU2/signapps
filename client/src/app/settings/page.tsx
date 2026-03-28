'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmailSignatureEditor } from '@/components/email-signature-editor';
import { DataTableSkeleton } from '@/components/ui/skeleton-loader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Link as LinkIcon, MoreVertical, Users, Pencil, Trash2, Webhook, Play, Pause, TestTube2, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authApi, groupsApi, LdapConfig, Group } from '@/lib/api';
import { api } from '@/lib/api';
import { tenantApi, tenantsApi, Tenant } from '@/lib/api/tenant';
import { DataTable } from '@/components/ui/data-table';
import { GroupSheet } from '@/components/settings/group-sheet';
import { WebhookSheet } from '@/components/settings/webhook-sheet';
import { ColumnDef } from '@tanstack/react-table';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  last_triggered?: string;
  last_status?: number;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  'user.login',
  'user.logout',
  'user.created',
  'user.deleted',
  'container.created',
  'container.started',
  'container.stopped',
  'container.deleted',
  'storage.upload',
  'storage.delete',
  'route.created',
  'route.updated',
  'route.deleted',
];
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { AiRoutingSettings } from '@/components/settings/ai-routing-settings';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { DyslexiaFontToggle } from '@/components/accessibility/dyslexia-font';
import { TextToSpeech } from '@/components/accessibility/text-to-speech';
import { ScreenMagnifier } from '@/components/accessibility/screen-magnifier';
import { FocusOrderValidator } from '@/components/accessibility/focus-order-validator';
import { VoiceNavigation } from '@/components/accessibility/voice-navigation';
import { CustomCssEditor } from '@/components/settings/CustomCssEditor';
import { BrandColorSettings } from '@/components/settings/BrandColorSettings';
import { ThemePresetsLibrary } from '@/components/settings/ThemePresetsLibrary';
import { ModuleDarkModeSettings } from '@/components/settings/ModuleDarkMode';
import { InstanceBranding } from '@/components/settings/InstanceBranding';
import { DensityModeToggle } from '@/components/settings/DensityModeToggle';
import { LanguageSwitcher, SUPPORTED_LANGUAGES } from '@/components/i18n/language-switcher';
import { Card as _Card, CardContent as _CardContent, CardHeader as _CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';

function LanguageSettingsTab() {
  return (
    <div className="space-y-4">
      <_Card>
        <_CardHeader>
          <_CardTitle>Interface Language</_CardTitle>
        </_CardHeader>
        <_CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Select your preferred display language. RTL languages (Arabic, Hebrew) automatically flip the layout direction.</p>
          <LanguageSwitcher />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
            {SUPPORTED_LANGUAGES.map(l => (
              <div key={l.code} className="flex items-center gap-2 border rounded p-2 text-sm">
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {l.dir === 'rtl' && <span className="text-xs text-orange-500 ml-auto">RTL</span>}
              </div>
            ))}
          </div>
        </_CardContent>
      </_Card>
    </div>
  );
}

export default function SettingsPage() {
  // Support ?tab= query param for deep-linking (e.g. from /settings/webhooks redirect)
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'users';

  // General tab state
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [siteName, setSiteName] = useState('SignApps');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [generalSaving, setGeneralSaving] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // LDAP config state
  const [ldapConfig, setLdapConfig] = useState<LdapConfig>({
    enabled: false,
    url: '',
    server_url: '',
    bind_dn: '',
    bind_password: '',
    base_dn: '',
    user_filter: '',
    group_filter: '',
    email_attribute: '',
    display_name_attribute: '',
    sync_interval_seconds: 3600,
  });
  const [ldapSaving, setLdapSaving] = useState(false);
  const [ldapTesting, setLdapTesting] = useState(false);

  // Group sheet state
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{ open: boolean; group: Group | null }>({
    open: false,
    group: null,
  });

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [webhookSheetOpen, setWebhookSheetOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [deleteWebhookDialog, setDeleteWebhookDialog] = useState<{ open: boolean; webhook: WebhookConfig | null }>({
    open: false,
    webhook: null,
  });

  const fetchTenant = useCallback(async () => {
    try {
      const response = await tenantApi.get();
      if (response.data) {
        setTenant(response.data);
        setSiteName(response.data.name);
        setMaintenanceMode(!response.data.is_active);
      }
    } catch {
      // Tenant might not exist yet
    }
  }, []);

  const fetchLdapConfig = useCallback(async () => {
    try {
      const response = await authApi.ldapGetConfig();
      if (response.data) {
        setLdapConfig(response.data);
      }
    } catch {
      // Config might not exist yet, use defaults
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const response = await groupsApi.list();
      setGroups(response.data || []);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    try {
      const response = await api.get<WebhookConfig[]>('/webhooks');
      setWebhooks(response.data || []);
    } catch {
      setWebhooks([]);
    } finally {
      setWebhooksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenant();
    fetchLdapConfig();
    fetchGroups();
    fetchWebhooks();
  }, [fetchTenant, fetchLdapConfig, fetchGroups, fetchWebhooks]);

  const handleLdapSave = async () => {
    setLdapSaving(true);
    try {
      await authApi.ldapUpdateConfig(ldapConfig);
      toast.success('LDAP configuration saved');
    } catch {
      toast.error('Failed to save LDAP configuration');
    } finally {
      setLdapSaving(false);
    }
  };

  const handleLdapTest = async () => {
    setLdapTesting(true);
    try {
      const response = await authApi.ldapTestConnection();
      if (response.data.success) {
        toast.success('LDAP connection successful');
      } else {
        toast.error(response.data.message || 'LDAP connection failed');
      }
    } catch {
      toast.error('Failed to test LDAP connection');
    } finally {
      setLdapTesting(false);
    }
  };

  const handleGeneralSave = async () => {
    if (!tenant) {
      toast.error('Tenant not loaded');
      return;
    }
    setGeneralSaving(true);
    try {
      const response = await tenantsApi.update(tenant.id, {
        name: siteName,
        is_active: !maintenanceMode,
      });
      setTenant(response.data);
      toast.success('General settings saved successfully');
    } catch {
      toast.error('Failed to save general settings');
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleOpenGroupSheet = (group?: Group) => {
    setEditingGroup(group || null);
    setGroupSheetOpen(true);
  };

  const handleSaveGroup = async (data: any) => {
    setGroupSaving(true);
    try {
      if (editingGroup) {
        await groupsApi.update(editingGroup.id, data);
        toast.success('Group updated successfully');
      } else {
        await groupsApi.create(data);
        toast.success('Group created successfully');
      }
      setGroupSheetOpen(false);
      fetchGroups();
    } catch {
      toast.error('Failed to save group');
    } finally {
      setGroupSaving(false);
    }
  };

  const groupColumns: ColumnDef<Group>[] = [
    {
      accessorKey: "name",
      header: "Group",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || '-'}</span>,
    },
    {
      accessorKey: "member_count",
      header: "Members",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.member_count} member{row.original.member_count !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        row.original.ldap_dn ? (
          <Badge variant="outline">
            <LinkIcon className="mr-1 h-3 w-3" />
            LDAP
          </Badge>
        ) : (
          <Badge variant="outline">Local</Badge>
        )
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const group = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenGroupSheet(group)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
{/* Member management retiré - feature non implémentée (NO DEAD ENDS) */}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteGroupDialog({ open: true, group })}
                disabled={!!group.ldap_dn}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const handleDeleteGroup = async () => {
    if (!deleteGroupDialog.group) return;

    try {
      await groupsApi.delete(deleteGroupDialog.group.id);
      toast.success('Group deleted successfully');
      setDeleteGroupDialog({ open: false, group: null });
      fetchGroups();
    } catch {
      toast.error('Failed to delete group');
    }
  };

  // Webhook handlers
  const handleOpenWebhookSheet = (webhook?: WebhookConfig) => {
    setEditingWebhook(webhook || null);
    setWebhookSheetOpen(true);
  };

  const handleSaveWebhook = async (data: Omit<WebhookConfig, "id" | "enabled" | "last_triggered" | "last_status" | "created_at">) => {
    setWebhookSaving(true);
    try {
      if (editingWebhook) {
        await api.put(`/webhooks/${editingWebhook.id}`, data);
        toast.success('Webhook updated successfully');
      } else {
        await api.post('/webhooks', data);
        toast.success('Webhook created successfully');
      }
      setWebhookSheetOpen(false);
      fetchWebhooks();
    } catch {
      toast.error('Failed to save webhook');
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleToggleWebhook = async (webhook: WebhookConfig) => {
    try {
      await api.put(`/webhooks/${webhook.id}`, { enabled: !webhook.enabled });
      toast.success(`Webhook ${webhook.enabled ? 'disabled' : 'enabled'}`);
      fetchWebhooks();
    } catch {
      toast.error('Failed to update webhook');
    }
  };

  const handleTestWebhook = async (webhook: WebhookConfig) => {
    try {
      await api.post(`/webhooks/${webhook.id}/test`);
      toast.success('Test webhook sent');
      fetchWebhooks();
    } catch {
      toast.error('Failed to send test webhook');
    }
  };

  const handleDeleteWebhook = async () => {
    if (!deleteWebhookDialog.webhook) return;

    try {
      await api.delete(`/webhooks/${deleteWebhookDialog.webhook.id}`);
      toast.success('Webhook deleted successfully');
      setDeleteWebhookDialog({ open: false, webhook: null });
      fetchWebhooks();
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const webhookColumns: ColumnDef<WebhookConfig>[] = [
    {
      accessorKey: "enabled",
      header: "Status",
      cell: ({ row }) => (
        row.original.enabled ? (
          <Badge className="bg-green-500/10 text-green-600">Active</Badge>
        ) : (
          <Badge variant="secondary">Disabled</Badge>
        )
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "url",
      header: "URL",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground block max-w-[200px] truncate">
          {row.original.url}
        </span>
      ),
    },
    {
      accessorKey: "events",
      header: "Events",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.events.length} event{row.original.events.length !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      accessorKey: "last_triggered",
      header: "Last Triggered",
      cell: ({ row }) => {
        const webhook = row.original;
        return (
          <span className="text-muted-foreground whitespace-nowrap">
            {webhook.last_triggered
              ? new Date(webhook.last_triggered).toLocaleString('fr-FR')
              : 'Never'}
            {webhook.last_status && (
              <Badge
                variant="outline"
                className={`ml-2 ${webhook.last_status >= 200 && webhook.last_status < 300
                    ? 'text-green-600'
                    : 'text-red-600'
                  }`}
              >
                {webhook.last_status}
              </Badge>
            )}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const webhook = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenWebhookSheet(webhook)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTestWebhook(webhook)}>
                <TestTube2 className="mr-2 h-4 w-4" />
                Test
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleWebhook(webhook)}>
                {webhook.enabled ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Disable
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Enable
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteWebhookDialog({ open: true, webhook })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="language">Language</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="ldap">LDAP</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="ai-routing">AI Routing</TabsTrigger>
            <TabsTrigger value="email-signature">Signature</TabsTrigger>
            <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="language" className="space-y-6">
            <LanguageSettingsTab />
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <AppearanceSettings />
            <InstanceBranding />
            <ThemePresetsLibrary />
            <BrandColorSettings />
            <DensityModeToggle />
            <ModuleDarkModeSettings />
            <CustomCssEditor />
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Disable access for non-admin users
                    </p>
                  </div>
                  <Switch
                    checked={maintenanceMode}
                    onCheckedChange={setMaintenanceMode}
                  />
                </div>
                <Button onClick={handleGeneralSave} disabled={generalSaving}>
                  {generalSaving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">User Management</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Manage user accounts, roles, and permissions from the dedicated Users page.
                </p>
                <Link href="/users">
                  <Button>
                    Go to Users
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Groups</h2>
                <p className="text-sm text-muted-foreground">
                  Manage user groups and permissions
                </p>
              </div>
              <Button onClick={() => handleOpenGroupSheet()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {groupsLoading ? (
                  <DataTableSkeleton count={3} />
                ) : (
                  <DataTable
                    columns={groupColumns}
                    data={groups}
                    searchKey="name"
                  />
                )}
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
              <LinkIcon className="mr-1 inline h-3 w-3" />
              = Synced from LDAP/Active Directory
            </p>
          </TabsContent>

          <TabsContent value="ldap" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>LDAP / Active Directory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable LDAP Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow users to login with AD credentials
                    </p>
                  </div>
                  <Switch
                    checked={ldapConfig.enabled}
                    onCheckedChange={(checked) =>
                      setLdapConfig({ ...ldapConfig, enabled: checked })
                    }
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="ldapServer">Server URL</Label>
                    <Input
                      id="ldapServer"
                      placeholder="ldap://dc.corp.local:389"
                      value={ldapConfig.server_url}
                      onChange={(e) =>
                        setLdapConfig({ ...ldapConfig, server_url: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ldapBindDn">Bind DN</Label>
                    <Input
                      id="ldapBindDn"
                      placeholder="CN=service,OU=Services,DC=corp,DC=local"
                      value={ldapConfig.bind_dn}
                      onChange={(e) =>
                        setLdapConfig({ ...ldapConfig, bind_dn: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ldapBindPassword">Bind Password</Label>
                    <Input
                      id="ldapBindPassword"
                      type="password"
                      placeholder="Service account password"
                      value={ldapConfig.bind_password || ''}
                      onChange={(e) =>
                        setLdapConfig({ ...ldapConfig, bind_password: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ldapBaseDn">Base DN</Label>
                    <Input
                      id="ldapBaseDn"
                      placeholder="DC=corp,DC=local"
                      value={ldapConfig.base_dn}
                      onChange={(e) =>
                        setLdapConfig({ ...ldapConfig, base_dn: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleLdapTest}
                    disabled={ldapTesting || !ldapConfig.server_url}
                  >
                    {ldapTesting && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                    Test Connection
                  </Button>
                  <Button onClick={handleLdapSave} disabled={ldapSaving}>
                    {ldapSaving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Webhooks</h2>
                <p className="text-sm text-muted-foreground">
                  Configure HTTP callbacks for system events
                </p>
              </div>
              <Button onClick={() => handleOpenWebhookSheet()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Webhook
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {webhooksLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                ) : (
                  <DataTable
                    columns={webhookColumns}
                    data={webhooks}
                    searchKey="name"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">About Webhooks</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Webhooks allow external services to receive real-time notifications when events occur in SignApps.
                </p>
                <p>
                  Each webhook can subscribe to multiple events. When an event occurs, SignApps will send a POST request to your URL with event details.
                </p>
                <p>
                  If you provide a secret, requests will include an HMAC-SHA256 signature in the <code className="bg-muted px-1 rounded">X-Signature</code> header.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-routing" className="space-y-6">
            <AiRoutingSettings />
          </TabsContent>

          <TabsContent value="email-signature" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Signature email</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailSignatureEditor />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accessibility" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Accessibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Typography</p>
                  <DyslexiaFontToggle />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Screen Magnifier</p>
                  <ScreenMagnifier />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Text-to-Speech</p>
                  <TextToSpeech />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Voice Navigation</p>
                  <VoiceNavigation />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Focus Order Validator</p>
                  <FocusOrderValidator />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <GroupSheet
        open={groupSheetOpen}
        onOpenChange={setGroupSheetOpen}
        group={editingGroup}
        onSubmit={handleSaveGroup}
        isLoading={groupSaving}
      />

      {/* Delete Group Confirmation */}
      <AlertDialog
        open={deleteGroupDialog.open}
        onOpenChange={(open) => setDeleteGroupDialog({ open, group: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the group "{deleteGroupDialog.group?.name}"?
              This will remove all member associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Webhook Sheet */}
      <WebhookSheet
        open={webhookSheetOpen}
        onOpenChange={setWebhookSheetOpen}
        webhook={editingWebhook}
        onSubmit={handleSaveWebhook}
        isLoading={webhookSaving}
      />

      {/* Delete Webhook Confirmation */}
      <AlertDialog
        open={deleteWebhookDialog.open}
        onOpenChange={(open) => setDeleteWebhookDialog({ open, webhook: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the webhook "{deleteWebhookDialog.webhook?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWebhook}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
