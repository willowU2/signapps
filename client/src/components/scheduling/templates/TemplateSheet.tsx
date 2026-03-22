'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * TemplateSheet Component
 *
 * Sheet for creating and editing event templates.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { EventTemplate, CreateTemplateInput } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Schema
// ============================================================================

const templateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  category: z.string().optional(),
  eventDefaults: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    duration: z.number().min(5, 'Minimum 5 minutes').max(480, 'Maximum 8 heures'),
    allDay: z.boolean().optional(),
    color: z.string().optional(),
    location: z.string().optional(),
    reminderMinutes: z.number().optional(),
  }),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

// ============================================================================
// Props
// ============================================================================

interface TemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: EventTemplate | null;
  onSave: (input: CreateTemplateInput) => void;
  onDelete?: (templateId: string) => void;
  isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = [
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#22c55e', label: 'Vert' },
  { value: '#eab308', label: 'Jaune' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ef4444', label: 'Rouge' },
  { value: '#a855f7', label: 'Violet' },
  { value: '#ec4899', label: 'Rose' },
  { value: '#6b7280', label: 'Gris' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 heure' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2 heures' },
  { value: 180, label: '3 heures' },
  { value: 240, label: '4 heures' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'Aucun' },
  { value: 5, label: '5 minutes avant' },
  { value: 15, label: '15 minutes avant' },
  { value: 30, label: '30 minutes avant' },
  { value: 60, label: '1 heure avant' },
  { value: 1440, label: '1 jour avant' },
];

const CATEGORY_OPTIONS = [
  { value: 'meeting', label: 'Réunion' },
  { value: 'call', label: 'Appel' },
  { value: 'work', label: 'Travail' },
  { value: 'personal', label: 'Personnel' },
  { value: 'focus', label: 'Focus' },
  { value: 'other', label: 'Autre' },
];

// ============================================================================
// Component
// ============================================================================

export function TemplateSheet({
  open,
  onOpenChange,
  template,
  onSave,
  onDelete,
  isLoading = false,
}: TemplateSheetProps) {
  const isEdit = !!template;

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      eventDefaults: {
        title: '',
        description: '',
        duration: 60,
        allDay: false,
        color: '#3b82f6',
        location: '',
        reminderMinutes: 15,
      },
    },
  });

  // Reset form when template changes
  React.useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || '',
        category: template.category || '',
        eventDefaults: {
          title: template.eventDefaults.title || '',
          description: template.eventDefaults.description || '',
          duration: template.eventDefaults.duration,
          allDay: template.eventDefaults.allDay || false,
          color: template.eventDefaults.color || '#3b82f6',
          location: template.eventDefaults.location || '',
          reminderMinutes: template.eventDefaults.reminderMinutes ?? 15,
        },
      });
    } else {
      form.reset({
        name: '',
        description: '',
        category: '',
        eventDefaults: {
          title: '',
          description: '',
          duration: 60,
          allDay: false,
          color: '#3b82f6',
          location: '',
          reminderMinutes: 15,
        },
      });
    }
  }, [template, form]);

  const handleSubmit = (values: TemplateFormValues) => {
    onSave({
      name: values.name,
      description: values.description,
      category: values.category,
      eventDefaults: {
        ...values.eventDefaults,
        reminderMinutes: values.eventDefaults.reminderMinutes || undefined,
      },
    });
  };

  const handleDelete = () => {
    if (template && onDelete) {
      onDelete(template.id);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Modifier le modèle' : 'Nouveau modèle'}</SheetTitle>
          <SheetDescription>
            Les modèles permettent de créer rapidement des événements similaires.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
            {/* Template Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du modèle *</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Réunion d'équipe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Template Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description du modèle..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Valeurs par défaut de l'événement</h4>

              {/* Default Title */}
              <FormField
                control={form.control}
                name="eventDefaults.title"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Titre par défaut</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Réunion hebdomadaire" {...field} />
                    </FormControl>
                    <FormDescription>
                      Sera pré-rempli lors de la création d'un événement
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duration */}
              <FormField
                control={form.control}
                name="eventDefaults.duration"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Durée</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v, 10))}
                      value={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* All Day */}
              <FormField
                control={form.control}
                name="eventDefaults.allDay"
                render={({ field }) => (
                  <FormItem className="mb-4 flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Journée entière</FormLabel>
                      <FormDescription>
                        Les événements n'auront pas d'heure spécifique
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Color */}
              <FormField
                control={form.control}
                name="eventDefaults.color"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Couleur</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => field.onChange(color.value)}
                          className={`w-8 h-8 rounded-full transition-all ${
                            field.value === color.value
                              ? 'ring-2 ring-offset-2 ring-primary scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.label}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location */}
              <FormField
                control={form.control}
                name="eventDefaults.location"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Lieu par défaut</FormLabel>
                    <FormControl>
                      <Input placeholder="ex: Salle A, Bureau 301..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reminder */}
              <FormField
                control={form.control}
                name="eventDefaults.reminderMinutes"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Rappel</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v, 10))}
                      value={field.value?.toString() || '0'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REMINDER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Default Description */}
              <FormField
                control={form.control}
                name="eventDefaults.description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description par défaut</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description pré-remplie pour les événements..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              {isEdit && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer le modèle ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Le modèle sera définitivement supprimé.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <div className="flex-1" />

              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                {isEdit ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

export default TemplateSheet;
