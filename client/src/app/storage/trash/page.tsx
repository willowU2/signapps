'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Trash2,
  RotateCcw,
  Search,
  File,
  FileText,
  FileImage,
  FileArchive,
  Loader2,
  Folder,
  Clock,
  HardDrive,
  AlertTriangle,
} from 'lucide-react';
import { trashApi, TrashItem, TrashStats } from '@/lib/api';
import { toast } from 'sonner';

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [stats, setStats] = useState<TrashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsResponse, statsResponse] = await Promise.all([
        trashApi.list(undefined, search || undefined),
        trashApi.stats(),
      ]);
      setItems(itemsResponse.data.items);
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Failed to fetch trash:', error);
      toast.error('Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const handleRestore = async () => {
    if (selectedItems.size === 0) return;

    setRestoring(true);
    try {
      const response = await trashApi.restore(Array.from(selectedItems));
      const { restored, failed } = response.data;

      if (restored.length > 0) {
        toast.success(`Restored ${restored.length} item(s)`);
      }
      if (failed.length > 0) {
        toast.error(`Failed to restore ${failed.length} item(s)`);
      }

      setSelectedItems(new Set());
      fetchTrash();
    } catch (error) {
      console.error('Restore failed:', error);
      toast.error('Failed to restore items');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeletePermanently = async () => {
    if (selectedItems.size === 0) return;

    setDeleting(true);
    try {
      await trashApi.empty(Array.from(selectedItems));
      toast.success(`Permanently deleted ${selectedItems.size} item(s)`);
      setSelectedItems(new Set());
      fetchTrash();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete items');
    } finally {
      setDeleting(false);
    }
  };

  const handleEmptyTrash = async () => {
    setDeleting(true);
    try {
      await trashApi.empty();
      toast.success('Trash emptied');
      setEmptyDialogOpen(false);
      fetchTrash();
    } catch (error) {
      console.error('Empty trash failed:', error);
      toast.error('Failed to empty trash');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((i) => i.id)));
    }
  };

  const getFileIcon = (item: TrashItem) => {
    const contentType = item.content_type || '';
    const name = item.filename.toLowerCase();

    if (contentType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/.test(name)) {
      return <FileImage className="h-5 w-5 text-green-500" />;
    }
    if (contentType.includes('zip') || /\.(zip|tar|gz|rar)$/.test(name)) {
      return <FileArchive className="h-5 w-5 text-yellow-500" />;
    }
    if (contentType.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Trash</h1>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14" />
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
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trash2 className="h-8 w-8" />
              Trash
            </h1>
            {stats && (
              <div className="flex gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <File className="h-3 w-3" />
                  {stats.total_items} items
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatSize(stats.total_size)}
                </Badge>
              </div>
            )}
          </div>
          <Button
            variant="destructive"
            onClick={() => setEmptyDialogOpen(true)}
            disabled={items.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Empty Trash
          </Button>
        </div>

        {/* Actions Bar */}
        {selectedItems.size > 0 && (
          <Card className="border-primary">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedItems.size} item(s) selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestore}
                    disabled={restoring}
                  >
                    {restoring ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Restore
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeletePermanently}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete Permanently
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search trash..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Trash List */}
        <Card>
          <CardHeader className="py-3">
            <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground items-center">
              <div className="col-span-1">
                <Checkbox
                  checked={items.length > 0 && selectedItems.size === items.length}
                  onCheckedChange={selectAll}
                />
              </div>
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Original Location</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Deleted</div>
              <div className="col-span-1">Expires</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((item) => {
                const daysLeft = getDaysUntilExpiry(item.expires_at);
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 items-center py-3 px-6 hover:bg-muted/50"
                  >
                    <div className="col-span-1">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </div>
                    <div className="col-span-4 flex items-center gap-3">
                      {getFileIcon(item)}
                      <span className="font-medium truncate">{item.filename}</span>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground truncate">
                      {item.original_bucket}/{item.original_key}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {formatSize(item.size)}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(item.deleted_at)}
                    </div>
                    <div className="col-span-1">
                      <Badge
                        variant={daysLeft <= 7 ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {daysLeft <= 0 ? 'Expiring' : `${daysLeft}d`}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Trash is empty</p>
                  <p className="text-sm">Deleted files will appear here for 30 days</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Empty Trash Dialog */}
        <AlertDialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Empty Trash?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {stats?.total_items || 0} items (
                {formatSize(stats?.total_size || 0)}) from trash. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleEmptyTrash}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Empty Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
