'use client';

/**
 * TemplatePreview
 *
 * Preview modal/sheet for viewing template details and applying it.
 */

import React, { useState } from 'react';
import {
  FileText,
  Table,
  Presentation,
  Star,
  Clock,
  User,
  Heart,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Template, TemplateVariable, DocumentType } from '@/lib/office/templates/types';
import { TEMPLATE_CATEGORIES, DOCUMENT_TYPE_LABELS } from '@/lib/office/templates/types';

// ============================================================================
// Icons
// ============================================================================

const DOCUMENT_TYPE_ICONS: Record<DocumentType, React.ElementType> = {
  doc: FileText,
  sheet: Table,
  slide: Presentation,
};

// ============================================================================
// Variable Input Component
// ============================================================================

interface VariableInputProps {
  variable: TemplateVariable;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}

function VariableInput({ variable, value, onChange }: VariableInputProps) {
  const id = `var-${variable.key}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1">
        {variable.label}
        {variable.required && <span className="text-destructive">*</span>}
      </Label>

      {variable.type === 'text' && (
        <Input
          id={id}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={variable.label}
        />
      )}

      {variable.type === 'number' && (
        <Input
          id={id}
          type="number"
          value={value as number}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}

      {variable.type === 'date' && (
        <Input
          id={id}
          type="date"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {variable.type === 'select' && variable.options && (
        <select
          id={id}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">Sélectionner...</option>
          {variable.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {variable.type === 'boolean' && (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor={id} className="font-normal">
            {variable.label}
          </Label>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Preview Images Component
// ============================================================================

interface PreviewImagesProps {
  images: string[];
  thumbnailUrl?: string;
}

function PreviewImages({ images, thumbnailUrl }: PreviewImagesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const allImages = thumbnailUrl ? [thumbnailUrl, ...images] : images;

  if (allImages.length === 0) {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
        <FileText className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
        <img
          src={allImages[currentIndex]}
          alt={`Aperçu ${currentIndex + 1}`}
          className="w-full h-full object-contain"
        />

        {allImages.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setCurrentIndex((i) => (i - 1 + allImages.length) % allImages.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setCurrentIndex((i) => (i + 1) % allImages.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {allImages.length > 1 && (
        <div className="flex gap-2 justify-center">
          {allImages.map((_, index) => (
            <button
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                index === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Preview Component (Sheet)
// ============================================================================

interface TemplatePreviewProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (
    templateId: string,
    documentName: string,
    variableValues: Record<string, string | number | boolean>
  ) => Promise<void>;
  onFavorite?: (templateId: string) => void;
  isFavorite?: boolean;
  isApplying?: boolean;
}

export function TemplatePreview({
  template,
  open,
  onOpenChange,
  onApply,
  onFavorite,
  isFavorite = false,
  isApplying = false,
}: TemplatePreviewProps) {
  const [documentName, setDocumentName] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string | number | boolean>>({});
  const [showVariableDialog, setShowVariableDialog] = useState(false);

  // Reset state when template changes
  React.useEffect(() => {
    if (template) {
      setDocumentName(template.name);
      const initialValues: Record<string, string | number | boolean> = {};
      template.content.variables?.forEach((v) => {
        if (v.defaultValue !== undefined) {
          initialValues[v.key] = v.defaultValue;
        }
      });
      setVariableValues(initialValues);
    }
  }, [template]);

  if (!template) return null;

  const DocIcon = DOCUMENT_TYPE_ICONS[template.documentType];
  const hasVariables = template.content.variables && template.content.variables.length > 0;

  const handleApplyClick = () => {
    if (hasVariables) {
      setShowVariableDialog(true);
    } else {
      handleApply();
    }
  };

  const handleApply = async () => {
    await onApply(template.id, documentName || template.name, variableValues);
    setShowVariableDialog(false);
    onOpenChange(false);
  };

  const validateVariables = () => {
    if (!template.content.variables) return true;
    return template.content.variables
      .filter((v) => v.required)
      .every((v) => {
        const value = variableValues[v.key];
        return value !== undefined && value !== '' && value !== null;
      });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[500px] sm:max-w-[500px] p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <DocIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-left truncate">{template.name}</SheetTitle>
                <SheetDescription className="text-left">
                  {DOCUMENT_TYPE_LABELS[template.documentType]}
                </SheetDescription>
              </div>
              {onFavorite && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onFavorite(template.id)}
                >
                  <Heart
                    className={cn(
                      'h-5 w-5',
                      isFavorite && 'fill-red-500 text-red-500'
                    )}
                  />
                </Button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 space-y-6">
              {/* Preview Images */}
              <PreviewImages
                images={template.previewImages || []}
                thumbnailUrl={template.thumbnailUrl}
              />

              {/* Description */}
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{template.createdByName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {formatDistanceToNow(new Date(template.updatedAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Download className="h-4 w-4" />
                  <span>{template.usageCount} utilisations</span>
                </div>
                {template.rating && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>
                      {template.rating.toFixed(1)} ({template.ratingCount} avis)
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Name Input */}
              <div className="space-y-2">
                <Label htmlFor="doc-name">Nom du document</Label>
                <Input
                  id="doc-name"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Mon document"
                />
              </div>

              {/* Variables Preview */}
              {hasVariables && (
                <div className="space-y-2">
                  <Label>Variables à remplir</Label>
                  <div className="text-sm text-muted-foreground">
                    Ce modèle contient {template.content.variables!.length} variable(s) à
                    personnaliser.
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="p-6 pt-4 border-t space-y-3">
            <Button className="w-full" onClick={handleApplyClick} disabled={isApplying}>
              {isApplying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Utiliser ce modèle
                </>
              )}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Variables Dialog */}
      {hasVariables && (
        <Dialog open={showVariableDialog} onOpenChange={setShowVariableDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Personnaliser le modèle</DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous pour personnaliser votre document.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4">
                {template.content.variables!.map((variable) => (
                  <VariableInput
                    key={variable.key}
                    variable={variable}
                    value={variableValues[variable.key] ?? variable.defaultValue ?? ''}
                    onChange={(value) =>
                      setVariableValues((prev) => ({ ...prev, [variable.key]: value }))
                    }
                  />
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVariableDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleApply} disabled={!validateVariables() || isApplying}>
                {isApplying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer le document'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default TemplatePreview;
