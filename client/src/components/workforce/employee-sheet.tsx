'use client';

/**
 * Employee Sheet Component
 *
 * Side sheet for creating/editing employees.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from 'sonner';
import { employeesApi, orgNodesApi, functionDefsApi } from '@/lib/api/workforce';
import type { EmployeeWithDetails, CreateEmployee, UpdateEmployee, ContractType, EmployeeStatus } from '@/types/workforce';

// Contract type options
const CONTRACT_OPTIONS: { value: ContractType; label: string }[] = [
  { value: 'full-time', label: 'CDI - Temps plein' },
  { value: 'part-time', label: 'CDI - Temps partiel' },
  { value: 'contract', label: 'CDD' },
  { value: 'intern', label: 'Stage' },
  { value: 'temporary', label: 'Intérim' },
];

// Status options
const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Actif' },
  { value: 'on_leave', label: 'En congé' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'terminated', label: 'Terminé' },
];

// Validation schema
const employeeSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est requis').max(100),
  last_name: z.string().min(1, 'Le nom est requis').max(100),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  employee_number: z.string().max(50).optional(),
  org_node_id: z.string().min(1, "L'unité est requise"),
  functions: z.array(z.string()),
  contract_type: z.enum(['full-time', 'part-time', 'contract', 'intern', 'temporary']),
  fte_ratio: z.number().min(0).max(1),
  hire_date: z.string().optional(),
  status: z.enum(['active', 'on_leave', 'suspended', 'terminated']).optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: EmployeeWithDetails | null;
  defaultOrgNodeId?: string;
}

export function EmployeeSheet({
  isOpen,
  onClose,
  employee,
  defaultOrgNodeId,
}: EmployeeSheetProps) {
  const queryClient = useQueryClient();
  const isEditing = !!employee;

  // Fetch org nodes for selector
  const { data: nodesData } = useQuery({
    queryKey: ['workforce', 'tree'],
    queryFn: () => orgNodesApi.getTree({ max_depth: 10 }),
  });

  // Fetch function definitions
  const { data: functionsData } = useQuery({
    queryKey: ['workforce', 'functions'],
    queryFn: () => functionDefsApi.list(),
  });

  // Flatten tree for select
  const flatNodes = React.useMemo(() => {
    const result: { id: string; name: string; depth: number }[] = [];
    const flatten = (nodes: any[], depth = 0) => {
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, depth });
        if (node.children) flatten(node.children, depth + 1);
      }
    };
    if (nodesData?.data) flatten(nodesData.data);
    return result;
  }, [nodesData]);

  const functionOptions = (functionsData?.data || []).map((fn) => ({
    value: fn.code,
    label: fn.name,
  }));

  // Form setup
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      first_name: employee?.first_name || '',
      last_name: employee?.last_name || '',
      email: employee?.email || '',
      phone: employee?.phone || '',
      employee_number: employee?.employee_number || '',
      org_node_id: employee?.org_node_id || defaultOrgNodeId || '',
      functions: employee?.functions || [],
      contract_type: employee?.contract_type || 'full-time',
      fte_ratio: employee?.fte_ratio ?? 1,
      hire_date: employee?.hire_date?.split('T')[0] || '',
      status: employee?.status || 'active',
    },
  });

  // Reset form when employee changes
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        first_name: employee?.first_name || '',
        last_name: employee?.last_name || '',
        email: employee?.email || '',
        phone: employee?.phone || '',
        employee_number: employee?.employee_number || '',
        org_node_id: employee?.org_node_id || defaultOrgNodeId || '',
        functions: employee?.functions || [],
        contract_type: employee?.contract_type || 'full-time',
        fte_ratio: employee?.fte_ratio ?? 1,
        hire_date: employee?.hire_date?.split('T')[0] || '',
        status: employee?.status || 'active',
      });
    }
  }, [isOpen, employee, defaultOrgNodeId, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateEmployee) => employeesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['workforce', 'tree'] });
      toast.success('Employé créé avec succès');
      onClose();
    },
    onError: () => {
      toast.error('Erreur lors de la création');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployee }) =>
      employeesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workforce', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['workforce', 'tree'] });
      toast.success('Employé mis à jour avec succès');
      onClose();
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Submit handler
  const onSubmit = (values: EmployeeFormValues) => {
    const baseData = {
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      employee_number: values.employee_number || undefined,
      org_node_id: values.org_node_id,
      functions: values.functions,
      contract_type: values.contract_type,
      fte_ratio: values.fte_ratio,
      hire_date: values.hire_date || undefined,
    };

    if (isEditing && employee) {
      updateMutation.mutate({
        id: employee.id,
        data: {
          ...baseData,
          status: values.status,
        },
      });
    } else {
      createMutation.mutate(baseData);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Modifier l\'employé' : 'Nouvel employé'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modifiez les informations de l\'employé'
              : 'Créez un nouveau dossier employé'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            {/* Personal Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Informations personnelles</h4>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input placeholder="Jean" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input placeholder="Dupont" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jean.dupont@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="+33 6 12 34 56 78" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Employment Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Informations professionnelles</h4>

              <FormField
                control={form.control}
                name="employee_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matricule</FormLabel>
                    <FormControl>
                      <Input placeholder="EMP-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="org_node_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unité organisationnelle</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une unité" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {flatNodes.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {'─'.repeat(node.depth)} {node.name}
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
                name="functions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonctions</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={functionOptions}
                        selected={field.value}
                        onChange={field.onChange}
                        placeholder="Sélectionner des fonctions"
                      />
                    </FormControl>
                    <FormDescription>
                      Rôles et responsabilités de l'employé
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contract_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de contrat</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONTRACT_OPTIONS.map((opt) => (
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

                <FormField
                  control={form.control}
                  name="hire_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d'embauche</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="fte_ratio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taux ETP ({Math.round(field.value * 100)}%)</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[field.value]}
                        onValueChange={(values) => field.onChange(values[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Équivalent temps plein (100% = temps complet)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditing && (
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
                          {STATUS_OPTIONS.map((opt) => (
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
              )}
            </div>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

export type { EmployeeSheetProps };
