'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, Minimize2, Download, Search, FileWarning, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Required CSS for text layer and annotations
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PDFPreviewProps {
  /** URL or base64 data of the PDF file */
  src: string;
  /** Callback when PDF is successfully loaded */
  onLoadSuccess?: (numPages: number) => void;
  /** Callback when text is selected */
  onTextSelect?: (text: string) => void;
  /** Show search bar */
  showSearch?: boolean;
  /** Initial zoom level (0.25 to 4) */
  initialZoom?: number;
  /** ClassName for the container */
  className?: string;
  /** Show download button */
  showDownload?: boolean;
  /** Download filename */
  downloadFilename?: string;
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function PDFPreview({
  src,
  onLoadSuccess,
  onTextSelect,
  showSearch = true,
  initialZoom = 1,
  className,
  showDownload = true,
  downloadFilename = 'document.pdf',
}: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(initialZoom);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageInputValue, setPageInputValue] = useState('1');

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Handle document load success
  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoading(false);
      setError(null);
      onLoadSuccess?.(numPages);
    },
    [onLoadSuccess]
  );

  // Handle document load error
  const handleLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err);
    setLoading(false);
    setError('Impossible de charger le document PDF. Le fichier est peut-être corrompu ou dans un format non supporté.');
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)));
  }, []);

  // Page navigation
  const goToPage = useCallback(
    (page: number) => {
      if (numPages && page >= 1 && page <= numPages) {
        setCurrentPage(page);
        setPageInputValue(String(page));
        // Scroll to page
        const pageEl = pageRefs.current.get(page);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [numPages]
  );

  const nextPage = useCallback(() => {
    if (numPages && currentPage < numPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, numPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  // Handle page input
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page)) {
      goToPage(page);
    }
  };

  // Rotation
  const rotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          nextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prevPage();
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Focus search
            const searchInput = document.querySelector('[data-pdf-search]') as HTMLInputElement;
            searchInput?.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, zoomIn, zoomOut]);

  // Handle text selection for callback
  useEffect(() => {
    if (!onTextSelect) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        onTextSelect(selection.toString());
      }
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [onTextSelect]);

  // Download handler
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = downloadFilename;
    link.click();
  }, [src, downloadFilename]);

  // Render loading state
  if (loading && !numPages) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-primary" />
        <p className="text-sm text-muted-foreground">Chargement du document...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 p-4">
        <FileWarning className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <p className="font-medium text-destructive">Erreur de chargement</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col bg-background border rounded-lg overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50 rounded-none border-0',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/50 flex-wrap">
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevPage}
            disabled={currentPage <= 1}
            title="Page précédente (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <Input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              className="w-12 h-8 text-center text-sm"
              aria-label="Numéro de page"
            />
            <span className="text-sm text-muted-foreground">/ {numPages || '-'}</span>
          </form>

          <Button
            variant="ghost"
            size="icon"
            onClick={nextPage}
            disabled={!numPages || currentPage >= numPages}
            title="Page suivante (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom arrière (Ctrl+-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <select
            value={zoom}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="h-8 px-2 text-sm border rounded bg-background"
            aria-label="Niveau de zoom"
          >
            {ZOOM_LEVELS.map((level) => (
              <option key={level} value={level}>
                {Math.round(level * 100)}%
              </option>
            ))}
          </select>

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom avant (Ctrl++)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={rotate}
            title="Rotation (90°)"
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {showDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              title="Télécharger"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Search */}
        {showSearch && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-pdf-search
                type="search"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-40 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto p-4 bg-muted dark:bg-gray-900">
        <Document
          file={src}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading={
            <div className="flex items-center justify-center h-64">
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-primary" />
            </div>
          }
          className="flex flex-col items-center gap-4"
        >
          {numPages &&
            Array.from({ length: numPages }, (_, index) => (
              <div
                key={`page_${index + 1}`}
                ref={(el) => {
                  if (el) pageRefs.current.set(index + 1, el);
                }}
                className="relative shadow-lg bg-card"
              >
                {/* Page number indicator */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                  Page {index + 1}
                </div>
                <Page
                  pageNumber={index + 1}
                  scale={zoom}
                  rotate={rotation}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="max-w-full"
                  loading={
                    <div className="flex items-center justify-center h-32 w-64">
                      <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-6 w-6  text-muted-foreground" />
                    </div>
                  }
                  // Highlight search terms - cast needed because react-pdf types are strict
                  customTextRenderer={
                    searchTerm
                      ? (({ str }: { str: string }) => {
                          if (!searchTerm) return str;
                          const parts = str.split(new RegExp(`(${searchTerm})`, 'gi'));
                          return parts.map((part, i) =>
                            part.toLowerCase() === searchTerm.toLowerCase() ? (
                              <mark key={i} className="bg-yellow-300 text-foreground">
                                {part}
                              </mark>
                            ) : (
                              part
                            )
                          );
                        }) as unknown as (textItem: { str: string }) => string
                      : undefined
                  }
                />
              </div>
            ))}
        </Document>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          {numPages ? `${numPages} page${numPages > 1 ? 's' : ''}` : 'Chargement...'}
        </span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span>
          Utilisez les flèches ← → pour naviguer
        </span>
      </div>
    </div>
  );
}

/**
 * Compact PDF thumbnail preview for file lists
 */
interface PDFThumbnailProps {
  src: string;
  className?: string;
  onClick?: () => void;
}

export function PDFThumbnail({ src, className, onClick }: PDFThumbnailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div
      className={cn(
        'relative w-full aspect-[3/4] bg-muted rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all',
        className
      )}
      onClick={onClick}
    >
      <Document
        file={src}
        onLoadSuccess={() => setLoading(false)}
        onLoadError={() => {
          setLoading(false);
          setError(true);
        }}
        loading={null}
      >
        {!error && (
          <Page
            pageNumber={1}
            width={150}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        )}
      </Document>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <FileWarning className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
