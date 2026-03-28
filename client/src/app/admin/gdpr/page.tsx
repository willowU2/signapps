'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Download,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  FileText,
  UserX,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface RetentionPolicy {
  id: string;
  data_type: string;
  max_age_days: number;
  action: 'archive' | 'delete' | 'anonymize';
  description?: string;
}

interface DeletionRequest {
  id: string;
  user_id: string;
  user_email: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_at: string;
  completed_at?: string;
  reason?: string;
}

interface ConsentRecord {
  id: string;
  user_id: string;
  user_email: string;
  purpose: string;
  granted: boolean;
  granted_at: string;
  revoked_at?: string;
}

interface DataExportRequest {
  id: string;
  user_id: string;
  user_email: string;
  status: 'pending' | 'processing' | 'ready' | 'expired';
  requested_at: string;
  download_url?: string;
}

// --------------------------------------------------------------------------
// Default retention policies (shown if API is unavailable)
// --------------------------------------------------------------------------

const DEFAULT_POLICIES: RetentionPolicy[] = [
  { id: '1', data_type: 'trash', max_age_days: 30, action: 'delete', description: 'Supprimé files in trash' },
  { id: '2', data_type: 'logs', max_age_days: 90, action: 'delete', description: 'Application logs' },
  { id: '3', data_type: 'sessions', max_age_days: 7, action: 'delete', description: 'User sessions' },
  { id: '4', data_type: 'mails', max_age_days: 730, action: 'archive', description: 'Email messages' },
  { id: '5', data_type: 'audit_trail', max_age_days: 365, action: 'archive', description: 'Audit log entries' },
  { id: '6', data_type: 'backups', max_age_days: 90, action: 'delete', description: 'Database backups' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700',
  processing: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
  ready: 'bg-green-500/10 text-green-600',
  rejected: 'bg-red-500/10 text-red-600',
  expired: 'bg-gray-500/10 text-gray-600',
};

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export default function GdprDashboardPage() {
  usePageTitle('RGPD');
  const [policies, setPolicies] = useState<RetentionPolicy[]>(DEFAULT_POLICIES);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [exportRequests, setExportRequests] = useState<DataExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [polRes, delRes, conRes, expRes] = await Promise.allSettled([
        api.get<RetentionPolicy[]>('/gdpr/policies'),
        api.get<DeletionRequest[]>('/gdpr/deletion-requests'),
        api.get<ConsentRecord[]>('/gdpr/consents'),
        api.get<DataExportRequest[]>('/gdpr/export-requests'),
      ]);

      if (polRes.status === 'fulfilled' && polRes.value.data) {
        setPolicies(polRes.value.data);
      }
      if (delRes.status === 'fulfilled') {
        setDeletionRequests(delRes.value.data || []);
      }
      if (conRes.status === 'fulfilled') {
        setConsents(conRes.value.data || []);
      }
      if (expRes.status === 'fulfilled') {
        setExportRequests(expRes.value.data || []);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApproveDelete = async (req: DeletionRequest) => {
    try {
      await api.post(`/gdpr/deletion-requests/${req.id}/approve`);
      toast.success('Demande de suppression approuvée');
      fetchData();
    } catch {
      toast.error('Échec de l\'approbation de la demande');
    }
  };

  const handleRejectDelete = async (req: DeletionRequest) => {
    try {
      await api.post(`/gdpr/deletion-requests/${req.id}/reject`);
      toast.success('Demande de suppression rejetée');
      fetchData();
    } catch {
      toast.error('Échec du rejet de la demande');
    }
  };

  // Summary stats
  const pendingDeletions = deletionRequests.filter((r) => r.status === 'pending').length;
  const pendingExports = exportRequests.filter((r) => r.status === 'pending').length;
  const activeConsents = consents.filter((c) => c.granted && !c.revoked_at).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">GDPR Compliance</h1>
              <p className="text-sm text-muted-foreground">
                Data retention, right to delete, consent tracking, and data exports
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retention Policies</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{policies.length}</div>
              <p className="text-xs text-muted-foreground">active policies</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Deletions</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingDeletions}</div>
              <p className="text-xs text-muted-foreground">awaiting review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeConsents}</div>
              <p className="text-xs text-muted-foreground">granted consents</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Exports</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingExports}</div>
              <p className="text-xs text-muted-foreground">export requests</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="retention">
          <TabsList>
            <TabsTrigger value="retention">Retention Policies</TabsTrigger>
            <TabsTrigger value="deletions">
              Right to Delete
              {pendingDeletions > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
                  {pendingDeletions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="consents">Consent Tracking</TabsTrigger>
            <TabsTrigger value="exports">Data Exports</TabsTrigger>
          </TabsList>

          {/* Retention Policies */}
          <TabsContent value="retention" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Retention Policies</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Max Age</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.data_type}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.description || '-'}
                        </TableCell>
                        <TableCell>{p.max_age_days} days</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              p.action === 'delete'
                                ? 'text-red-600'
                                : p.action === 'archive'
                                  ? 'text-blue-600'
                                  : 'text-yellow-600'
                            }
                          >
                            {p.action}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Right to Delete */}
          <TabsContent value="deletions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deletion Requests (Right to be Forgotten)</CardTitle>
              </CardHeader>
              <CardContent>
                {deletionRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No deletion requests
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletionRequests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.user_email}</TableCell>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}`}
                            >
                              {r.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(r.requested_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {r.completed_at
                              ? new Date(r.completed_at).toLocaleDateString('fr-FR')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {r.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveDelete(r)}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  onClick={() => handleRejectDelete(r)}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consent Tracking */}
          <TabsContent value="consents" className="space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user email or purpose..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consent Records</CardTitle>
              </CardHeader>
              <CardContent>
                {consents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No consent records
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Granted</TableHead>
                        <TableHead>Revoked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consents
                        .filter((c) => {
                          if (!search.trim()) return true;
                          const q = search.toLowerCase();
                          return (
                            c.user_email?.toLowerCase().includes(q) ||
                            c.purpose?.toLowerCase().includes(q)
                          );
                        })
                        .map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.user_email}</TableCell>
                            <TableCell>{c.purpose}</TableCell>
                            <TableCell>
                              {c.granted && !c.revoked_at ? (
                                <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Revoked</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(c.granted_at).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {c.revoked_at
                                ? new Date(c.revoked_at).toLocaleDateString('fr-FR')
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Exports */}
          <TabsContent value="exports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Export Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {exportRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No export requests
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exportRequests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.user_email}</TableCell>
                          <TableCell>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ''}`}
                            >
                              {r.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(r.requested_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            {r.status === 'ready' && r.download_url && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={r.download_url} download>
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
