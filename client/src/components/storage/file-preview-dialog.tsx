'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Download, X, FileText, Image as ImageIcon, FileCode, File as FileIcon, FileArchive, Maximize2, Minimize2, ZoomIn, ZoomOut, Video, Music } from 'lucide-react';
import { storageApi } from '@/lib/api';
import { VideoPreview } from './previews/video-preview';
import { ArchivePreview } from './previews/archive-preview';
import { DocumentPreview } from './previews/document-preview';
import { CodePreview } from './previews/code-preview';
import { PDFPreview } from './previews/pdf-preview';
import dynamic from 'next/dynamic';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { CellData } from '@/components/sheets/types';

const Editor = dynamic(
    () => import('@/components/docs/editor'),
    { ssr: false }
);

const Spreadsheet = dynamic(
    () => import("@/components/sheets/spreadsheet").then(m => ({ default: m.Spreadsheet })),
    { ssr: false }
);

const SlidesContent = dynamic(
    () => import("@/components/slides/slides-content").then(m => ({ default: m.SlidesContent })),
    { ssr: false }
);

interface FileItem {
  key: string;
  name: string;
  type: 'folder' | 'file';
  size?: number;
  lastModified?: string;
  contentType?: string;
}

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: FileItem | null;
  files: FileItem[];
  bucket: string;
  currentPath: string[];
  onDownload?: (file: FileItem) => void;
  onNavigate?: (file: FileItem) => void;
}

