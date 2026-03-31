'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key, FileText, CreditCard, Terminal, Code, User, Shield,
  Star, Share2, ExternalLink, Copy, Globe, Pencil, Trash2,
  Monitor, Folder, FolderOpen, Plus, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVaultStore } from '@/stores/vault-store';
import { VaultItemForm } from '@/components/vault/vault-item-form';
import { VaultShareDialog } from '@/components/vault/vault-share-dialog';
import type { DecryptedVaultItem, VaultItemType } from '@/types/vault';

// ─────────────────────────────────────────────────────────────────────────────
// Item type config
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<VaultItemType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}> = {
  login:       { icon: Key,        label: 'Identifiants',   color: 'text-blue-500' },
  secure_note: { icon: FileText,   label: 'Note sécurisée', color: 'text-amber-500' },
  card:        { icon: CreditCard, label: 'Carte',          color: 'text-purple-500' },
  ssh_key:     { icon: Terminal,   label: 'Clé SSH',        color: 'text-green-500' },
  api_token:   { icon: Code,       label: 'Jeton API',      color: 'text-cyan-500' },
  identity:    { icon: User,       label: 'Identité',       color: 'text-orange-500' },
  passkey:     { icon: Shield,     label: 'Passkey',        color: 'text-emerald-500' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDomain(uri?: string): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).hostname;
  } catch {
    return uri;
  }
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copié`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface VaultListProps {
  search: string;
  selectedFolder: string | null;
  onSelectFolder: (id: string | null) => void;
  onEditItem: (item: DecryptedVaultItem) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function VaultList({
  search,
  selectedFolder,
  onSelectFolder,
}: VaultListProps) {
  const router = useRouter();
  const { items, folders, sharedItems, loading, deleteItem, startBrowse } = useVaultStore();

  const [editItem, setEditItem] = useState<DecryptedVaultItem | null>(null);
  const [shareItem, setShareItem] = useState<DecryptedVaultItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [browsingId, setBrowsingId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // ── Filter logic ────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let pool = items;

    if (selectedFolder === '__favorites__') {
      pool = pool.filter((i) => i.favorite);
    } else if (selectedFolder === '__shared__') {
      pool = sharedItems;
    } else if (selectedFolder) {
      pool = pool.filter((i) => i.folder_id === selectedFolder);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.data as Record<string, string>)?.username?.toLowerCase().includes(q) ||
          i.uri?.toLowerCase().includes(q),
      );
    }

    return pool;
  }, [items, sharedItems, search, selectedFolder]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleBrowse = async (item: DecryptedVaultItem) => {
    setBrowsingId(item.id);
    try {
      const session = await startBrowse(item.id);
      router.push(`/vault/browse/${session.token}`);
    } catch {
      toast.error('Impossible de démarrer la navigation sécurisée');
      setBrowsingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteItem(deleteTarget);
      toast.success('Élément supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden">
        {/* ── Folder sidebar ── */}
        <aside className="w-56 shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
          <div className="p-3 space-y-0.5">
            <SidebarItem
              label="Tous les éléments"
              icon={<Key className="h-4 w-4" />}
              active={selectedFolder === null}
              onClick={() => onSelectFolder(null)}
              count={items.length}
            />
            <SidebarItem
              label="Favoris"
              icon={<Star className="h-4 w-4 text-amber-400" />}
              active={selectedFolder === '__favorites__'}
              onClick={() => onSelectFolder('__favorites__')}
              count={items.filter((i) => i.favorite).length}
            />
            <SidebarItem
              label="Partagés avec moi"
              icon={<Share2 className="h-4 w-4 text-blue-400" />}
              active={selectedFolder === '__shared__'}
              onClick={() => onSelectFolder('__shared__')}
              count={sharedItems.length}
            />

            {folders.length > 0 && (
              <div className="pt-3">
                <p className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Dossiers
                </p>
                {folders.map((folder) => (
                  <SidebarItem
                    key={folder.id}
                    label={folder.name}
                    icon={
                      expandedFolders.has(folder.id)
                        ? <FolderOpen className="h-4 w-4 text-amber-500" />
                        : <Folder className="h-4 w-4 text-amber-500" />
                    }
                    active={selectedFolder === folder.id}
                    onClick={() => {
                      onSelectFolder(folder.id);
                      toggleFolder(folder.id);
                    }}
                    count={items.filter((i) => i.folder_id === folder.id).length}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── Item list ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Shield className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {search ? 'Aucun résultat pour cette recherche.' : 'Aucun élément dans ce coffre.'}
              </p>
            </div>
          )}

          {!loading && filteredItems.length > 0 && (
            <ScrollArea className="flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-background border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="pl-4 pr-2 py-3 w-8" />
                    <th className="px-2 py-3 font-medium">Nom</th>
                    <th className="px-2 py-3 font-medium hidden md:table-cell">Identifiant</th>
                    <th className="px-2 py-3 font-medium hidden lg:table-cell">Site</th>
                    <th className="px-2 py-3 w-8" />
                    <th className="px-2 py-3 w-8" />
                    <th className="pr-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      browsingId={browsingId}
                      onEdit={() => setEditItem(item)}
                      onShare={() => setShareItem(item)}
                      onDelete={() => setDeleteTarget(item.id)}
                      onBrowse={() => handleBrowse(item)}
                    />
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* ── Edit form ── */}
      {editItem && (
        <VaultItemForm
          open={true}
          item={editItem}
          itemType={editItem.item_type}
          onClose={() => setEditItem(null)}
        />
      )}

      {/* ── Share dialog ── */}
      {shareItem && (
        <VaultShareDialog
          open={true}
          item={shareItem}
          onClose={() => setShareItem(null)}
        />
      )}

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet élément ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'élément sera définitivement supprimé de votre coffre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SidebarItem({
  label, icon, active, onClick, count,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      <span className="flex-1 text-left truncate">{label}</span>
      {count > 0 && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function ItemRow({
  item,
  browsingId,
  onEdit,
  onShare,
  onDelete,
  onBrowse,
}: {
  item: DecryptedVaultItem;
  browsingId: string | null;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  onBrowse: () => void;
}) {
  const cfg = TYPE_CONFIG[item.item_type];
  const Icon = cfg.icon;
  const data = item.data as Record<string, string>;
  const domain = getDomain(item.uri);
  const isBrowsing = browsingId === item.id;

  return (
    <tr className="group hover:bg-accent/40 transition-colors">
      {/* Type icon */}
      <td className="pl-4 pr-2 py-3">
        <Icon className={cn('h-4 w-4', cfg.color)} />
      </td>

      {/* Name */}
      <td className="px-2 py-3">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate max-w-[180px]">{item.name}</span>
          {item.favorite && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
        </div>
        <span className="text-xs text-muted-foreground">{cfg.label}</span>
      </td>

      {/* Username */}
      <td className="px-2 py-3 hidden md:table-cell">
        <span className="text-muted-foreground text-xs truncate max-w-[140px] block">
          {data?.username || data?.cardholder || data?.first_name || '—'}
        </span>
      </td>

      {/* Domain */}
      <td className="px-2 py-3 hidden lg:table-cell">
        {domain ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[120px]">{domain}</span>
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      {/* Shared badge */}
      <td className="px-2 py-3 w-8">
        {/* placeholder — shared indicator if needed */}
      </td>

      {/* Favorite */}
      <td className="px-2 py-3 w-8">
        {item.favorite && (
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        )}
      </td>

      {/* Actions */}
      <td className="pr-4 py-3">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Copy password */}
          {item.item_type === 'login' && data?.password && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(data.password, 'Mot de passe')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copier le mot de passe</TooltipContent>
            </Tooltip>
          )}

          {/* Copy username */}
          {item.item_type === 'login' && data?.username && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(data.username, 'Identifiant')}
                >
                  <User className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copier l&apos;identifiant</TooltipContent>
            </Tooltip>
          )}

          {/* Open URI */}
          {item.uri && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => window.open(item.uri, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ouvrir le site</TooltipContent>
            </Tooltip>
          )}

          {/* Browse (use_only) */}
          {item.uri && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onBrowse}
                  disabled={isBrowsing}
                >
                  {isBrowsing
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Monitor className="h-3.5 w-3.5" />
                  }
                </Button>
              </TooltipTrigger>
              <TooltipContent>Navigation sécurisée</TooltipContent>
            </Tooltip>
          )}

          {/* Share */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onShare}
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Partager</TooltipContent>
          </Tooltip>

          {/* Edit */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Modifier</TooltipContent>
          </Tooltip>

          {/* Delete */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Supprimer</TooltipContent>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}
