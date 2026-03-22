'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Vehicle } from './vehicle-list';

const vehicleSchema = z.object({
  plateNumber: z.string().min(1, 'Plaque requise'),
  model: z.string().min(1, 'Modèle requis'),
  assignedDriver: z.string().optional(),
  status: z.enum(['Available', 'Reserved', 'Maintenance']),
  nextServiceDate: z.string().min(1, 'Date requise'),
  kmCounter: z.coerce.number().min(0, 'Kilométrage invalide'),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (vehicle: Omit<Vehicle, 'id'>) => void;
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: VehicleFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plateNumber: '',
      model: '',
      assignedDriver: '',
      status: 'Available' as const,
      nextServiceDate: '',
      kmCounter: 0,
    },
  });

  const handleSubmit = useCallback(
    async (data: VehicleFormData) => {
      setIsSubmitting(true);
      try {
        onSubmit({
          plateNumber: data.plateNumber,
          model: data.model,
          assignedDriver: data.assignedDriver || null,
          status: data.status,
          nextServiceDate: data.nextServiceDate,
          kmCounter: data.kmCounter,
        });
        form.reset();
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, onSubmit]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter un Véhicule</DialogTitle>
          <DialogDescription>
            Remplissez les détails du nouveau véhicule
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="plateNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plaque d'immatriculation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: AB-123-CD"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modèle</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: Renault Kangoo"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedDriver"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conducteur Assigné (Optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nom du conducteur"
                      {...field}
                      value={field.value || ''}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger disabled={isSubmitting}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Available">Disponible</SelectItem>
                      <SelectItem value="Reserved">Réservé</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nextServiceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Prochain Entretien</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="kmCounter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kilométrage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      value={field.value as number}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      onBlur={field.onBlur}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Ajout...' : 'Ajouter Véhicule'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
