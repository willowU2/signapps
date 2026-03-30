'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  FolderIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  PresentationIcon,
  ImageIcon,
  FileIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  UploadIcon,
  DownloadIcon,
  PencilIcon,
  Trash2Icon,
  FolderInputIcon,
  CopyIcon,
  HardDriveIcon,
  ArrowUpIcon,
  ChevronDown,
  EyeIcon,
  Loader2Icon,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePageTitle } from '@/hooks/use-page-title';
import { DriveSearchDocs } from '@/components/interop/DriveSearchDocs';
import { DocFromTemplate } from '@/components/interop/DocFromTemplate';
import { UnifiedContentLibrary } from '@/components/interop/UnifiedContentLibrary';
import { DriveShareEmail } from '@/components/interop/DriveShareEmail';
import { driveApi, DriveNode } from '@/lib/api/drive';
import { storageApi } from '@/lib/api/storage';

// ─── Types ──────────────────────────────────────────────────────────
interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'pdf' | 'xlsx' | 'pptx' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'svg' | 'md' | 'txt' | 'docx' | 'mp4' | 'zip' | 'unknown';
  size?: string;
  items?: number;
  modified: string;
  owner?: string;
  parentId: string | null;
}

// ─── API Mapper ─────────────────────────────────────────────────────
function driveNodeToFileItem(node: DriveNode): FileItem {
  const ext = node.name.split('.').pop()?.toLowerCase() ?? '';
  const validExtTypes: FileItem['type'][] = ['pdf', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'md', 'txt', 'docx', 'mp4', 'zip'];
  let type: FileItem['type'] = 'unknown';
  if (node.node_type === 'folder') {
    type = 'folder';
  } else if ((validExtTypes as string[]).includes(ext)) {
    type = ext as FileItem['type'];
  } else if (node.node_type === 'document') {
    type = 'docx';
  } else if (node.node_type === 'spreadsheet') {
    type = 'xlsx';
  } else if (node.node_type === 'presentation') {
    type = 'pptx';
  }
  const sizeKB = node.size ? node.size / 1024 : null;
  const sizeStr = sizeKB
    ? sizeKB >= 1024
      ? `${(sizeKB / 1024).toFixed(1)} MB`
      : `${sizeKB.toFixed(0)} KB`
    : undefined;
  return {
    id: node.id,
    name: node.name,
    type,
    size: sizeStr,
    modified: node.updated_at,
    parentId: node.parent_id,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────
function getFileIcon(type: FileItem['type'], className: string = 'size-10') {
  switch (type) {
    case 'folder':
      return <FolderIcon className={`${className} text-amber-500`} />;
    case 'pdf':
      return <FileTextIcon className={`${className} text-red-500`} />;
    case 'xlsx':
      return <FileSpreadsheetIcon className={`${className} text-green-600`} />;
    case 'pptx':
      return <PresentationIcon className={`${className} text-orange-500`} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <ImageIcon className={`${className} text-purple-500`} />;
    case 'md':
    case 'txt':
      return <FileTextIcon className={`${className} text-blue-500`} />;
    case 'docx':
      return <FileTextIcon className={`${className} text-blue-600`} />;
    case 'mp4':
      return <FileIcon className={`${className} text-pink-500`} />;
    case 'zip':
      return <FileIcon className={`${className} text-yellow-600`} />;
    default:
      return <FileIcon className={`${className} text-muted-foreground`} />;
  }
}

function getTypeLabel(type: FileItem['type']): string {
  const labels: Record<string, string> = {
    folder: 'Dossier',
    pdf: 'PDF',
    xlsx: 'Tableur',
    pptx: 'Pr\u00e9sentation',
    png: 'Image PNG',
    jpg: 'Image JPEG',
    jpeg: 'Image JPEG',
    gif: 'Image GIF',
    svg: 'Image SVG',
    md: 'Markdown',
    txt: 'Texte',
    docx: 'Document Word',
    mp4: 'Vid\u00e9o',
    zip: 'Archive',
    unknown: 'Fichier',
  };
  return labels[type] || 'Fichier';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sort options ───────────────────────────────────────────────────
type SortField = 'name' | 'modified' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

function sortFiles(files: FileItem[], field: SortField, order: SortOrder): FileItem[] {
  const sorted = [...files].sort((a, b) => {
    // Folders always come first
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'fr');
        break;
      case 'modified':
        cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
        break;
      case 'size':
        cmp = parseSizeMB(a.size) - parseSizeMB(b.size);
        break;
      case 'type':
        cmp = a.type.localeCompare(b.type);
        break;
    }
    return order === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function parseSizeMB(size?: string): number {
  if (!size) return 0;
  const num = parseFloat(size);
  if (size.includes('GB')) return num * 1024;
  if (size.includes('MB')) return num;
  if (size.includes('KB')) return num / 1024;
  return num;
}

// ─── Main Component ─────────────────────────────────────────────────
export default function GlobalDrivePage() {
  usePageTitle('Drive global');
  // files holds the nodes for the current folder only (fetched from API)
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // breadcrumbPath tracks the navigation stack as [{id, name}]
  const [breadcrumbPath, setBreadcrumbPath] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Accueil' }]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Dialogs
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameName, setRenameName] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // ── API fetch on folder change ────────────────────────────────────
  const fetchNodes = useCallback(async (folderId: string | null) => {
    setLoading(true);
    setError(null);
    setSelectedItems(new Set());
    try {
      const nodes = await driveApi.listNodes(folderId);
      setFiles(nodes.map(driveNodeToFileItem));
    } catch {
      setError('Impossible de charger les fichiers. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes(currentFolderId);
  }, [currentFolderId, fetchNodes]);

  // ── Navigation ──────────────────────────────────────────────────
  // breadcrumbPath is maintained as a stack in state; computed from navigation

  const currentFiles = sortFiles(
    files.filter((f) =>
      searchQuery
        ? f.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    ),
    sortField,
    sortOrder
  );

  const navigateToFolder = (folderId: string | null, folderName?: string) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
    if (folderId === null) {
      // Go home
      setBreadcrumbPath([{ id: null, name: 'Accueil' }]);
    } else if (folderName) {
      // Navigate into a subfolder
      setBreadcrumbPath((prev) => [...prev, { id: folderId, name: folderName }]);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    const segment = breadcrumbPath[index];
    setBreadcrumbPath(breadcrumbPath.slice(0, index + 1));
    setCurrentFolderId(segment.id);
    setSearchQuery('');
  };

  const handleDoubleClick = (item: FileItem) => {
    if (item.type === 'folder') {
      navigateToFolder(item.id, item.name);
    } else {
      setPreviewFile(item);
    }
  };

  const goUp = () => {
    if (breadcrumbPath.length > 1) {
      const parentIndex = breadcrumbPath.length - 2;
      navigateToBreadcrumb(parentIndex);
    }
  };

  // ── Selection (with Shift+Click range support) ─────────────────
  const lastClickedIndex = useRef<number | null>(null);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clickedIndex = currentFiles.findIndex((f) => f.id === id);

    if (e.shiftKey && lastClickedIndex.current !== null && clickedIndex !== -1) {
      // Range selection
      const start = Math.min(lastClickedIndex.current, clickedIndex);
      const end = Math.max(lastClickedIndex.current, clickedIndex);
      setSelectedItems((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(currentFiles[i].id);
        }
        return next;
      });
    } else {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
    lastClickedIndex.current = clickedIndex;
  };

  const selectAll = () => {
    setSelectedItems(new Set(currentFiles.map((f) => f.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const isAllSelected = currentFiles.length > 0 && selectedItems.size === currentFiles.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < currentFiles.length;

  // ── Bulk operations ────────────────────────────────────────────
  const bulkDownload = () => {
    const names = currentFiles
      .filter((f) => selectedItems.has(f.id))
      .map((f) => f.name);
    toast.success(`Téléchargement de ${names.length} élément(s)...`);
    clearSelection();
  };

  const bulkMove = () => {
    toast.info(`Déplacement de ${selectedItems.size} élément(s)...`);
    clearSelection();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedItems);
    const count = ids.length;
    try {
      await Promise.all(ids.map((id) => driveApi.deleteNode(id)));
      toast.success(`${count} élément(s) supprimé(s)`);
      clearSelection();
      fetchNodes(currentFolderId);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  // ── CRUD Operations ─────────────────────────────────────────────
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await driveApi.createNode({
        parent_id: currentFolderId,
        name: newFolderName.trim(),
        node_type: 'folder',
        target_id: null,
      });
      setNewFolderName('');
      setShowNewFolder(false);
      toast.success(`Dossier "${newFolderName.trim()}" créé`);
      fetchNodes(currentFolderId);
    } catch {
      toast.error('Erreur lors de la création du dossier');
    }
  };

  const uploadFileRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const toastId = toast.loading(`Import de ${files.length} fichier(s)...`);
    let successCount = 0;
    for (const file of files) {
      try {
        const uploadRes = await storageApi.uploadFile('drive', file);
        if (uploadRes.data && uploadRes.data.length > 0) {
          const target = uploadRes.data[0];
          await driveApi.createNode({
            parent_id: currentFolderId,
            name: target.key,
            node_type: 'file',
            target_id: target.id,
            size: target.size,
            mime_type: target.content_type,
          });
          successCount++;
        }
      } catch {
        toast.error(`Erreur pour ${file.name}`);
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} fichier(s) importé(s)`, { id: toastId });
      fetchNodes(currentFolderId);
    } else {
      toast.dismiss(toastId);
    }
    // Reset input
    if (uploadFileRef.current) uploadFileRef.current.value = '';
  };

  const renameItem = async () => {
    if (!renameTarget || !renameName.trim()) return;
    try {
      await driveApi.updateNode(renameTarget.id, { name: renameName.trim() });
      toast.success(`Renommé en "${renameName.trim()}"`);
      setShowRename(false);
      setRenameTarget(null);
      fetchNodes(currentFolderId);
    } catch {
      toast.error('Erreur lors du renommage');
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    try {
      await driveApi.deleteNode(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" supprimé`);
      setShowDelete(false);
      setDeleteTarget(null);
      fetchNodes(currentFolderId);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const openRenameDialog = (item: FileItem) => {
    setRenameTarget(item);
    setRenameName(item.name);
    setShowRename(true);
  };

  const openDeleteDialog = (item: FileItem) => {
    setDeleteTarget(item);
    setShowDelete(true);
  };

  // ── Stats ───────────────────────────────────────────────────────
  const totalFiles = files.filter((f) => f.type !== 'folder').length;
  const totalFolders = files.filter((f) => f.type === 'folder').length;

  // ── Toggle sort ─────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for real uploads */}
      <input
        ref={uploadFileRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <HardDriveIcon className="size-8" />
            Drive
          </h1>
          <p className="text-muted-foreground mt-1">
            {loading ? 'Chargement...' : `${totalFolders} dossier${totalFolders !== 1 ? 's' : ''}, ${totalFiles} fichier${totalFiles !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowNewFolder(true)} className="gap-2">
            <PlusIcon className="size-4" />
            Nouveau dossier
          </Button>
          <Button onClick={() => uploadFileRef.current?.click()} className="gap-2">
            <UploadIcon className="size-4" />
            Importer
          </Button>
          <DocFromTemplate />
          <UnifiedContentLibrary />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbPath.map((segment, idx) => (
                <BreadcrumbItem key={segment.id ?? 'root'}>
                  {idx > 0 && <BreadcrumbSeparator />}
                  {idx === breadcrumbPath.length - 1 ? (
                    <BreadcrumbPage>{segment.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToBreadcrumb(idx);
                      }}
                    >
                      {segment.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          {currentFolderId && (
            <Button variant="ghost" size="sm" onClick={goUp} className="gap-1">
              <ArrowUpIcon className="size-4" />
              Remonter
            </Button>
          )}

          {/* Enhanced Search (Drive + Doc content) */}
          <div className="w-64">
            <DriveSearchDocs />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            <Button
              variant={sortField === 'name' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => toggleSort('name')}
              className="gap-1 text-xs"
            >
              Nom
              {sortField === 'name' && (
                <ChevronDown className={`size-3 transition-transform ${sortOrder === 'asc' ? '' : 'rotate-180'}`} />
              )}
            </Button>
            <Button
              variant={sortField === 'modified' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => toggleSort('modified')}
              className="gap-1 text-xs"
            >
              Date
              {sortField === 'modified' && (
                <ChevronDown className={`size-3 transition-transform ${sortOrder === 'asc' ? '' : 'rotate-180'}`} />
              )}
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* View toggle */}
          <div className="flex items-center rounded-lg border">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <LayoutGridIcon className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <ListIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedItems.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={(checked) => {
                if (checked) selectAll();
                else clearSelection();
              }}
              aria-label="Tout selectionner"
            />
            <span className="text-sm font-medium">
              {selectedItems.size} selectionne{selectedItems.size > 1 ? 's' : ''}
            </span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={bulkDownload}>
              <DownloadIcon className="size-3.5" />
              Telecharger
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={bulkMove}>
              <FolderInputIcon className="size-3.5" />
              Deplacer
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-destructive hover:text-destructive" onClick={bulkDelete}>
              <Trash2Icon className="size-3.5" />
              Supprimer
            </Button>
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearSelection}>
            Annuler la selection
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2Icon className="size-10 text-muted-foreground/60 mb-4 animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement des fichiers...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderIcon className="size-16 text-destructive/40 mb-4" />
          <h3 className="text-lg font-medium text-destructive">Erreur de chargement</h3>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchNodes(currentFolderId)}>
            Réessayer
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && currentFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderIcon className="size-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium">
            {searchQuery ? 'Aucun résultat' : 'Dossier vide'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery
              ? `Aucun fichier ne correspond à "${searchQuery}"`
              : 'Créez un dossier ou importez des fichiers pour commencer.'
            }
          </p>
        </div>
      )}

      {/* Grid View */}
      {!loading && !error && viewMode === 'grid' && currentFiles.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {currentFiles.map((item) => (
            <ContextMenu key={item.id}>
              <ContextMenuTrigger>
                <Card
                  className={`group cursor-pointer transition-all hover:shadow-md hover:border-primary/30 relative ${
                    selectedItems.has(item.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
                  }`}
                  onClick={(e) => toggleSelect(item.id, e)}
                  onDoubleClick={() => handleDoubleClick(item)}
                >
                  <div
                    className={`absolute top-2 left-2 z-10 transition-opacity ${
                      selectedItems.has(item.id) || selectedItems.size > 0
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => {
                        setSelectedItems((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                      aria-label={`Selectionner ${item.name}`}
                    />
                  </div>
                  <CardContent className="flex flex-col items-center gap-3 p-4">
                    <div className="transition-transform group-hover:scale-105">
                      {getFileIcon(item.type)}
                    </div>
                    <div className="w-full text-center min-w-0">
                      <p className="text-sm font-medium truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.type === 'folder'
                          ? `${item.items} \u00e9l\u00e9ments`
                          : item.size}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {item.type === 'folder' ? (
                  <ContextMenuItem onClick={() => navigateToFolder(item.id, item.name)}>
                    <FolderIcon className="size-4 mr-2" />
                    Ouvrir
                  </ContextMenuItem>
                ) : (
                  <ContextMenuItem onClick={() => setPreviewFile(item)}>
                    <EyeIcon className="size-4 mr-2" />
                    Apercu
                  </ContextMenuItem>
                )}
                <ContextMenuItem onClick={() => toast.info(`Téléchargement de "${item.name}"...`)}>
                  <DownloadIcon className="size-4 mr-2" />
                  Télécharger
                </ContextMenuItem>
                <ContextMenuItem onClick={() => {
                  const url = `${window.location.origin}/global-drive?node=${item.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success('Lien copié');
                }}>
                  <CopyIcon className="size-4 mr-2" />
                  Copier le lien
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => openRenameDialog(item)}>
                  <PencilIcon className="size-4 mr-2" />
                  Renommer
                </ContextMenuItem>
                <ContextMenuItem onClick={() => toast.info('Copie en cours...')}>
                  <CopyIcon className="size-4 mr-2" />
                  Copier
                </ContextMenuItem>
                <ContextMenuItem onClick={() => toast.info('Déplacement...')}>
                  <FolderInputIcon className="size-4 mr-2" />
                  Déplacer
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => openDeleteDialog(item)}>
                  <Trash2Icon className="size-4 mr-2" />
                  Supprimer
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && !error && viewMode === 'list' && currentFiles.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={(checked) => {
                          if (checked) selectAll();
                          else clearSelection();
                        }}
                        aria-label="Tout selectionner"
                        className={isSomeSelected ? 'data-[state=unchecked]:bg-primary/20' : ''}
                      />
                    </th>
                    <th className="text-left font-medium px-4 py-3 w-[40%]">
                      <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                        Nom
                        {sortField === 'name' && (
                          <ChevronDown className={`size-3 transition-transform ${sortOrder === 'asc' ? '' : 'rotate-180'}`} />
                        )}
                      </button>
                    </th>
                    <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                      <button onClick={() => toggleSort('type')} className="flex items-center gap-1 hover:text-foreground">
                        Type
                        {sortField === 'type' && (
                          <ChevronDown className={`size-3 transition-transform ${sortOrder === 'asc' ? '' : 'rotate-180'}`} />
                        )}
                      </button>
                    </th>
                    <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Taille</th>
                    <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                      <button onClick={() => toggleSort('modified')} className="flex items-center gap-1 hover:text-foreground">
                        Modifi\u00e9
                        {sortField === 'modified' && (
                          <ChevronDown className={`size-3 transition-transform ${sortOrder === 'asc' ? '' : 'rotate-180'}`} />
                        )}
                      </button>
                    </th>
                    <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Propri\u00e9taire</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {currentFiles.map((item) => (
                    <ContextMenu key={item.id}>
                      <ContextMenuTrigger asChild>
                        <tr
                          className={`border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${
                            selectedItems.has(item.id) ? 'bg-primary/5' : ''
                          }`}
                          onClick={(e) => toggleSelect(item.id, e)}
                          onDoubleClick={() => handleDoubleClick(item)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => {
                                setSelectedItems((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              aria-label={`Selectionner ${item.name}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {getFileIcon(item.type, 'size-5')}
                              <span className="font-medium truncate max-w-[300px]" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            <Badge variant="outline" className="font-normal text-xs">
                              {getTypeLabel(item.type)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {item.type === 'folder' ? `${item.items} \u00e9l.` : item.size || '\u2014'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {formatDate(item.modified)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {item.owner || '\u2014'}
                          </td>
                          <td className="px-4 py-3" />
                        </tr>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {item.type === 'folder' ? (
                          <ContextMenuItem onClick={() => navigateToFolder(item.id, item.name)}>
                            <FolderIcon className="size-4 mr-2" />
                            Ouvrir
                          </ContextMenuItem>
                        ) : (
                          <ContextMenuItem onClick={() => toast.info(`Ouverture de "${item.name}"...`)}>
                            <EyeIcon className="size-4 mr-2" />
                            Ouvrir
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => toast.info(`T\u00e9l\u00e9chargement de "${item.name}"...`)}>
                          <DownloadIcon className="size-4 mr-2" />
                          T\u00e9l\u00e9charger
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => openRenameDialog(item)}>
                          <PencilIcon className="size-4 mr-2" />
                          Renommer
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => toast.info('Copie en cours...')}>
                          <CopyIcon className="size-4 mr-2" />
                          Copier
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => toast.info('D\u00e9placement...')}>
                          <FolderInputIcon className="size-4 mr-2" />
                          D\u00e9placer
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem variant="destructive" onClick={() => openDeleteDialog(item)}>
                          <Trash2Icon className="size-4 mr-2" />
                          Supprimer
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── New Folder Dialog ──────────────────────────────────── */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
            <DialogDescription>
              Cr\u00e9ez un nouveau dossier dans l&apos;emplacement actuel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="folderName">Nom du dossier</Label>
            <Input
              id="folderName"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Mon dossier"
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>
              Annuler
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim()}>
              Cr\u00e9er
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Dialog ──────────────────────────────────────── */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
            <DialogDescription>
              Entrez le nouveau nom pour &quot;{renameTarget?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="renameName">Nouveau nom</Label>
            <Input
              id="renameName"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && renameItem()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRename(false)}>
              Annuler
            </Button>
            <Button onClick={renameItem} disabled={!renameName.trim()}>
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ──────────────────────────────────────── */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              \u00cates-vous s\u00fbr de vouloir supprimer &quot;{deleteTarget?.name}&quot; ?
              {deleteTarget?.type === 'folder' && ' Tout le contenu du dossier sera \u00e9galement supprim\u00e9.'}
              {' '}Cette action est irr\u00e9versible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={deleteItem}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── File Preview Dialog ─────────────────────────────────── */}
      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewFile && getFileIcon(previewFile.type, 'size-5')}
              {previewFile?.name}
            </DialogTitle>
            <DialogDescription>
              {previewFile && `${getTypeLabel(previewFile.type)} — ${previewFile.size || 'Taille inconnue'} — ${formatDate(previewFile.modified)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewFile && <FilePreviewContent file={previewFile} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFile(null)}>
              Fermer
            </Button>
            <Button onClick={() => { toast.info(`Telechargement de "${previewFile?.name}"...`); setPreviewFile(null); }}>
              <DownloadIcon className="size-4 mr-2" />
              Telecharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── File Preview Content Component ──────────────────────────────────
function FilePreviewContent({ file }: { file: FileItem }) {
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(file.type);
  const isText = ['md', 'txt'].includes(file.type);
  const isPdf = file.type === 'pdf';
  const isVideo = file.type === 'mp4';

  if (isImage) {
    return (
      <div className="flex items-center justify-center bg-muted/30 rounded-lg p-6 min-h-[300px]">
        <div className="text-center">
          <ImageIcon className="size-16 text-purple-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground mt-1">{file.size}</p>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-8 min-h-[300px]">
        <FileTextIcon className="size-16 text-red-500 mb-4" />
        <p className="text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{file.size}</p>
        <Badge variant="outline" className="mt-3">Document PDF</Badge>
      </div>
    );
  }

  if (isText) {
    const sampleContent = file.type === 'md'
      ? `# ${file.name.replace('.md', '')}\n\nApercu du fichier Markdown.\n\n## Section 1\n\nContenu du document...\n\n## Section 2\n\n- Point 1\n- Point 2\n- Point 3\n\n> Note : L'apercu complet sera disponible lorsque le fichier sera charge depuis le serveur.`
      : `Contenu du fichier texte "${file.name}"\n\nLe contenu complet sera affiche lorsque le fichier sera charge depuis le serveur de stockage.\n\nTaille : ${file.size || 'inconnue'}\nDerniere modification : ${file.modified}`;

    return (
      <ScrollArea className="h-[350px] rounded-lg border bg-muted/20">
        <pre className="p-4 text-sm font-mono whitespace-pre-wrap text-foreground/80 leading-relaxed">
          {sampleContent}
        </pre>
      </ScrollArea>
    );
  }

  if (isVideo) {
    return (
      <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-8 min-h-[300px]">
        <div className="w-64 h-40 bg-black/80 rounded-lg flex items-center justify-center">
          <div className="w-0 h-0 border-l-[24px] border-l-white border-y-[16px] border-y-transparent ml-2" />
        </div>
        <p className="text-sm font-medium mt-4">{file.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{file.size}</p>
      </div>
    );
  }

  // Default: show file info card
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-center py-6">
        {getFileIcon(file.type, 'size-20')}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-muted-foreground">Nom</p>
          <p className="font-medium">{file.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Type</p>
          <p className="font-medium">{getTypeLabel(file.type)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Taille</p>
          <p className="font-medium">{file.size || 'Inconnue'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Modification</p>
          <p className="font-medium">{formatDate(file.modified)}</p>
        </div>
        {file.owner && (
          <div className="space-y-1">
            <p className="text-muted-foreground">Proprietaire</p>
            <p className="font-medium">{file.owner}</p>
          </div>
        )}
      </div>
    </div>
  );
}
