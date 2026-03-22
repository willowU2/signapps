'use client';

/**
 * RGPD Register Component
 *
 * Table of data treatments with columns: name, purpose, legal basis badge,
 * data categories, retention period, and status badge (compliant/non-compliant).
 * Includes form to add new treatments.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

export type LegalBasis = 'Consentement' | 'Contrat' | 'Obligation légale' | 'Intérêt légitime';
export type ComplianceStatus = 'Conforme' | 'Non-conforme';

export interface DataTreatment {
  id: string;
  name: string;
  purpose: string;
  legalBasis: LegalBasis;
  dataCategories: string[];
  retentionPeriod: string;
  status: ComplianceStatus;
}

export interface RGPDRegisterProps {
  treatments: DataTreatment[];
  onAddTreatment?: (data: Omit<DataTreatment, 'id'>) => void;
  className?: string;
}

const treatmentSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  purpose: z.string().min(10, 'L\'objectif doit contenir au moins 10 caractères'),
  legalBasis: z.enum(['Consentement', 'Contrat', 'Obligation légale', 'Intérêt légitime']),
  dataCategories: z.string().min(5, 'Spécifiez au moins une catégorie de données'),
  retentionPeriod: z.string().min(2, 'Spécifiez la durée de conservation'),
  status: z.enum(['Conforme', 'Non-conforme']),
});

type TreatmentFormValues = z.infer<typeof treatmentSchema>;

const LEGAL_BASIS_COLORS: Record<LegalBasis, string> = {
  'Consentement': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Contrat': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Obligation légale': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'Intérêt légitime': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const STATUS_COLORS: Record<ComplianceStatus, string> = {
  'Conforme': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'Non-conforme': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function AddTreatmentDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TreatmentFormValues) => void;
}) {
  const form = useForm<TreatmentFormValues>({
    resolver: zodResolver(treatmentSchema),
    defaultValues: {
      name: '',
      purpose: '',
      legalBasis: 'Consentement',
      dataCategories: '',
      retentionPeriod: '',
      status: 'Conforme',
    },
  });

  const handleSubmit = (data: TreatmentFormValues) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter un traitement de données</DialogTitle>
          <DialogDescription>
            Documentez un nouveau traitement de données personnelles pour le registre RGPD
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du traitement</FormLabel>
                  <FormControl>
                    <Input placeholder="ex: Gestion des salaires" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objectif du traitement</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description détaillée de l'objectif..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="legalBasis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base légale</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Consentement">Consentement</SelectItem>
                        <SelectItem value="Contrat">Contrat</SelectItem>
                        <SelectItem value="Obligation légale">Obligation légale</SelectItem>
                        <SelectItem value="Intérêt légitime">Intérêt légitime</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>État de conformité</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Conforme">Conforme</SelectItem>
                        <SelectItem value="Non-conforme">Non-conforme</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dataCategories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégories de données</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: Nom, Email, Téléphone (séparées par des virgules)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="retentionPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Durée de conservation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: 3 ans après fin du contrat"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit">Ajouter</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function RGPDRegister({ treatments, onAddTreatment, className }: RGPDRegisterProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleFormSubmit = async (data: TreatmentFormValues) => {
    setIsSubmitting(true);
    try {
      const categories = data.dataCategories
        .split(',')
        .map((cat) => cat.trim())
        .filter((cat) => cat.length > 0);

      onAddTreatment?.({
        ...data,
        dataCategories: categories,
      });
      toast.success('Traitement ajouté au registre RGPD');
    } catch (error) {
      toast.error('Erreur lors de l\'ajout du traitement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nonCompliantCount = treatments.filter((t) => t.status === 'Non-conforme').length;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Registre RGPD</h2>
          {nonCompliantCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={16} />
              {nonCompliantCount} traitement(s) non conforme(s)
            </div>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
          <Plus size={16} />
          Ajouter un traitement
        </Button>
      </div>

      <AddTreatmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleFormSubmit}
      />

      <Card>
        <CardContent className="p-0">
          {treatments.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Aucun traitement documenté. Commencez par en ajouter un.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-semibold">Nom du traitement</th>
                    <th className="px-4 py-3 text-left font-semibold">Objectif</th>
                    <th className="px-4 py-3 text-left font-semibold">Base légale</th>
                    <th className="px-4 py-3 text-left font-semibold">Catégories de données</th>
                    <th className="px-4 py-3 text-left font-semibold">Durée de conservation</th>
                    <th className="px-4 py-3 text-left font-semibold">Conformité</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((treatment) => (
                    <tr key={treatment.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{treatment.name}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {treatment.purpose}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={LEGAL_BASIS_COLORS[treatment.legalBasis]}>
                          {treatment.legalBasis}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {treatment.dataCategories.slice(0, 2).map((cat, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                          {treatment.dataCategories.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{treatment.dataCategories.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {treatment.retentionPeriod}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[treatment.status]}>
                          {treatment.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
