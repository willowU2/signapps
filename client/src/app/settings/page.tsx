'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, User, Link as LinkIcon, Check, MoreVertical, Loader2, Users, Pencil, Trash2, Webhook, Play, Pause, TestTube2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usersApi, authApi, groupsApi, User as UserType, LdapConfig, Group } from '@/lib/api';
import { api } from '@/lib/api';

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
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';

const roleLabels: Record<number, string> = {
  0: 'Admin',
  1: 'User',
  2: 'Viewer',
};

export default function SettingsPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // LDAP config state
  const [ldapConfig, setLdapConfig] = useState<LdapConfig>({
    enabled: false,
    server_url: '',
    bind_dn: '',
    base_dn: '',
  });
  const [ldapSaving, setLdapSaving] = useState(false);
  const [ldapTesting, setLdapTesting] = useState(false);

  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{ open: boolean; group: Group | null }>({
    open: false,
    group: null,
  });

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [deleteWebhookDialog, setDeleteWebhookDialog] = useState<{ open: boolean; webhook: WebhookConfig | null }>({
    open: false,
    webhook: null,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const response = await usersApi.list();
      setUsers(response.data?.users || response.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLdapConfig = useCallback(async () => {
    try {
      const response = await authApi.ldapGetConfig();
      if (response.data) {
        setLdapConfig(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch LDAP config:', error);
      // Config might not exist yet, use defaults
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const response = await groupsApi.list();
      setGroups(response.data || []);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
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
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
      setWebhooks([]);
    } finally {
      setWebhooksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchLdapConfig();
    fetchGroups();
    fetchWebhooks();
  }, [fetchUsers, fetchLdapConfig, fetchGroups, fetchWebhooks]);

  const handleLdapSave = async () => {
    setLdapSaving(true);
    try {
      await authApi.ldapUpdateConfig(ldapConfig);
      toast.success('LDAP configuration saved');
    } catch (error) {
      console.error('Failed to save LDAP config:', error);
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
    } catch (error) {
      console.error('LDAP test failed:', error);
      toast.error('Failed to test LDAP connection');
    } finally {
      setLdapTesting(false);
    }
  };

  const handleOpenGroupDialog = (group?: Group) => {
    if (group) {
      setEditingGroup(group);
      setGroupName(group.name);
      setGroupDescription(group.description || '');
    } else {
      setEditingGroup(null);
      setGroupName('');
      setGroupDescription('');
    }
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) return;

    setGroupSaving(true);
    try {
      if (editingGroup) {
        await groupsApi.update(editingGroup.id, {
          name: groupName,
          description: groupDescription || undefined,
        });
        toast.success('Group updated successfully');
      } else {
        await groupsApi.create({
          name: groupName,
          description: groupDescription || undefined,
        });
        toast.success('Group created successfully');
      }
      setGroupDialogOpen(false);
      fetchGroups();
    } catch (error) {
      console.error('Failed to save group:', error);
      toast.error('Failed to save group');
    } finally {
      setGroupSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupDialog.group) return;

    try {
      await groupsApi.delete(deleteGroupDialog.group.id);
      toast.success('Group deleted successfully');
      setDeleteGroupDialog({ open: false, group: null });
      fetchGroups();
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Failed to delete group');
    }
  };

  // Webhook handlers
  const handleOpenWebhookDialog = (webhook?: WebhookConfig) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setWebhookName(webhook.name);
      setWebhookUrl(webhook.url);
      setWebhookSecret(webhook.secret || '');
      setWebhookEvents(webhook.events);
    } else {
      setEditingWebhook(null);
      setWebhookName('');
      setWebhookUrl('');
      setWebhookSecret('');
      setWebhookEvents([]);
    }
    setWebhookDialogOpen(true);
  };

  const handleSaveWebhook = async () => {
    if (!webhookName.trim() || !webhookUrl.trim() || webhookEvents.length === 0) {
      toast.error('Name, URL and at least one event are required');
      return;
    }

    setWebhookSaving(true);
    try {
      const data = {
        name: webhookName,
        url: webhookUrl,
        secret: webhookSecret || undefined,
        events: webhookEvents,
      };

      if (editingWebhook) {
        await api.put(`/webhooks/${editingWebhook.id}`, data);
        toast.success('Webhook updated successfully');
      } else {
        await api.post('/webhooks', data);
        toast.success('Webhook created successfully');
      }
      setWebhookDialogOpen(false);
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to save webhook:', error);
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
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
      toast.error('Failed to update webhook');
    }
  };

  const handleTestWebhook = async (webhook: WebhookConfig) => {
    try {
      await api.post(`/webhooks/${webhook.id}/test`);
      toast.success('Test webhook sent');
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to test webhook:', error);
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
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const toggleWebhookEvent = (event: string) => {
    if (webhookEvents.includes(event)) {
      setWebhookEvents(webhookEvents.filter((e) => e !== event));
    } else {
      setWebhookEvents([...webhookEvents, event]);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="ldap">LDAP</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input id="siteName" defaultValue="SignApps" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Disable access for non-admin users
                    </p>
                  </div>
                  <Switch />
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Users</h2>
                <p className="text-sm text-muted-foreground">
                  Manage user accounts and permissions
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/users">
                  <Button variant="outline">
                    Manage Users
                  </Button>
                </Link>
                <Link href="/users">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </Link>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>2FA</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {user.auth_provider === 'ldap' ? (
                                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <User className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">{user.username}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 0 ? 'default' : 'secondary'}>
                              {roleLabels[user.role] || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.mfa_enabled ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <Link href="/users">
                                  <DropdownMenuItem>Edit</DropdownMenuItem>
                                </Link>
                                <DropdownMenuItem onClick={() => toast.info('Go to Users page for password reset')}>
                                  Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => toast.info('Go to Users page for user deletion')}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {users.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
              <LinkIcon className="mr-1 inline h-3 w-3" />
              = LDAP/AD user
            </p>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Groups</h2>
                <p className="text-sm text-muted-foreground">
                  Manage user groups and permissions
                </p>
              </div>
              <Button onClick={() => handleOpenGroupDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {groupsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{group.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {group.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {group.ldap_dn ? (
                              <Badge variant="outline">
                                <LinkIcon className="mr-1 h-3 w-3" />
                                LDAP
                              </Badge>
                            ) : (
                              <Badge variant="outline">Local</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenGroupDialog(group)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info('Member management coming soon')}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Manage Members
                                </DropdownMenuItem>
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
                          </TableCell>
                        </TableRow>
                      ))}
                      {groups.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No groups found. Create your first group to get started.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
                    {ldapTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Test Connection
                  </Button>
                  <Button onClick={handleLdapSave} disabled={ldapSaving}>
                    {ldapSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <Button onClick={() => handleOpenWebhookDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Create Webhook
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {webhooksLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>Last Triggered</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooks.map((webhook) => (
                        <TableRow key={webhook.id}>
                          <TableCell>
                            {webhook.enabled ? (
                              <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Webhook className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{webhook.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground max-w-[200px] truncate">
                            {webhook.url}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {webhook.last_triggered
                              ? new Date(webhook.last_triggered).toLocaleString('fr-FR')
                              : 'Never'}
                            {webhook.last_status && (
                              <Badge
                                variant="outline"
                                className={`ml-2 ${
                                  webhook.last_status >= 200 && webhook.last_status < 300
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {webhook.last_status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenWebhookDialog(webhook)}>
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
                          </TableCell>
                        </TableRow>
                      ))}
                      {webhooks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No webhooks configured. Create one to receive notifications.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
        </Tabs>
      </div>

      {/* Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Group' : 'Create Group'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g., Developers"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description</Label>
              <Textarea
                id="groupDescription"
                placeholder="Optional description for this group"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} disabled={groupSaving || !groupName.trim()}>
              {groupSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Webhook Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhookName">Name</Label>
              <Input
                id="webhookName"
                placeholder="e.g., Slack Notification"
                value={webhookName}
                onChange={(e) => setWebhookName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">URL</Label>
              <Input
                id="webhookUrl"
                placeholder="https://example.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Secret (optional)</Label>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="HMAC signing secret"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to sign requests with HMAC-SHA256
              </p>
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Switch
                      id={`event-${event}`}
                      checked={webhookEvents.includes(event)}
                      onCheckedChange={() => toggleWebhookEvent(event)}
                    />
                    <Label htmlFor={`event-${event}`} className="text-sm font-normal cursor-pointer">
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {webhookEvents.length} event{webhookEvents.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveWebhook}
              disabled={webhookSaving || !webhookName.trim() || !webhookUrl.trim() || webhookEvents.length === 0}
            >
              {webhookSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingWebhook ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
