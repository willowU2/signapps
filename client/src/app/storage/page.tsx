'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { DriveSidebar } from '@/components/storage/drive-sidebar';
import { DriveView } from '@/components/storage/types';
import { FileGridItem } from '@/components/storage/file-grid-item';
import { FileListItem } from '@/components/storage/file-list-item';
import { RenameDialog } from '@/components/storage/rename-dialog';
import { MoveToDialog } from '@/components/storage/move-to-dialog';
import {
  Upload,
  Folder,
  FileText,
  Image as ImageIcon,
  Search,
  ChevronRight,
  MoreVertical,
  Download,
  Trash2,
  FolderPlus,
  Home,
  File as FileIcon,
  FileArchive,
  FileCode,
  Loader2,
  Plus,
  Database,
  LayoutDashboard,
  HardDrive,
  FolderOpen,
  Usb,
  Share2,
  Eye,
  Lock,
  Star,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { storageApi, favoritesApi, searchApi, trashApi, sharesApi } from '@/lib/api';
import { UploadDialog } from '@/components/storage/upload-dialog';
import { FilePreviewDialog } from '@/components/storage/file-preview-dialog';
import { FolderTree } from '@/components/storage/folder-tree';
import { PermissionsDialog } from '@/components/storage/permissions-dialog';
import { DropZone } from '@/components/storage/drop-zone';
import { FavoritesBar } from '@/components/storage/favorites-bar';
import { ManageTagsDialog } from '@/components/storage/manage-tags-dialog';
import { FileTagsDialog } from '@/components/storage/file-tags-dialog';
import { VersionHistoryDialog } from '@/components/storage/version-history-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';
import { ShareDialog } from '@/components/storage/share-dialog';

// Import storage components
import { OverviewStats, AlertsPanel, HealthGauge, QuotaCard } from './components/dashboard';
import { DiskList } from './components/disks';
import { MountList } from './components/mounts';
import { ExternalList } from './components/external';
import { ShareList } from './components/shares';
import { RaidOverview } from './components/raid';
import {
  useStorageStats,
  useRaidData,
  useShares,
  useMounts,
  useExternalStorage,
} from './hooks/use-storage-data';

import { FileItem } from '@/components/storage/types';

interface Bucket {
  name: string;
  creationDate?: string;
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'files', label: 'Fichiers', icon: Folder },
  { id: 'disks', label: 'Disques', icon: HardDrive },
  { id: 'mounts', label: 'Montages', icon: FolderOpen },
  { id: 'external', label: 'Externes', icon: Usb },
  { id: 'shares', label: 'Partages', icon: Share2 },
  { id: 'raid', label: 'RAID', icon: Database },
];