type PreviewType = 'image' | 'pdf' | 'text' | 'code' | 'markdown' | 'spreadsheet' | 'slides' | 'video' | 'audio' | 'archive' | 'document' | 'unsupported';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
const ARCHIVE_EXTENSIONS = ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'];
const TEXT_EXTENSIONS = ['txt', 'log', 'xml', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'rtf'];
const CODE_EXTENSIONS = ['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'sql', 'html', 'css', 'scss', 'less', 'json', 'toml'];
const MARKDOWN_EXTENSIONS = ['md', 'mdx', 'markdown', 'doc', 'docx', 'odt'];
const SPREADSHEET_EXTENSIONS = ['csv', 'tsv', 'xls', 'xlsx', 'ods'];
const SLIDES_EXTENSIONS = ['ppt', 'pptx', 'odp'];

function getPreviewType(file: FileItem): PreviewType {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';
  const contentType = file.contentType || '';

  if (contentType.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) {
    return 'image';
  }
  if (contentType === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (contentType.startsWith('video/') || VIDEO_EXTENSIONS.includes(ext)) {
    return 'video';
  }
  if (contentType.startsWith('audio/') || AUDIO_EXTENSIONS.includes(ext)) {
    return 'audio';
  }
  if (ARCHIVE_EXTENSIONS.includes(ext)) {
    return 'archive';
  }
  if (MARKDOWN_EXTENSIONS.includes(ext)) {
    return 'markdown';
  }
  if (SPREADSHEET_EXTENSIONS.includes(ext)) {
    return 'spreadsheet';
  }
  if (SLIDES_EXTENSIONS.includes(ext)) {
    return 'slides';
  }
  if (CODE_EXTENSIONS.includes(ext)) {
    return 'code';
  }
  if (contentType.startsWith('text/') || TEXT_EXTENSIONS.includes(ext)) {
    return 'text';
  }

  return 'unsupported';
}

function getPreviewIcon(previewType: PreviewType, size: 'sm' | 'lg' = 'lg') {
  const sizeClass = size === 'sm' ? 'h-5 w-5' : 'h-16 w-16';
  switch (previewType) {
    case 'image':
      return <ImageIcon className={`${sizeClass} text-green-500`} />;
    case 'pdf':
      return <FileText className={`${sizeClass} text-red-500`} />;
    case 'video':
      return <Video className={`${sizeClass} text-orange-500`} />;
    case 'audio':
      return <Music className={`${sizeClass} text-pink-500`} />;
    case 'archive':
      return <FileArchive className={`${sizeClass} text-yellow-500`} />;
    case 'document':
      return <FileText className={`${sizeClass} text-blue-600`} />;
    case 'spreadsheet':
      return <FileText className={`${sizeClass} text-green-600`} />;
    case 'slides':
      return <FileText className={`${sizeClass} text-yellow-600`} />;
    case 'code':
      return <FileCode className={`${sizeClass} text-purple-500`} />;
    case 'text':
    case 'markdown':
      return <FileText className={`${sizeClass} text-blue-500`} />;
    default:
      return <FileIcon className={`${sizeClass} text-gray-500`} />;
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  files,
  bucket,
  currentPath,
  onDownload,
  onNavigate,
}: FilePreviewDialogProps) {
  const [content, setContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [parsedDocsContent, setParsedDocsContent] = useState<string | null>(null);
  const [parsedSheetsData, setParsedSheetsData] = useState<Record<string, CellData> | null>(null);

  // Filter only previewable files
  const previewableFiles = useMemo(() =>
    files.filter(f => f.type === 'file' && getPreviewType(f) !== 'unsupported'),
    [files]
  );

  const currentIndex = useMemo(() =>
    file ? previewableFiles.findIndex(f => f.key === file.key) : -1,
    [file, previewableFiles]
  );

  const previewType = file ? getPreviewType(file) : 'unsupported';

  const loadContent = useCallback(async () => {
    if (!file || !bucket) return;

    // Reset state
    setContent(null);
    setParsedDocsContent(null);
    setParsedSheetsData(null);
    setError(null);
    setZoom(1);

    // Clean up previous blob URL
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }

    const type = getPreviewType(file);
    if (type === 'unsupported') {
      return;
    }

    // Archive and document are metadata-only (no download needed)
    if (type === 'archive' || type === 'document') {
      return;
    }

    setLoading(true);
    try {
      const key = currentPath.length > 0
        ? `${currentPath.join('/')}/${file.name}`
        : file.name;

      const response = await storageApi.download(bucket, key);
      const fileType = file.contentType || 'application/octet-stream';
      const blob = new Blob([response.data], { type: fileType });

      if (type === 'image' || type === 'pdf' || type === 'video' || type === 'audio' || type === 'code') {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } else if (type === 'markdown') {
        if (file.name.toLowerCase().endsWith('.docx')) {
            const arrayBuffer = await blob.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setParsedDocsContent(result.value);
        } else {
            const text = await blob.text();
            setParsedDocsContent(text);
        }
      } else if (type === 'spreadsheet') {
        const arrayBuffer = await blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });
        
        const cellData: Record<string, CellData> = {};
        jsonData.forEach((row, rowIndex) => {
            row.forEach((colValue, colIndex) => {
                if (colValue !== undefined && colValue !== null && colValue !== '') {
                    cellData[`${rowIndex},${colIndex}`] = { value: String(colValue) };
                }
            });
        });
        setParsedSheetsData(cellData);
      } else {
        // Text-based content
        const text = await blob.text();
        setContent(text);
      }
    } catch (err) {
      console.debug("File preview error:", err);
      setError('Impossible de charger le fichier');
    } finally {
      setLoading(false);
    }
  }, [file, bucket, currentPath, blobUrl]);

  useEffect(() => {
    if (open && file) {
      loadContent();
    }
  }, [open, file, loadContent]);

  // Cleanup blob URL on unmount or close
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleClose = useCallback(() => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setContent(null);
    setParsedDocsContent(null);
    setParsedSheetsData(null);
    setError(null);
    setZoom(1);
    setIsFullscreen(false);
    onOpenChange(false);
  }, [blobUrl, onOpenChange]);

  const navigateTo = useCallback((direction: 'prev' | 'next') => {
    if (currentIndex === -1 || !onNavigate) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : previewableFiles.length - 1;
    } else {
      newIndex = currentIndex < previewableFiles.length - 1 ? currentIndex + 1 : 0;
    }

    const newFile = previewableFiles[newIndex];
    if (newFile) {
      // Clean up current blob URL before navigating
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setContent(null);
      onNavigate(newFile);
    }
  }, [currentIndex, previewableFiles, onNavigate, blobUrl]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowLeft':
        navigateTo('prev');
        break;
      case 'ArrowRight':
        navigateTo('next');
        break;
      case 'Escape':
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          handleClose();
        }
        break;
      case '+':
      case '=':
        if (previewType === 'image') {
          setZoom(z => Math.min(z + 0.25, 3));
        }
        break;
      case '-':
        if (previewType === 'image') {
          setZoom(z => Math.max(z - 0.25, 0.25));
        }
        break;
    }
  }, [open, isFullscreen, previewType, navigateTo, handleClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!file) return null;

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[300px]">
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
          {getPreviewIcon(previewType)}
          <p className="mt-4">{error}</p>
        </div>
      );
    }

    switch (previewType) {
      case 'image':
        return blobUrl ? (
          <div className="flex items-center justify-center overflow-auto max-h-[70vh]">
            <img
              src={blobUrl}
              alt={file.name}
              className="max-w-full object-contain transition-transform"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        ) : null;

      case 'pdf':
        return blobUrl ? (
          <PDFPreview
            src={blobUrl}
            className="h-[70vh]"
            downloadFilename={file.name}
            showDownload={true}
            showSearch={true}
          />
        ) : null;

      case 'text':
        return content !== null ? (
          <div className="max-h-[70vh] overflow-auto">
            <pre className="p-4 bg-muted rounded-lg text-sm font-mono whitespace-pre-wrap break-words">
              {content}
            </pre>
          </div>
        ) : null;

      case 'code':
        return blobUrl ? (
          <div className="max-h-[70vh] overflow-auto">
            <CodePreview src={blobUrl} fileName={file.name} fileType={file.contentType} />
          </div>
        ) : null;

      case 'markdown':
        return (
          <div className="w-full h-[75vh] border rounded-lg overflow-hidden bg-background dark:bg-[#1f1f1f] relative">
            {parsedDocsContent !== null ? (
                <Editor documentId={file.key.replace(/[/.]/g, '-')} initialContent={parsedDocsContent} className="h-full" />
            ) : (
                <div className="flex items-center justify-center h-full"><SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" /></div>
            )}
          </div>
        );

      case 'spreadsheet':
        return (
          <div className="w-full h-[75vh] border rounded-lg overflow-hidden bg-background dark:bg-[#1f1f1f] relative">
            {parsedSheetsData !== null ? (
                <Spreadsheet documentId={file.key.replace(/[/.]/g, '-')} initialData={parsedSheetsData} />
            ) : (
               <div className="flex items-center justify-center h-full"><SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" /></div>
            )}
          </div>
        );

      case 'slides':
        return (
          <div className="w-full h-[75vh] border rounded-lg overflow-hidden bg-background relative">
            <SlidesContent />
          </div>
        );

      case 'video':
        return blobUrl ? (
          <VideoPreview src={blobUrl} fileName={file.name} />
        ) : null;

      case 'audio':
        return blobUrl ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Music className="h-16 w-16 text-pink-500" />
            <p className="font-medium">{file.name}</p>
            <audio controls src={blobUrl} className="w-full max-w-md" />
          </div>
        ) : null;

      case 'archive':
        return <ArchivePreview fileName={file.name} bucket={bucket} fileKey={file.key} />;

      case 'document':
        return <DocumentPreview fileName={file.name} bucket={bucket} fileKey={file.key} />;

      case 'unsupported':
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
            {getPreviewIcon(previewType)}
            <p className="mt-4">Apercu non disponible pour ce type de fichier</p>
            <p className="text-sm">Vous pouvez telecharger le fichier pour le visualiser</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={`${isFullscreen ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]' : 'max-w-4xl max-h-[90vh]'}`}
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {getPreviewIcon(previewType, 'sm')}
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{file.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)}
                {file.lastModified && ` - ${file.lastModified}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {previewType === 'image' && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                  disabled={zoom <= 0.25}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            {onDownload && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDownload(file)}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative">
          {renderPreview()}

          {/* Navigation arrows */}
          {previewableFiles.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                onClick={() => navigateTo('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                onClick={() => navigateTo('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* File counter */}
        {previewableFiles.length > 1 && currentIndex !== -1 && (
          <div className="flex justify-center">
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {previewableFiles.length}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
