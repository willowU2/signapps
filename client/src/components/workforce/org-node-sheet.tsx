'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * Org Node Sheet Component
 *
 * Side sheet for creating/editing organizational nodes.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { orgNodesApi, orgNodeTypesApi } from '@/lib/api/workforce';
import type { OrgNodeWithStats, CreateOrgNode, UpdateOrgNode } from '@/types/workforce';

// Validation schema
const orgNodeSchema = z.object({
  node_type: z.string().min(1, 'Le type est requis'),
  name: z.string().min(1, 'Le nom est requis').max(100),
  code: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0),
});

type OrgNodeFormValues = z.infer<typeof orgNodeSchema>;

interface OrgNodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  node?: OrgNodeWithStats | null;
  parentId?: string;
}

export function OrgNodeSheet({
  isOpen,
  onClose,
  node,
  parentId,
}: OrgNodeSheetProps) {
  const queryClient = useQueryClient();
  const isEditing = !!node;

  // Fetch node types
  const { data: nodeTypesData } = useQuery({
    queryKey: ['workforce', 'node-types'],
    queryFn: () => orgNodeTypesApi.list(),
  });

  const nodeTypes = nodeTypesData?.data || [];

  // Form setup
  const form = useForm<OrgNodeFormValues>({
    resolver: zodResolver(orgNodeSchema),
    defaultValues: {
      node_type: node?.node_type || '',
      name: node?.name || '',
      code: node?.code || '',
      description: node?.description || '',
      is_active: node?.is_active ?? true,
      sort_order: node?.sort_order || 0,
    },
  });

  // Reset form when node changes
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        node_type: node?.node_type || '',
        name: node?.name || '',
        code: node?.code || '',
        description: node?.description || '',
        is_active: node?.is_active ?? true,
        sort_order: node?.sort_order || 0,
      });
    }
  }, [isOpen, node, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateOrgNode) => orgNodesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce', 'tree'] });
      toast.success('Nœud créé avec succès');
      onClose();
    },
    onError: () => {
      toast.error('Erreur lors de la création');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrgNode }) =>
      orgNodesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce', 'tree'] });
      toast.success('Nœud mis à jour avec succès');
      onClose();
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Submit handler
  const onSubmit = (values: OrgNodeFormValues) => {
    if (isEditing && node) {
      updateMutation.mutate({
        id: node.id,
        data: {
          name: values.name,
          code: values.code || undefined,
          description: values.description || undefined,
          is_active: values.is_active,
          sort_order: values.sort_order,
        },
      });
    } else {
      createMutation.mutate({
        parent_id: parentId,
        node_type: values.node_type,
        name: values.name,
        code: values.code || undefined,
        description: values.description || undefined,
        sort_order: values.sort_order,
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Modifier le nœud' : 'Nouveau nœud'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modifiez les informations du nœud organisationnel'
              : parentId
              ? 'Créez un nouveau nœud enfant'
              : 'Créez un nouveau nœud racine'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            <FormField
              control={form.control}
              name="node_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de nœud</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {nodeTypes.map((type) => (
                        <SelectItem key={type.id} value={type.code}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du nœud" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="CODE-123" {...field} />
                  </FormControl>
                  <FormDescription>
                    Identifiant unique pour ce nœud
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description du nœud..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordre de tri</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Position dans la liste (0 = premier)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEditing && (
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Actif</FormLabel>
                      <FormDescription>
                        Les nœuds inactifs sont masqués par défaut
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <SheetFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                {isEditing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

export type { OrgNodeSheetProps };
