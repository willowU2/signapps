'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

import { previewApi } from '@/lib/api';

interface DocumentPreviewProps {
  fileName: string;
  fileType?: string;
  bucket?: string;
  fileKey?: string;
}

/**
 * DocumentPreview - Affiche les métadonnées des documents (Word, Excel, etc.).
 *
 * Note: Pour un vrai support des documents, il faudrait :
 * - Un backend qui convertit les documents en PDF/HTML
 * - LibreOffice en headless mode
 * - Apache PDFBox
 *
 * Pour l'instant, c'est un placeholder qui affiche les métadonnées.
 */
export function DocumentPreview({
  fileName,
  fileType,
  bucket,
  fileKey,
}: DocumentPreviewProps) {
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bucket || !fileKey) {
      setLoading(false);
      return;
    }

    previewApi.getDocumentMetadata(bucket, fileKey)
      .then(res => {
        setMetadata(res.data);
      })
      .catch(err => {
        console.error("Failed to load document metadata", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bucket, fileKey]);

  const getDocumentType = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      'doc': 'Microsoft Word 97-2003',
      'docx': 'Microsoft Word',
      'xls': 'Microsoft Excel 97-2003',
      'xlsx': 'Microsoft Excel',
      'ppt': 'Microsoft PowerPoint 97-2003',
      'pptx': 'Microsoft PowerPoint',
      'odt': 'OpenDocument Text',
      'ods': 'OpenDocument Spreadsheet',
      'odp': 'OpenDocument Presentation',
      'pdf': 'Portable Document Format',
      'txt': 'Texte brut',
    };
    return typeMap[ext] || ext.toUpperCase();
  };

  const isOfficeDocument = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
  };

  const publicUrl = bucket && fileKey ? previewApi.getPreviewUrl(bucket, fileKey) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Document Info */}
      <div className="bg-muted p-4 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <div>
            <p className="font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {getDocumentType()}
            </p>
          </div>
        </div>
      </div>

      {/* Metadata (if available) */}
      {metadata && (
        <div className="border rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">Propriétés</h4>
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key} className="grid grid-cols-2 gap-4 text-sm py-1">
              <span className="text-muted-foreground">{key}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Info message or Iframe */}
      {metadata && !isOfficeDocument() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            La prévisualisation native de ce document n'est pas disponible.
            Téléchargez le fichier pour l'ouvrir.
          </p>
        </div>
      )}

      {/* Office Viewer Iframe */}
      {isOfficeDocument() && publicUrl && (
        <div className="w-full h-[60vh] border rounded-lg overflow-hidden bg-background">
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`}
            width="100%"
            height="100%"
            frameBorder="0"
            title="Office Document Preview"
            onError={() => {
              // Si le viewer ne peut pas charger (ex: localhost)
              console.debug("Office Web Viewer ne peut pas accéder à une URL locale.");
            }}
          />
        </div>
      )}
      
      {isOfficeDocument() && !publicUrl && (
         <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            La prévisualisation nécessite une URL publique pour le document Office.
            (Le viewer Microsoft ne fonctionne pas sur localhost).
          </p>
        </div>
      )}
    </div>
  );
}
