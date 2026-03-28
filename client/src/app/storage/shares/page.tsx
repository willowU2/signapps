'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Share2, Link, Copy, MoreVertical, Trash2, Edit, Eye, Download, FileEdit, Lock, Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { sharesApi, ShareLink, UpdateShareRequest } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';

export default function SharesPage() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<ShareLink | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteShareId, setDeleteShareId] = useState<string | null>(null);

  // Edit form state
  const [editExpiresHours, setEditExpiresHours] = useState<string>('');
  const [editPassword, setEditPassword] = useState('');
  const [editMaxDownloads, setEditMaxDownloads] = useState<string>('');
  const [editAccessType, setEditAccessType] = useState<'view' | 'download' | 'edit'>('download');
  const [editIsActive, setEditIsActive] = useState(true);

  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const response = await sharesApi.list();
      setShares(response.data.shares);
    } catch {
      toast.error('Impossible de charger les partages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const openEditDialog = (share: ShareLink) => {
    setSelectedShare(share);
    setEditExpiresHours('');
    setEditPassword('');
    setEditMaxDownloads(share.max_downloads?.toString() || '');
    setEditAccessType(share.access_type);
    setEditIsActive(share.is_active);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedShare) return;

    setSaving(true);
    try {
      const updates: UpdateShareRequest = {
        access_type: editAccessType,
        is_active: editIsActive,
      };

      if (editExpiresHours) {
        updates.expires_in_hours = parseInt(editExpiresHours);
      }
      if (editPassword) {
        updates.password = editPassword;
      }
      if (editMaxDownloads) {
        updates.max_downloads = parseInt(editMaxDownloads);
      }

      await sharesApi.update(selectedShare.id, updates);
      toast.success('Partage mis à jour');
      setEditDialogOpen(false);
      fetchShares();
    } catch {
      toast.error('Impossible de mettre à jour le partage');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await sharesApi.delete(id);
      toast.success('Lien de partage révoqué');
      fetchShares();
    } catch {
      toast.error('Impossible de révoquer le partage');
    }
  };

  const copyLink = (share: ShareLink) => {
    const url = `${window.location.origin}/share/${share.token}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié dans le presse-papiers');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (share: ShareLink) => {
    if (!share.expires_at) return false;
    return new Date(share.expires_at) < new Date();
  };

  const getAccessIcon = (type: string) => {
    switch (type) {
      case 'view':
        return <Eye className="h-4 w-4" />;
      case 'download':
        return <Download className="h-4 w-4" />;
      case 'edit':
        return <FileEdit className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Shared Links</h1>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Share2 className="h-8 w-8" />
            Shared Links
          </h1>
          <Badge variant="secondary">
            {shares.filter((s) => s.is_active && !isExpired(s)).length} active
          </Badge>
        </div>

        {/* Shares List */}
        <div className="space-y-4">
          {shares.map((share) => {
            const expired = isExpired(share);
            const active = share.is_active && !expired;

            return (
              <Card key={share.id} className={!active ? 'opacity-60' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <Link className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{share.key.split('/').pop()}</span>
                          {share.password_protected && (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{share.bucket}/{share.key}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Status badges */}
                      <div className="flex items-center gap-2">
                        <Badge variant={active ? 'default' : 'secondary'}>
                          {active ? (
                            <CheckCircle className="mr-1 h-3 w-3" />
                          ) : (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}
                          {expired ? 'Expired' : share.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getAccessIcon(share.access_type)}
                          {share.access_type}
                        </Badge>
                      </div>

                      {/* Stats */}
                      <div className="text-sm text-muted-foreground text-right min-w-[100px]">
                        <div className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {share.download_count}
                          {share.max_downloads && ` / ${share.max_downloads}`}
                        </div>
                        {share.expires_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(share.expires_at)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyLink(share)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(`/share/${share.token}`, '_blank')}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(share)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteShareId(share.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Revoke Link
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {shares.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No shared links yet</p>
                <p className="text-sm">Share files from the Storage page</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Revoke Share Confirmation */}
        <ConfirmDialog
          open={deleteShareId !== null}
          onOpenChange={(open) => { if (!open) setDeleteShareId(null); }}
          title="Revoke Share Link"
          description="Are you sure you want to revoke this share link? Anyone with the link will no longer be able to access the file."
          onConfirm={() => {
            if (deleteShareId) handleDelete(deleteShareId);
            setDeleteShareId(null);
          }}
        />

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Share Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Access Type</Label>
                <Select value={editAccessType} onValueChange={(v) => setEditAccessType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Lecture seule</SelectItem>
                    <SelectItem value="download">Téléchargement</SelectItem>
                    <SelectItem value="edit">Modifier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Extend Expiration (hours)</Label>
                <Input
                  type="number"
                  placeholder="Leave empty to keep current"
                  value={editExpiresHours}
                  onChange={(e) => setEditExpiresHours(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Change Password</Label>
                <Input
                  type="password"
                  placeholder="Leave empty to keep current"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Downloads</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={editMaxDownloads}
                  onChange={(e) => setEditMaxDownloads(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">Active</Label>
                <Switch
                  id="edit-active"
                  checked={editIsActive}
                  onCheckedChange={setEditIsActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
