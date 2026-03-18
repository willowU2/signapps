'use client';

/**
 * CreateTemplateDialog
 *
 * Dialog for creating a new template from a document.
 */

import React, { useState } from 'react';
import {
  FileText,
  Table,
  Presentation,
  Briefcase,
  GraduationCap,
  User,
  Megaphone,
  Scale,
  Users,
  Calculator,
  Palette,
  Folder,
  Globe,
  Lock,
  Building2,
  Loader2,
  ImagePlus,
  X,
  Plus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { TemplateCategory, DocumentType, TemplateVisibility } from '@/lib/office/templates/types';
import { TEMPLATE_CATEGORIES, DOCUMENT_TYPE_LABELS } from '@/lib/office/templates/types';

// ============================================================================
// Icons
// ============================================================================

const CATEGORY_ICONS: Record<TemplateCategory, React.ElementType> = {
  business: Briefcase,
  education: GraduationCap,
  personal: User,
  marketing: Megaphone,
  legal: Scale,
  hr: Users,
  finance: Calculator,
  creative: Palette,
  custom: Folder,
};

const DOCUMENT_TYPE_ICONS: Record<DocumentType, React.ElementType> = {
  doc: FileText,
  sheet: Table,
  slide: Presentation,
};

const VISIBILITY_ICONS: Record<TemplateVisibility, React.ElementType> = {
  private: Lock,
  workspace: Users,
  organization: Building2,
  public: Globe,
};

const VISIBILITY_LABELS: Record<TemplateVisibility, { label: string; description: string }> = {
  private: { label: 'Privé', description: 'Visible uniquement par vous' },
  workspace: { label: 'Espace de travail', description: 'Visible par les membres de l\'espace de travail' },
  organization: { label: 'Organisation', description: 'Visible par toute l\'organisation' },
  public: { label: 'Public', description: 'Visible par tous les utilisateurs' },
};

// ============================================================================
// Form Schema
// ============================================================================

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom est trop long'),
  description: z.string().max(500, 'La description est trop longue').optional(),
  category: z.enum([
    'business',
    'education',
    'personal',
    'marketing',
    'legal',
    'hr',
    'finance',
    'creative',
    'custom',
  ] as const),
  documentType: z.enum(['doc', 'sheet', 'slide'] as const),
  visibility: z.enum(['private', 'workspace', 'organization', 'public'] as const),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags'),
});

type CreateTemplateFormData = z.infer<typeof createTemplateSchema>;

// ============================================================================
// Tags Input Component
// ============================================================================

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

function TagsInput({ value, onChange, maxTags = 10 }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const tag = inputValue.trim().toLowerCase();
    if (tag && !value.includes(tag) && value.length < maxTags) {
      onChange([...value, tag]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      {value.length < maxTags && (
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ajouter un tag..."
            className="flex-1"
          />
          <Button type="button" variant="outline" size="icon" onClick={addTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {value.length}/{maxTags} tags
      </p>
    </div>
  );
}

// ============================================================================
// Main Dialog Component
// ============================================================================

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  documentName?: string;
  documentType?: DocumentType;
  onSubmit: (data: CreateTemplateFormData) => Promise<void>;
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  documentType = 'doc',
  onSubmit,
}: CreateTemplateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: documentName ? `${documentName} - Modèle` : '',
      description: '',
      category: 'custom',
      documentType: documentType,
      visibility: 'private',
      tags: [],
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        name: documentName ? `${documentName} - Modèle` : '',
        description: '',
        category: 'custom',
        documentType: documentType,
        visibility: 'private',
        tags: [],
      });
    }
  }, [open, documentName, documentType, form]);

  const handleSubmit = async (data: CreateTemplateFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un modèle</DialogTitle>
          <DialogDescription>
            Créez un modèle réutilisable à partir de ce document.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du modèle</FormLabel>
                      <FormControl>
                        <Input placeholder="Mon modèle" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Décrivez l'utilisation de ce modèle..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Une description claire aide les autres à comprendre quand utiliser ce modèle.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une catégorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TEMPLATE_CATEGORIES).map(([key, { label }]) => {
                            const Icon = CATEGORY_ICONS[key as TemplateCategory];
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Document Type */}
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de document</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => {
                            const Icon = DOCUMENT_TYPE_ICONS[key as DocumentType];
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Visibility */}
                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibilité</FormLabel>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(VISIBILITY_LABELS).map(([key, { label, description }]) => {
                          const Icon = VISIBILITY_ICONS[key as TemplateVisibility];
                          const isSelected = field.value === key;

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => field.onChange(key)}
                              className={cn(
                                'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-muted-foreground/50'
                              )}
                            >
                              <Icon
                                className={cn(
                                  'h-5 w-5 mt-0.5',
                                  isSelected ? 'text-primary' : 'text-muted-foreground'
                                )}
                              />
                              <div>
                                <div className="font-medium text-sm">{label}</div>
                                <div className="text-xs text-muted-foreground">{description}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Tags */}
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <TagsInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormDescription>
                        Ajoutez des tags pour faciliter la recherche.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer le modèle'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTemplateDialog;
