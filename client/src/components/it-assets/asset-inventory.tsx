'use client';

import { useMemo, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCircle, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export type AssetType = 'Laptop' | 'Desktop' | 'Server' | 'Phone' | 'Printer';
export type AssetStatus = 'Active' | 'Maintenance' | 'Retired';

export interface ITAsset {
  id: string;
  name: string;
  type: AssetType;
  serialNumber: string;
  assignedTo: string;
  status: AssetStatus;
  warrantyEndDate: string;
}

const assetSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  type: z.enum(['Laptop', 'Desktop', 'Server', 'Phone', 'Printer'] as const),
  serialNumber: z.string().min(1, 'Numéro de série requis'),
  assignedTo: z.string().min(1, 'Assignation requise'),
  status: z.enum(['Active', 'Maintenance', 'Retired'] as const),
  warrantyEndDate: z.string().min(1, 'Date de garantie requise'),
});

type AssetFormValues = z.infer<typeof assetSchema>;

interface AssetInventoryProps {
  assets: ITAsset[];
  onAddAsset?: (asset: ITAsset) => void;
}

export function AssetInventory({ assets, onAddAsset }: AssetInventoryProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: '',
      type: 'Laptop',
      serialNumber: '',
      assignedTo: '',
      status: 'Active',
      warrantyEndDate: '',
    },
  });

  const getTypeColor = (type: AssetType) => {
    const colorMap: Record<AssetType, string> = {
      Laptop: 'bg-blue-100 text-blue-800',
      Desktop: 'bg-slate-100 text-slate-800',
      Server: 'bg-purple-100 text-purple-800',
      Phone: 'bg-green-100 text-green-800',
      Printer: 'bg-orange-100 text-orange-800',
    };
    return colorMap[type];
  };

  const getStatusColor = (status: AssetStatus) => {
    const colorMap: Record<AssetStatus, string> = {
      Active: 'bg-emerald-100 text-emerald-800',
      Maintenance: 'bg-yellow-100 text-yellow-800',
      Retired: 'bg-red-100 text-red-800',
    };
    return colorMap[status];
  };

  const isWarrantyExpiring = (warrantyDate: string): boolean => {
    const daysUntilExpiry = differenceInDays(parseISO(warrantyDate), new Date());
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isWarrantyExpired = (warrantyDate: string): boolean => {
    return differenceInDays(parseISO(warrantyDate), new Date()) < 0;
  };

  const onSubmit = async (values: AssetFormValues) => {
    try {
      const newAsset: ITAsset = {
        id: `asset-${Date.now()}`,
        ...values,
      };
      onAddAsset?.(newAsset);
      toast.success('Actif ajouté avec succès');
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error('Erreur lors de l\'ajout de l\'actif');
      console.error(error);
    }
  };

  const columns: ColumnDef<ITAsset>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Nom de l\'actif',
        cell: ({ row }) => (
          <div className="font-medium text-gray-900">{row.original.name}</div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge className={getTypeColor(row.original.type)}>
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'serialNumber',
        header: 'Numéro de série',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 font-mono">
            {row.original.serialNumber}
          </span>
        ),
      },
      {
        accessorKey: 'assignedTo',
        header: 'Assigné à',
        cell: ({ row }) => (
          <span className="text-sm text-gray-700">{row.original.assignedTo}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ row }) => (
          <Badge className={getStatusColor(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'warrantyEndDate',
        header: 'Fin de garantie',
        cell: ({ row }) => {
          const isExpired = isWarrantyExpired(row.original.warrantyEndDate);
          const isExpiring = isWarrantyExpiring(row.original.warrantyEndDate);

          return (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {format(parseISO(row.original.warrantyEndDate), 'd MMM yyyy', {
                  locale: fr,
                })}
              </span>
              {isExpired && (
                <div title="Garantie expirée">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
              )}
              {isExpiring && !isExpired && (
                <div title="Garantie expire bientôt">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                </div>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Inventaire Informatique</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un actif
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un nouvel actif</DialogTitle>
              <DialogDescription>
                Remplissez les informations de l\'actif informatique à ajouter à l\'inventaire.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de l\'actif</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: MacBook Pro #1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Laptop">Laptop</SelectItem>
                          <SelectItem value="Desktop">Desktop</SelectItem>
                          <SelectItem value="Server">Server</SelectItem>
                          <SelectItem value="Phone">Phone</SelectItem>
                          <SelectItem value="Printer">Printer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de série</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: SN123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigné à</FormLabel>
                      <FormControl>
                        <Input placeholder="ex: Jean Dupont" {...field} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Retired">Retired</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="warrantyEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fin de garantie</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">Ajouter</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable<ITAsset, unknown>
        columns={columns}
        data={assets}
        searchKey="name"
        searchPlaceholder="Rechercher par nom d'actif..."
      />
    </div>
  );
}
