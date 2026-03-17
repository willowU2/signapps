'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Shield, Lock } from 'lucide-react';
import { useRoleList, type Role } from '@/hooks/use-roles';
import { RoleSheet } from '@/components/admin/role-sheet';
import { RoleDeleteDialog } from '@/components/admin/role-delete-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

  const getPermissionCount = (role: Role): number => {
    if (!role.permissions) return 0;
    return Object.values(role.permissions).reduce(
      (acc, actions) => acc + (Array.isArray(actions) ? actions.length : 0),
      0
    );
  };

  const getResourceCount = (role: Role): number => {
    if (!role.permissions) return 0;
    return Object.keys(role.permissions).length;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
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

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rôle</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[140px] text-center">Ressources</TableHead>
              <TableHead className="w-[140px] text-center">Permissions</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Chargement des rôles...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-red-500">
                  Erreur lors du chargement des rôles.
                </TableCell>
              </TableRow>
            ) : roles?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Aucun rôle trouvé.
                </TableCell>
              </TableRow>
            ) : (
              roles?.map((role: Role) => (
                <TableRow key={role.id} className="group">
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      {role.name}
                      {role.is_system && (
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
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {role.description || <span className="italic">Aucune description</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">
                      {getResourceCount(role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-mono">
                      {getPermissionCount(role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(role)}
                        className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(role)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
