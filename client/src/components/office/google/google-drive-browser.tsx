'use client';

/**
 * GoogleDriveBrowser
 *
 * Component for browsing and selecting files from Google Drive.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Cloud,
  Folder,
  FileText,
  Table,
  Presentation,
  ArrowLeft,
  Search,
  Star,
  Clock,
  Upload,
  Download,
  RefreshCw,
  MoreHorizontal,
  ChevronRight,
  Loader2,
  Link2,
  LogOut,
  Settings,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';
import { useGoogleStore } from '@/stores/google-store';
import type { GoogleDriveFile } from '@/lib/office/google/types';
import { GOOGLE_MIME_TYPE_LABELS } from '@/lib/office/google/types';

// ============================================================================
// Icons for file types
// ============================================================================

function getFileIcon(mimeType: string) {
  if (mimeType.includes('folder')) {
    return <Folder className="h-5 w-5 text-amber-500" />;
  }
  if (mimeType.includes('document') || mimeType.includes('word')) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet')) {
    return <Table className="h-5 w-5 text-green-500" />;
  }
  if (mimeType.includes('presentation') || mimeType.includes('slide')) {
    return <Presentation className="h-5 w-5 text-orange-500" />;
  }
  return <FileText className="h-5 w-5 text-gray-500" />;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// File Item Component
// ============================================================================

interface FileItemProps {
  file: GoogleDriveFile;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onImport?: () => void;
}

function FileItem({ file, isSelected, onSelect, onOpen, onImport }: FileItemProps) {
  const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
  const isGoogleDoc =
    file.mimeType.startsWith('application/vnd.google-apps.') && !isFolder;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:bg-muted/50'
      )}
      onClick={() => (isFolder ? onOpen() : onSelect())}
      onDoubleClick={isFolder ? onOpen : onImport}
    >
      {/* Selection checkbox */}
      {!isFolder && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Icon/Thumbnail */}
      <div className="flex-shrink-0">
        {file.thumbnailLink && !isFolder ? (
          <img
            src={file.thumbnailLink}
            alt=""
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
            {getFileIcon(file.mimeType)}
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{file.name}</span>
          {file.starred && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
          {isGoogleDoc && (
            <Badge variant="secondary" className="text-xs">
              Google
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span>{GOOGLE_MIME_TYPE_LABELS[file.mimeType] || 'Fichier'}</span>
          <span>·</span>
          <span>{formatFileSize(file.size)}</span>
          <span>·</span>
          <span>
            {formatDistanceToNow(new Date(file.modifiedTime), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
        </div>
      </div>

      {/* Actions */}
      {isFolder ? (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onImport}>
              <Download className="mr-2 h-4 w-4" />
              Importer
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open(file.webViewLink, '_blank')}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Ouvrir dans Google
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ============================================================================
// Connection Prompt Component
// ============================================================================

interface ConnectionPromptProps {
  onConnect: () => void;
  isLoading: boolean;
  error?: string | null;
}

function ConnectionPrompt({ onConnect, isLoading, error }: ConnectionPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <Cloud className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Connectez-vous à Google Drive</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Importez vos documents depuis Google Drive ou exportez vos fichiers vers votre espace Google.
      </p>
      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}
      <Button onClick={onConnect} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Cloud className="mr-2 h-4 w-4" />
        )}
        Se connecter à Google
      </Button>
    </div>
  );
}

// ============================================================================
// Main Browser Component
// ============================================================================

interface GoogleDriveBrowserProps {
  onImport: (files: GoogleDriveFile[]) => void;
  onCancel?: () => void;
  multiSelect?: boolean;
  className?: string;
}

export function GoogleDriveBrowser({
  onImport,
  onCancel,
  multiSelect = true,
  className,
}: GoogleDriveBrowserProps) {
  const {
    auth,
    driveFiles,
    recentFiles,
    isLoadingFiles,
    isAuthLoading,
    authError,
    currentFolderId,
    hasMoreFiles,
    error,
    checkAuthStatus,
    initiateAuth,
    disconnect,
    listFiles,
    loadMoreFiles,
    loadRecentFiles,
    searchFiles,
    navigateToFolder,
    clearError,
  } = useGoogleStore();

  const [selectedFiles, setSelectedFiles] = useState<GoogleDriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderPath, setFolderPath] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Mon Drive' },
  ]);

  // Initialize
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Load files when connected
  useEffect(() => {
    if (auth.isConnected && !currentFolderId) {
      listFiles();
      loadRecentFiles();
    }
  }, [auth.isConnected, listFiles, loadRecentFiles, currentFolderId]);

  const handleConnect = async () => {
    const authUrl = await initiateAuth();
    if (authUrl) {
      window.open(authUrl, '_blank', 'width=600,height=700');
    }
  };

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      searchFiles(searchQuery.trim());
    } else {
      listFiles(currentFolderId ?? undefined, true);
    }
  }, [searchQuery, currentFolderId, searchFiles, listFiles]);

  const handleOpenFolder = (folder: GoogleDriveFile) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    navigateToFolder(folder.id);
  };

  const handleNavigateToPath = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    navigateToFolder(newPath[newPath.length - 1].id);
  };

  const handleSelectFile = (file: GoogleDriveFile) => {
    if (multiSelect) {
      const isSelected = selectedFiles.some((f) => f.id === file.id);
      if (isSelected) {
        setSelectedFiles(selectedFiles.filter((f) => f.id !== file.id));
      } else {
        setSelectedFiles([...selectedFiles, file]);
      }
    } else {
      setSelectedFiles([file]);
    }
  };

  const handleImport = () => {
    if (selectedFiles.length > 0) {
      onImport(selectedFiles);
    }
  };

  if (!auth.isConnected) {
    return (
      <div className={className}>
        <ConnectionPrompt
          onConnect={handleConnect}
          isLoading={isAuthLoading}
          error={authError}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <Cloud className="h-5 w-5 text-blue-500" />
          <h2 className="font-semibold">Google Drive</h2>
        </div>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={auth.picture} />
            <AvatarFallback>{auth.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {auth.name}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">{auth.email}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={disconnect} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans Drive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => listFiles(currentFolderId ?? undefined, true)}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center px-4 py-2 border-b bg-muted/30">
        <Breadcrumb>
          <BreadcrumbList>
            {folderPath.map((folder, index) => (
              <React.Fragment key={folder.id ?? 'root'}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  <BreadcrumbLink
                    onClick={() => handleNavigateToPath(index)}
                    className="cursor-pointer hover:text-foreground"
                  >
                    {index === 0 && <Cloud className="mr-1 h-4 w-4 inline" />}
                    {folder.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Files List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {isLoadingFiles && driveFiles.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Folder className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Ce dossier est vide</p>
            </div>
          ) : (
            <>
              {driveFiles.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  isSelected={selectedFiles.some((f) => f.id === file.id)}
                  onSelect={() => handleSelectFile(file)}
                  onOpen={() => handleOpenFolder(file)}
                  onImport={() => {
                    setSelectedFiles([file]);
                    onImport([file]);
                  }}
                />
              ))}

              {hasMoreFiles && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreFiles}
                    disabled={isLoadingFiles}
                  >
                    {isLoadingFiles ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between border-t p-4">
        <span className="text-sm text-muted-foreground">
          {selectedFiles.length > 0
            ? `${selectedFiles.length} fichier${selectedFiles.length > 1 ? 's' : ''} sélectionné${selectedFiles.length > 1 ? 's' : ''}`
            : 'Sélectionnez des fichiers à importer'}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button onClick={handleImport} disabled={selectedFiles.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Importer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GoogleDriveBrowser;