export default function StoragePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');

  // Drive UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [driveView, setDriveView] = useState<DriveView>('my-drive');

  // File browser state
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentBucket, setCurrentBucket] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [bucketDialogOpen, setBucketDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newBucketName, setNewBucketName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<FileItem | null>(null);
  const [deleteBucket, setDeleteBucket] = useState<string | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsFile, setPermissionsFile] = useState<FileItem | null>(null);

  // Tags dialog state
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [fileTagsOpen, setFileTagsOpen] = useState(false);
  const [tagFile, setTagFile] = useState<FileItem | null>(null);

  // Version History dialog state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFile, setHistoryFile] = useState<FileItem | null>(null);

  // Dialog state for Rename/Move
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<FileItem | null>(null);

  // Share state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareItem, setShareItem] = useState<FileItem | null>(null);

  const handleAction = async (action: string, item: FileItem) => {
    if (action === 'open') {
      if (item.type === 'folder') handleNavigate(item);
      else if (isPreviewable(item)) handlePreview(item);
    } else if (action === 'download') {
      handleDownload(item);
    } else if (action === 'delete') {
      setDeleteItem(item);
    } else if (action === 'rename') {
      setRenameItem(item);
      setRenameDialogOpen(true);
    } else if (action === 'move') {
      setMoveItem(item);
      setMoveDialogOpen(true);
    } else if (action === 'permissions') {
      setPermissionsFile(item);
      setPermissionsDialogOpen(true);
    } else if (action === 'manage-tags') {
      if (item.id) {
        setTagFile(item);
        setFileTagsOpen(true);
      } else {
        toast.error("Cannot manage tags: file ID is missing");
      }
    } else if (action === 'version-history') {
      if (item.id) {
        setHistoryFile(item);
        setHistoryOpen(true);
      } else {
        toast.error("Cannot view history: file ID is missing");
      }
    } else if (action === 'share') {
      setShareItem(item);
      setShareDialogOpen(true);
    } else if (action === 'restore' && item.id) {
      try {
        await trashApi.restore([item.id]);
        toast.success("Restored");
        fetchFiles();
      } catch { toast.error("Failed to restore"); }
    } else if (action === 'delete-forever') {
      setDeleteItem(item);
    } else if (action === 'star') {
      try {
        await favoritesApi.add({
          bucket: currentBucket || item.bucket || '',
          key: item.key,
          is_folder: item.type === 'folder'
        });
        toast.success("Starred");
        fetchFiles(); // Refresh to show star status if we had it
      } catch { toast.error("Failed to star"); }
    } else if (action === 'unstar' && item.id) {
      try {
        await favoritesApi.remove(item.id);
        toast.success("Unstarred");
        fetchFiles();
      } catch { toast.error("Failed to unstar"); }
    }
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renameItem || !currentBucket) return;

    try {
      // Construct new key
      const oldKey = renameItem.key;
      let parentPath = '';

      if (oldKey.includes('/')) {
        const parts = oldKey.split('/');
        // remove last part (filename or empty if folder)
        parts.pop();
        if (renameItem.type === 'folder') parts.pop();

        parentPath = parts.join('/');
      }

      const newKey = (parentPath ? parentPath + '/' : '') + newName + (renameItem.type === 'folder' ? '/' : '');

      await storageApi.move(currentBucket, oldKey, currentBucket, newKey);
      toast.success("Renamed successfully");
      fetchFiles();
    } catch (error) {
      console.error(error);
      toast.error("Failed to rename");
    }
  };

  const handleMoveSubmit = async (destPath: string) => {
    if (!moveItem || !currentBucket) return;
    try {
      const oldKey = moveItem.key;
      // destPath usually ends with / e.g. "folder/" or "" for root
      const newKey = destPath + moveItem.name + (moveItem.type === 'folder' ? '/' : '');

      if (oldKey === newKey) return;

      await storageApi.move(currentBucket, oldKey, currentBucket, newKey);
      toast.success("Moved successfully");
      fetchFiles();
    } catch (error) {
      console.error(error);
      toast.error("Failed to move");
    }
  };

  // Use hooks for other tabs
  const storageStats = useStorageStats();
  const raidData = useRaidData();
  const sharesData = useShares();
  const mountsData = useMounts();
  const externalData = useExternalStorage();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push(`/storage?tab=${tab}`, { scroll: false });
  };

  const fetchBuckets = useCallback(async () => {
    try {
      const response = await storageApi.listBuckets();
      const bucketList = (response.data || []).filter((b: { name: string }) => b.name);
      setBuckets(bucketList.map((b: { name: string; created_at?: string }) => ({ name: b.name, creationDate: b.created_at })));
      if (bucketList.length > 0 && !currentBucket) {
        setCurrentBucket(bucketList[0].name);
      } else if (bucketList.length === 0) {
        setLoading(false);
      }
    } catch {
      setBuckets([]);
      setCurrentBucket('');
      setLoading(false);
    }
  }, [currentBucket]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setFiles([]);

    try {
      if (driveView === 'recent') {
        const response = await searchApi.recent(50);
        const recentFiles: FileItem[] = response.data.map((item: any) => ({
          key: item.key,
          name: item.filename || item.key.split('/').pop() || item.key,
          type: 'file',
          size: item.size,
          contentType: item.content_type,
          bucket: item.bucket
        }));
        setFiles(recentFiles);
      } else if (driveView === 'starred') {
        const response = await favoritesApi.list();
        const starredFiles: FileItem[] = response.data.favorites.map((item: any) => ({
          key: item.key,
          name: item.display_name || item.filename || item.key.split('/').pop() || item.key,
          type: item.is_folder ? 'folder' : 'file',
          size: item.size,
          contentType: item.content_type,
          bucket: item.bucket,
          id: item.id
        }));
        setFiles(starredFiles);
      } else if (driveView === 'trash') {
        const response = await trashApi.list();
        const trashFiles: FileItem[] = response.data.items.map((item: any) => ({
          key: item.trash_key,
          name: item.filename,
          type: 'file', // Trash items are usually treated as files or bundles
          size: item.size,
          contentType: item.content_type,
          bucket: item.original_bucket,
          originalPath: item.original_key,
          id: item.id,
          lastModified: item.deleted_at
        }));
        setFiles(trashFiles);
      } else if (driveView === 'shared') {
        const response = await sharesApi.list();
        const sharedFiles: FileItem[] = response.data.shares.map((item: any) => ({
          key: item.key,
          name: item.key.split('/').pop() || item.key,
          type: 'file',
          lastModified: item.created_at,
          bucket: item.bucket,
          id: item.id
        }));
        setFiles(sharedFiles);
      } else {
        // My Drive
        if (!currentBucket) {
          setLoading(false);
          return;
        }
        const prefix = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
        const response = await storageApi.listFiles(currentBucket, prefix, '/');
        const data = response.data;

        const folders: FileItem[] = (data.prefixes || []).map((p: string) => ({
          key: p,
          name: p.replace(/\/$/, '').split('/').filter(Boolean).pop() || p,
          type: 'folder' as const,
          bucket: currentBucket
        }));

        const files: FileItem[] = (data.objects || [])
          .filter((o: { key: string }) => !o.key.endsWith('/'))
          .map((o: { key: string; size: number; last_modified: string | null; content_type: string | null }) => ({
            key: o.key,
            name: o.key.split('/').filter(Boolean).pop() || o.key,
            type: 'file' as const,
            size: o.size,
            lastModified: o.last_modified || undefined,
            contentType: o.content_type || undefined,
            bucket: currentBucket
          }));

        setFiles([...folders, ...files]);
      }
    } catch (e) {
      console.error(e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [currentBucket, currentPath, driveView]);

  useEffect(() => {
    if (activeTab === 'files') {
      fetchBuckets();
    }
  }, [activeTab, fetchBuckets]);

  useEffect(() => {
    if (activeTab === 'files') {
      fetchFiles();
    }
  }, [activeTab, fetchFiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() && activeTab === 'files') {
        searchApi.search(search, { bucket: currentBucket }).then(response => {
          const searchFiles: FileItem[] = response.data.results.map((item: any) => ({
            key: item.key,
            name: item.filename,
            type: 'file',
            size: item.size,
            contentType: item.content_type,
            bucket: item.bucket,
            lastModified: item.modified_at,
          }));
          setFiles(searchFiles);
        }).catch(err => {
          console.error("Search failed", err);
          setFiles([]);
        });
      } else if (!search.trim() && activeTab === 'files') {
        fetchFiles();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, currentBucket, fetchFiles, activeTab]);

  const handleNavigate = (item: FileItem) => {
    if (item.type === 'folder') {
      setCurrentPath([...currentPath, item.name]);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath(currentPath.slice(0, index + 1));
    }
  };

  const handleDownload = async (item: FileItem) => {
    try {
      const key = currentPath.length > 0
        ? `${currentPath.join('/')}/${item.name}`
        : item.name;
      const response = await storageApi.download(currentBucket, key);
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (item: FileItem) => {
    try {
      if (driveView === 'trash' && item.id) {
        await trashApi.delete(item.id);
        toast.success("Deleted forever");
      } else {
        const key = currentPath.length > 0
          ? `${currentPath.join('/')}/${item.name}`
          : item.name;
        await storageApi.deleteFile(currentBucket, key);
        toast.success("Moved to trash");
      }
      fetchFiles();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete item");
    }
  };

  const handlePreview = (item: FileItem) => {
    setPreviewFile(item);
    setPreviewDialogOpen(true);
  };

  const handleAddToFavorites = async (item: FileItem) => {
    try {
      const key = currentPath.length > 0
        ? `${currentPath.join('/')}/${item.name}`
        : item.name;
      await favoritesApi.add({
        bucket: currentBucket,
        key,
        is_folder: item.type === 'folder',
      });
      toast.success('Ajouté aux favoris');
    } catch {
      toast.error('Impossible d\'ajouter aux favoris');
    }
  };

  const isPreviewable = (item: FileItem): boolean => {
    if (item.type === 'folder') return false;
    const name = item.name.toLowerCase();
    const ext = name.split('.').pop() || '';
    const contentType = item.contentType || '';

    // Images
    if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
      return true;
    }
    // PDF
    if (contentType === 'application/pdf' || ext === 'pdf') {
      return true;
    }
    // Video
    const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv'];
    if (contentType.startsWith('video/') || videoExtensions.includes(ext)) {
      return true;
    }
    // Audio
    const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    if (contentType.startsWith('audio/') || audioExtensions.includes(ext)) {
      return true;
    }
    // Text/Code
    const textExtensions = ['txt', 'log', 'csv', 'xml', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'md', 'mdx', 'markdown'];
    const codeExtensions = ['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'sql', 'html', 'css', 'scss', 'less', 'json', 'toml'];
    if (contentType.startsWith('text/') || textExtensions.includes(ext) || codeExtensions.includes(ext)) {
      return true;
    }
    // Archives
    const archiveExtensions = ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'];
    if (archiveExtensions.includes(ext)) {
      return true;
    }
    // Documents
    const docExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];
    if (docExtensions.includes(ext)) {
      return true;
    }
    return false;
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentBucket) return;

    setCreatingFolder(true);
    try {
      const folderPath = currentPath.length > 0
        ? `${currentPath.join('/')}/${newFolderName}`
        : newFolderName;

      await storageApi.createFolder(currentBucket, folderPath);

      toast.success('Folder created successfully');
      setFolderDialogOpen(false);
      setNewFolderName('');
      fetchFiles();
    } catch {
      toast.error('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;

    const validName = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!validName.test(newBucketName)) {
      toast.error('Bucket name must be lowercase, start and end with letter/number');
      return;
    }

    setCreatingBucket(true);
    try {
      await storageApi.createBucket(newBucketName);
      toast.success('Bucket created successfully');
      setBucketDialogOpen(false);
      setNewBucketName('');
      fetchBuckets();
      setCurrentBucket(newBucketName);
    } catch {
      toast.error('Failed to create bucket');
    } finally {
      setCreatingBucket(false);
    }
  };

  const handleDeleteBucket = async (bucketName: string) => {
    try {
      await storageApi.deleteBucket(bucketName);
      toast.success('Bucket deleted');
      fetchBuckets();
      if (currentBucket === bucketName) {
        setCurrentBucket('');
        setCurrentPath([]);
      }
    } catch {
      toast.error('Failed to delete bucket');
    }
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') {
      return <Folder className="h-5 w-5 text-blue-500" />;
    }

    const contentType = item.contentType || '';
    const name = item.name.toLowerCase();

    if (contentType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(name)) {
      return <ImageIcon className="h-5 w-5 text-green-500" />;
    }
    if (contentType.includes('zip') || /\.(zip|tar|gz|rar|7z)$/.test(name)) {
      return <FileArchive className="h-5 w-5 text-yellow-500" />;
    }
    if (/\.(js|ts|tsx|jsx|py|rs|go|java|c|cpp|html|css|json|md)$/.test(name)) {
      return <FileCode className="h-5 w-5 text-purple-500" />;
    }
    if (contentType.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }

    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const displayFiles = files; // Search filtering is now done via the backend /search API

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Storage</h1>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-7">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <OverviewStats
              stats={storageStats.stats}
              raidHealth={raidData.health}
              loading={storageStats.loading}
            />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <HealthGauge
                value={storageStats.stats && storageStats.stats.total_bytes > 0
                  ? Math.round((storageStats.stats.used_bytes / storageStats.stats.total_bytes) * 100)
                  : 0}
                label="Utilisation Stockage"
                status={storageStats.stats?.health_status}
              />
              <QuotaCard />
              <AlertsPanel events={raidData.events || []} loading={raidData.loading} />
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="h-[calc(100vh-14rem)] mt-6">
            <div className="flex h-full rounded-lg border bg-background/50 backdrop-blur-sm overflow-hidden">
              <DriveSidebar
                currentView={driveView}
                onViewChange={setDriveView}
                quota={storageStats.stats ? {
                  used: storageStats.stats.used_bytes,
                  total: storageStats.stats.total_bytes
                } : undefined}
                onNewClick={() => setUploadDialogOpen(true)}
              />

              <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleBreadcrumbClick(-1)}>
                        <Home className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden">
                        {currentBucket ? (
                          <>
                            <ChevronRight className="h-4 w-4 shrink-0" />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto font-medium px-2 py-1">
                                  {currentBucket}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {buckets.map(b => (
                                  <DropdownMenuItem key={b.name} onClick={() => {
                                    setCurrentBucket(b.name);
                                    setCurrentPath([]);
                                  }}>
                                    {b.name}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setBucketDialogOpen(true)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  New Bucket
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {currentPath.map((path, i) => (
                              <div key={i} className="flex items-center gap-1 shrink-0">
                                <ChevronRight className="h-4 w-4 shrink-0" />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto px-2 py-1"
                                  onClick={() => handleBreadcrumbClick(i)}
                                >
                                  {path}
                                </Button>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="ml-2">Select a bucket to start</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <div className="relative w-64 hidden md:block">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search files..."
                        className="pl-9 h-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center border rounded-md p-1">
                      <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setViewMode('list')}
                      >
                        <ListIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    {currentBucket && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="default" size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">New</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setFolderDialogOpen(true)}>
                            <FolderPlus className="mr-2 h-4 w-4" />
                            New Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setUploadDialogOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            File Upload
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setManageTagsOpen(true)}>
                            <Star className="mr-2 h-4 w-4" />
                            Manage Tags
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
                  {currentBucket ? (
                    <DropZone
                      bucket={currentBucket}
                      prefix={currentPath.length > 0 ? currentPath.join('/') : undefined}
                      onUploadComplete={fetchFiles}
                      className="h-full"
                    >
                      {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {[...Array(10)].map((_, i) => (
                            <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
                          ))}
                        </div>
                      ) : displayFiles.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                          <FolderOpen className="h-16 w-16 mb-4" />
                          <p>{search ? 'No files found matching search' : 'Empty folder'}</p>
                          <p className="text-sm">Drag files here or click New</p>
                        </div>
                      ) : (
                        viewMode === 'grid' ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                            {displayFiles.map((file) => (
                              <FileGridItem
                                key={file.key}
                                item={file}
                                onNavigate={() => file.type === 'folder' && handleNavigate(file)}
                                onPreview={() => file.type === 'file' && isPreviewable(file) && handlePreview(file)}
                                onAction={handleAction}
                                viewMode={driveView}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="grid grid-cols-12 px-2 py-2 text-xs font-medium text-muted-foreground border-b mb-2">
                              <div className="col-span-6 ml-9">Name</div>
                              <div className="col-span-3 hidden sm:block">Date modified</div>
                              <div className="col-span-2 hidden sm:block text-right">Size</div>
                              <div className="col-span-1"></div>
                            </div>
                            {displayFiles.map((file) => (
                              <FileListItem
                                key={file.key}
                                item={file}
                                onNavigate={() => file.type === 'folder' && handleNavigate(file)}
                                onPreview={() => file.type === 'file' && isPreviewable(file) && handlePreview(file)}
                                onAction={handleAction}
                                viewMode={driveView}
                              />
                            ))}
                          </div>
                        )
                      )}
                    </DropZone>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                      <div className="p-4 bg-muted/50 rounded-full">
                        <HardDrive className="h-8 w-8" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-lg">No Bucket Selected</h3>
                        <p className="text-sm">Select a bucket from the dropdown to view files.</p>
                      </div>
                      <Button onClick={() => setBucketDialogOpen(true)}>
                        Create Bucket
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Disks Tab */}
          <TabsContent value="disks" className="mt-6">
            <DiskList
              disks={raidData.disks}
              loading={raidData.loading}
              onScan={raidData.scanDisks}
            />
          </TabsContent>

          {/* Mounts Tab */}
          <TabsContent value="mounts" className="mt-6">
            <MountList mounts={mountsData.mounts} loading={mountsData.loading} />
          </TabsContent>

          {/* External Tab */}
          <TabsContent value="external" className="mt-6">
            <ExternalList
              storages={externalData.storages}
              loading={externalData.loading}
              onDetect={externalData.detect}
              onDisconnect={externalData.disconnect}
              onEject={externalData.eject}
            />
          </TabsContent>

          {/* Shares Tab */}
          <TabsContent value="shares" className="mt-6">
            <ShareList
              shares={sharesData.shares}
              loading={sharesData.loading}
              onCreateShare={sharesData.createShare}
              onDeleteShare={sharesData.deleteShare}
              onRefresh={sharesData.refresh}
            />
          </TabsContent>

          {/* RAID Tab */}
          <TabsContent value="raid" className="mt-6">
            <RaidOverview
              arrays={raidData.arrays}
              health={raidData.health}
              loading={raidData.loading}
              onRefresh={raidData.refresh}
              onCreateArray={raidData.createArray}
              onDeleteArray={raidData.deleteArray}
              onRebuildArray={raidData.rebuildArray}
            />
          </TabsContent>
        </Tabs>

        <ManageTagsDialog
          open={manageTagsOpen}
          onOpenChange={setManageTagsOpen}
          onTagsUpdated={fetchFiles}
        />

        {tagFile && tagFile.id && (
          <FileTagsDialog
            open={fileTagsOpen}
            onOpenChange={setFileTagsOpen}
            fileId={tagFile.id}
            fileName={tagFile.name}
            onTagsUpdated={fetchFiles}
          />
        )}

        {historyFile && historyFile.id && (
          <VersionHistoryDialog
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            fileId={historyFile.id}
            fileName={historyFile.name}
            onVersionRestored={fetchFiles}
          />
        )}

        {/* Dialogs */}
        <UploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          bucket={currentBucket}
          onUploadComplete={fetchFiles}
        />

        {/* Rename Dialog */}
        <RenameDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          item={renameItem}
          onRename={handleRenameSubmit}
        />

        {/* Move Dialog */}
        <MoveToDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          item={moveItem}
          currentBucket={currentBucket}
          onMove={handleMoveSubmit}
        />

        {/* File Preview Dialog */}
        <FilePreviewDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          file={previewFile}
          files={files}
          bucket={currentBucket}
          currentPath={currentPath}
          onDownload={handleDownload}
          onNavigate={(newFile) => setPreviewFile(newFile)}
        />

        {/* New Folder Dialog */}
        <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="folderName">Folder Name</Label>
                <Input
                  id="folderName"
                  placeholder="my-folder"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <p className="text-xs text-muted-foreground">
                  {currentPath.length > 0
                    ? `Will be created in: ${currentPath.join('/')}/`
                    : 'Will be created in root directory'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete File Confirmation */}
        <ConfirmDialog
          open={deleteItem !== null}
          onOpenChange={(open) => { if (!open) setDeleteItem(null); }}
          title={driveView === 'trash' ? "Delete Forever" : "Delete File"}
          description={driveView === 'trash'
            ? `Are you sure you want to permanently delete "${deleteItem?.name}"? This action cannot be undone.`
            : `Are you sure you want to delete "${deleteItem?.name}"?`
          }
          onConfirm={() => {
            if (deleteItem) handleDelete(deleteItem);
            setDeleteItem(null);
          }}
        />

        {/* Delete Bucket Confirmation */}
        <ConfirmDialog
          open={deleteBucket !== null}
          onOpenChange={(open) => { if (!open) setDeleteBucket(null); }}
          title="Delete Bucket"
          description={`Delete bucket "${deleteBucket}"? All files in this bucket will be deleted.`}
          onConfirm={() => {
            if (deleteBucket) handleDeleteBucket(deleteBucket);
            setDeleteBucket(null);
          }}
        />

        {/* Permissions Dialog */}
        {permissionsFile && (
          <PermissionsDialog
            open={permissionsDialogOpen}
            onOpenChange={(open) => {
              setPermissionsDialogOpen(open);
              if (!open) setPermissionsFile(null);
            }}
            bucket={currentBucket}
            fileKey={currentPath.length > 0
              ? `${currentPath.join('/')}/${permissionsFile.name}`
              : permissionsFile.name}
            fileName={permissionsFile.name}
          />
        )}

        {/* New Bucket Dialog */}
        <Dialog open={bucketDialogOpen} onOpenChange={setBucketDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Create New Bucket
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bucketName">Bucket Name</Label>
                <Input
                  id="bucketName"
                  placeholder="my-bucket"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBucket()}
                />
                <p className="text-xs text-muted-foreground">
                  Bucket names must be lowercase, contain only letters, numbers, and hyphens.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBucketDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBucket} disabled={creatingBucket || !newBucketName.trim()}>
                {creatingBucket && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Bucket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ShareDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} item={shareItem} />
      </div>
    </AppLayout>
  );
}
