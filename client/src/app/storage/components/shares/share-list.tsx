'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Share2,
  Plus,
  Copy,
  MoreVertical,
  Trash2,
  Eye,
  Download,
  Lock,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import type { ShareLink } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';
import { ShareDialog } from './share-dialog';

interface ShareListProps {
  shares: ShareLink[];
  loading?: boolean;
  onCreateShare?: (data: {
    bucket: string;
    key: string;
    expires_in_hours?: number;
    password?: string;
    max_downloads?: number;
    access_type?: 'view' | 'download';
  }) => Promise<unknown>;
  onDeleteShare?: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Jamais';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ShareList({
  shares,
  loading,
  onCreateShare,
  onDeleteShare,
  onRefresh,
}: ShareListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteShareId, setDeleteShareId] = useState<string | null>(null);

  const copyLink = async (share: ShareLink) => {
    const url = `${window.location.origin}/share/${share.token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Lien copié dans le presse-papier');
  };

  const getAccessIcon = (type: string) => {
    switch (type) {
      case 'view':
        return <Eye className="h-4 w-4" />;
      case 'download':
        return <Download className="h-4 w-4" />;
      default:
        return <Share2 className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Liens de partage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Liens de partage ({shares.length})</CardTitle>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Partage
          </Button>
        </CardHeader>
        <CardContent>
          {shares.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Share2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Aucun lien de partage</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Créer un partage
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fichier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Téléchargements</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map((share) => {
                  const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
                  const isActive = share.is_active && !isExpired;

                  return (
                    <TableRow key={share.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {share.password_protected && (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium truncate max-w-[200px]">
                            {share.key.split('/').pop()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {share.bucket}/{share.key}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getAccessIcon(share.access_type)}
                          <span className="capitalize">{share.access_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {share.download_count}
                        {share.max_downloads && ` / ${share.max_downloads}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {share.expires_at ? formatDate(share.expires_at) : 'Jamais'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? 'default' : 'secondary'}>
                          {isExpired ? 'Expiré' : isActive ? 'Actif' : 'Désactivé'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyLink(share)}
                            title="Copier le lien"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/share/${share.token}`, '_blank')}
                            title="Ouvrir"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => copyLink(share)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copier le lien
                              </DropdownMenuItem>
                              {onDeleteShare && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteShareId(share.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ShareDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={async (data) => {
          if (onCreateShare) {
            await onCreateShare(data);
          }
          setCreateDialogOpen(false);
        }}
      />

      {/* Delete Share Confirmation */}
      <ConfirmDialog
        open={deleteShareId !== null}
        onOpenChange={(open) => { if (!open) setDeleteShareId(null); }}
        title="Supprimer le partage"
        description="Supprimer ce lien de partage ? Les personnes ayant le lien ne pourront plus accéder au fichier."
        onConfirm={() => {
          if (deleteShareId && onDeleteShare) onDeleteShare(deleteShareId);
          setDeleteShareId(null);
        }}
      />
    </>
  );
}
