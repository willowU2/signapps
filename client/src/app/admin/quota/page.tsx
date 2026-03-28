'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { HardDrive, RefreshCw, AlertTriangle, AlertCircle, Search, Settings2 } from 'lucide-react';
import { quotasApi, type QuotaUsage, type SetQuotaRequest } from '@/lib/api/storage';
import { getUsers, type User } from '@/lib/api-admin';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';

interface UserQuota {
  user: User;
  quota: QuotaUsage | null;
}

function fmtBytes(b: number) {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function QuotaBar({ used, limit, warn = 80, crit = 90 }: { used: number; limit?: number; warn?: number; crit?: number }) {
  if (!limit || limit === 0) return <span className="text-xs text-muted-foreground">No limit set</span>;
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= crit ? 'bg-red-500' : pct >= warn ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="space-y-1">
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{fmtBytes(used)}</span>
        <span>{pct.toFixed(0)}% of {fmtBytes(limit)}</span>
      </div>
    </div>
  );
}

// ── Edit quota dialog ──────────────────────────────────────────────────────

function EditQuotaDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: { user: User; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [storageGB, setStorageGB] = useState('');
  const [maxFiles, setMaxFiles] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const req: SetQuotaRequest = {};
      const gb = parseFloat(storageGB);
      if (!isNaN(gb) && gb > 0) req.max_storage_bytes = Math.round(gb * 1024 ** 3);
      const f = parseInt(maxFiles, 10);
      if (!isNaN(f) && f > 0) req.max_files = f;
      await quotasApi.setUserQuota(user.id, req);
      toast.success(`Quota mis à jour pour ${user.username}`);
      onSaved();
      onOpenChange(false);
    } catch { toast.error('Échec de la mise à jour du quota'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Set Quota — {user.username}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Max Storage (GB)</Label>
            <Input
              type="number"
              min="0.1"
              step="0.5"
              placeholder="e.g. 10"
              value={storageGB}
              onChange={e => setStorageGB(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave blank to keep current limit</p>
          </div>
          <div className="space-y-1.5">
            <Label>Max Files</Label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 10000"
              value={maxFiles}
              onChange={e => setMaxFiles(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function QuotaPage() {
  usePageTitle('Quotas');
  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const users = await getUsers();
      const quotas = await Promise.all(
        users.map(async (u) => {
          try {
            const res = await quotasApi.getUserQuota(u.id);
            return { user: u, quota: res.data };
          } catch {
            return { user: u, quota: null };
          }
        })
      );
      setUserQuotas(quotas);
    } catch {
      toast.error('Impossible de charger les données de quota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRecalculate = async (userId: string) => {
    try {
      await quotasApi.recalculate(userId);
      toast.success('Quota recalculé');
      fetchData();
    } catch { toast.error('Échec du recalcul'); }
  };

  const filtered = userQuotas.filter(uq =>
    uq.user.username.toLowerCase().includes(search.toLowerCase()) ||
    (uq.user.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const warnings = filtered.filter(uq => {
    const pct = uq.quota?.storage?.percentage ?? 0;
    return pct >= 80;
  });

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Storage Quota</h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {warnings.length > 0 && (
          <div className="flex flex-col gap-2">
            {warnings.map(uq => {
              const pct = uq.quota?.storage?.percentage ?? 0;
              const isCrit = pct >= 90;
              return (
                <div key={uq.user.id} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${isCrit ? 'bg-red-500/10 text-red-700' : 'bg-yellow-500/10 text-yellow-700'}`}>
                  {isCrit ? <AlertCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                  <span><strong>{uq.user.username}</strong> is at {pct.toFixed(0)}% storage usage</span>
                </div>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 w-64"
              />
              <Badge variant="secondary">{filtered.length} users</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading quota data…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No users found</div>
            ) : (
              <div className="divide-y">
                {filtered.map(({ user, quota }) => {
                  const storageUsed = quota?.storage?.used ?? 0;
                  const storageLimit = quota?.storage?.limit;
                  const storagePct = quota?.storage?.percentage ?? 0;
                  const fileUsed = quota?.files?.used ?? 0;
                  const fileLimit = quota?.files?.limit;
                  return (
                    <div key={user.id} className="px-4 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="font-medium">{user.username}</span>
                            {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
                            {storagePct >= 90 && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                            {storagePct >= 80 && storagePct < 90 && <Badge className="text-xs bg-yellow-500">Warning</Badge>}
                            {!quota && <Badge variant="outline" className="text-xs">No quota data</Badge>}
                          </div>
                          {quota ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Storage</p>
                                <QuotaBar used={storageUsed} limit={storageLimit} />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Files</p>
                                <QuotaBar used={fileUsed} limit={fileLimit} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No quota configured</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => setEditUser(user)} title="Edit quota">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRecalculate(user.id)} title="Recalculate">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editUser && (
        <EditQuotaDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(v) => !v && setEditUser(null)}
          onSaved={fetchData}
        />
      )}
    </AppLayout>
  );
}
