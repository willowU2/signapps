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
} from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { storageApi, favoritesApi } from '@/lib/api';
import { UploadDialog } from '@/components/storage/upload-dialog';
import { FilePreviewDialog } from '@/components/storage/file-preview-dialog';
import { FolderTree } from '@/components/storage/folder-tree';
import { PermissionsDialog } from '@/components/storage/permissions-dialog';
import { DropZone } from '@/components/storage/drop-zone';
import { FavoritesBar } from '@/components/storage/favorites-bar';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toast } from 'sonner';

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

interface FileItem {
  key: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  lastModified?: string;
  contentType?: string;
}

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
      const bucketList = response.data || [];
      setBuckets(bucketList.map((b) => ({ name: b.name, creationDate: b.created_at })));
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
    if (!currentBucket) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const prefix = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
      const response = await storageApi.listFiles(currentBucket, prefix);
      const fileList = (response.data || []).map((f) => ({
        key: f.key,
        name: f.key.split('/').filter(Boolean).pop() || f.key,
        type: (f.is_directory || f.key.endsWith('/')) ? 'folder' as const : 'file' as const,
        size: f.size,
        lastModified: f.last_modified,
        contentType: f.content_type,
      }));
      setFiles(fileList);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [currentBucket, currentPath]);

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
      const key = currentPath.length > 0
        ? `${currentPath.join('/')}/${item.name}`
        : item.name;
      await storageApi.deleteFile(currentBucket, key);
      fetchFiles();
    } catch {
      // ignore
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

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

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
          <TabsContent value="files" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setFolderDialogOpen(true)} disabled={!currentBucket}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </Button>
                <Button onClick={() => setUploadDialogOpen(true)} disabled={!currentBucket}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </div>
            </div>

            {/* Bucket Selector & Breadcrumb */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[150px] justify-between">
                      {currentBucket || 'Select bucket'}
                      <ChevronRight className="ml-2 h-4 w-4 rotate-90" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px]">
                    {buckets.map((bucket) => (
                      <DropdownMenuItem
                        key={bucket.name}
                        className="flex items-center justify-between"
                        onClick={() => {
                          setCurrentBucket(bucket.name);
                          setCurrentPath([]);
                        }}
                      >
                        <span className={currentBucket === bucket.name ? 'font-medium' : ''}>
                          {bucket.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteBucket(bucket.name);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                    {buckets.length === 0 && (
                      <DropdownMenuItem disabled>No buckets</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="icon" onClick={() => setBucketDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1 text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handleBreadcrumbClick(-1)}
                >
                  <Home className="h-4 w-4" />
                </Button>
                {currentPath.map((path, i) => (
                  <span key={i} className="flex items-center">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleBreadcrumbClick(i)}
                    >
                      {path}
                    </Button>
                  </span>
                ))}
              </div>
            </div>

            {/* Folder Tree + File List */}
            <div className="flex gap-4">
              {/* Folder Tree Sidebar */}
              {currentBucket && (
                <div className="w-56 shrink-0 space-y-4">
                  <Card>
                    <CardHeader className="py-3 px-3">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Folders</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0 max-h-[400px] overflow-y-auto">
                      <FolderTree
                        bucket={currentBucket}
                        currentPath={currentPath.length > 0 ? currentPath.join('/') + '/' : ''}
                        onSelectFolder={(path) => {
                          const parts = path.replace(/\/$/, '').split('/').filter(Boolean);
                          setCurrentPath(parts);
                        }}
                      />
                    </CardContent>
                  </Card>
                  <FavoritesBar />
                </div>
              )}

              {/* Main file area */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Search */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search files..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Drop Zone for drag-and-drop uploads */}
                {currentBucket && (
                  <DropZone
                    bucket={currentBucket}
                    prefix={currentPath.length > 0 ? currentPath.join('/') : undefined}
                    onUploadComplete={fetchFiles}
                  />
                )}

                {/* File List */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground">
                      <div className="col-span-6">Name</div>
                      <div className="col-span-2">Size</div>
                      <div className="col-span-3">Modified</div>
                      <div className="col-span-1"></div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loading ? (
                      <div className="space-y-2 p-4">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12" />
                        ))}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredFiles.map((file) => (
                          <div
                            key={file.key}
                            className="group grid grid-cols-12 items-center py-3 px-6 hover:bg-muted/50 cursor-pointer"
                            onClick={() => file.type === 'folder' && handleNavigate(file)}
                            onDoubleClick={() => file.type === 'file' && isPreviewable(file) && handlePreview(file)}
                          >
                            <div className="col-span-6 flex items-center gap-3">
                              {getFileIcon(file)}
                              <span className="font-medium truncate">{file.name}</span>
                              {file.type === 'file' && isPreviewable(file) && (
                                <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                            <div className="col-span-2 text-sm text-muted-foreground">
                              {file.type === 'folder' ? '-' : formatSize(file.size)}
                            </div>
                            <div className="col-span-3 text-sm text-muted-foreground">
                              {file.lastModified || '-'}
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {file.type === 'file' && isPreviewable(file) && (
                                    <DropdownMenuItem onClick={() => handlePreview(file)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Apercu
                                    </DropdownMenuItem>
                                  )}
                                  {file.type === 'file' && (
                                    <DropdownMenuItem onClick={() => handleDownload(file)}>
                                      <Download className="mr-2 h-4 w-4" />
                                      Telecharger
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleAddToFavorites(file)}>
                                    <Star className="mr-2 h-4 w-4" />
                                    Ajouter aux favoris
                                  </DropdownMenuItem>
                                  {file.type === 'file' && (
                                    <DropdownMenuItem onClick={() => {
                                      setPermissionsFile(file);
                                      setPermissionsDialogOpen(true);
                                    }}>
                                      <Lock className="mr-2 h-4 w-4" />
                                      Permissions
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteItem(file)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}

                        {filteredFiles.length === 0 && (
                          <div className="py-12 text-center text-muted-foreground">
                            No files found
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
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

        {/* Dialogs */}
        <UploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          bucket={currentBucket}
          onUploadComplete={fetchFiles}
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
          title="Delete File"
          description={`Are you sure you want to delete "${deleteItem?.name}"?`}
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
      </div>
    </AppLayout>
  );
}
