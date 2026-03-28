'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Lock } from 'lucide-react';
import { useRoleList, type Role } from '@/hooks/use-roles';
import { RoleSheet } from '@/components/admin/role-sheet';
import { RoleDeleteDialog } from '@/components/admin/role-delete-dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  GenericDataTable,
  roleConfig,
  extendEntityConfig,
  type RoleEntity,
  type ActionConfig,
} from '@/lib/data-table';

export default function RolesPage() {
  const { data: roles, isLoading, error } = useRoleList();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleCreate = () => {
    setSelectedRole(null);
    setSheetOpen(true);
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setSheetOpen(true);
  };

  const handleDelete = (role: Role) => {
    setSelectedRole(role);
    setDeleteDialogOpen(true);
  };

  // Extend role config with custom actions
  const actions: ActionConfig<RoleEntity>[] = [
    {
      id: 'edit',
      label: 'Modifier',
      icon: Edit2,
      onClick: (row) => handleEdit(row as Role),
    },
    {
      id: 'delete',
      label: 'Supprimer',
      icon: Trash2,
      variant: 'destructive',
      onClick: (row) => handleDelete(row as Role),
      visible: (row) => !row.is_system,
    },
  ];

  // Custom cell for the name column to show system role indicator
  const extendedConfig = extendEntityConfig<RoleEntity>('roles', {
    columns: roleConfig.columns.map((col) =>
      col.id === 'name'
        ? {
            ...col,
            cell: ({ row }) => (
              <div className="flex items-center gap-2 font-medium">
                {row.name}
                {row.is_system && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Lock className="h-3 w-3 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Rôle système (non modifiable)
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ),
          }
        : col
    ),
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rôles & Permissions</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les rôles RBAC et configurez les permissions d'accès aux ressources.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau Rôle
        </Button>
      </div>

      <GenericDataTable
        config={extendedConfig}
        data={(roles as RoleEntity[]) ?? []}
        isLoading={isLoading}
        error={error ? 'Erreur lors du chargement des rôles.' : undefined}
        actions={actions}
        emptyState={{
          title: 'Aucun rôle trouvé',
          description: "Créez votre premier rôle pour commencer à gérer les permissions.",
          action: {
            label: 'Créer un rôle',
            onClick: handleCreate,
          },
        }}
      />

      <RoleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialData={selectedRole}
      />

      <RoleDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        role={selectedRole}
      />
    </div>
  );
}
