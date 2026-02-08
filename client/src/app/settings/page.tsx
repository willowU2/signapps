'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, User, Link as LinkIcon, Check, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  provider: 'local' | 'ldap';
}

const mockUsers: UserItem[] = [
  { id: '1', username: 'admin', email: 'admin@local', role: 'Admin', mfaEnabled: true, provider: 'local' },
  { id: '2', username: 'john.doe', email: 'john@company.com', role: 'User', mfaEnabled: true, provider: 'local' },
  { id: '3', username: 'jane.smith', email: 'jane@company.com', role: 'User', mfaEnabled: false, provider: 'local' },
  { id: '4', username: 'bob.wilson', email: 'bob@ad.corp.local', role: 'User', mfaEnabled: false, provider: 'ldap' },
];

export default function SettingsPage() {
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
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
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
                    {mockUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.provider === 'ldap' ? (
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
                          <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.mfaEnabled ? (
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
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem>Reset Password</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
              <LinkIcon className="mr-1 inline h-3 w-3" />
              = LDAP/AD user
            </p>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Groups</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Group management coming soon...
                </p>
              </CardContent>
            </Card>
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
                  <Switch />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="ldapServer">Server URL</Label>
                    <Input
                      id="ldapServer"
                      placeholder="ldap://dc.corp.local:389"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ldapBindDn">Bind DN</Label>
                    <Input
                      id="ldapBindDn"
                      placeholder="CN=service,OU=Services,DC=corp,DC=local"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ldapBaseDn">Base DN</Label>
                    <Input
                      id="ldapBaseDn"
                      placeholder="DC=corp,DC=local"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline">Test Connection</Button>
                  <Button>Save Configuration</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
