"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Users, UserPlus } from "lucide-react";
import { useGroupList, Group } from "@/hooks/use-groups";
import { GroupSheet } from "@/components/admin/group-sheet";
import { GroupDeleteDialog } from "@/components/admin/group-delete-dialog";
import { GroupMembersSheet } from "@/components/admin/group-members-sheet";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { AppLayout } from "@/components/layout/app-layout";

export default function GroupsPage() {
  usePageTitle("Groupes");
  const { data: groups, isLoading, error } = useGroupList();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const handleCreate = () => {
    setSelectedGroup(null);
    setSheetOpen(true);
  };

  const handleEdit = (group: Group) => {
    setSelectedGroup(group);
    setSheetOpen(true);
  };

  const handleDelete = (group: Group) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const handleManageMembers = (group: Group) => {
    setSelectedGroup(group);
    setMembersSheetOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="w-full space-y-6">
          <PageHeader
            title="Groupes utilisateurs"
            description="Gérez les groupes RBAC pour contrôler les accès et les permissions."
            icon={<Users className="h-5 w-5" />}
          />
          <LoadingState variant="skeleton" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="w-full space-y-6">
          <PageHeader
            title="Groupes utilisateurs"
            description="Gérez les groupes RBAC pour contrôler les accès et les permissions."
            icon={<Users className="h-5 w-5" />}
          />
          <ErrorState
            title="Impossible de charger les groupes"
            message="Vérifiez votre connexion au service d'identité."
            onRetry={() => window.location.reload()}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Groupes utilisateurs"
        description="Gérez les groupes RBAC pour contrôler les accès et les permissions."
        icon={<Users className="h-5 w-5" />}
        actions={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Nouveau groupe
          </Button>
        }
      />

      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[120px] text-center">Membres</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32">
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Aucun groupe trouvé</p>
                    <p className="text-xs mt-1">
                      Créez votre premier groupe pour gérer les accès
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              groups?.map((group: Group) => (
                <TableRow
                  key={group.id}
                  className="group h-12 hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {group.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {group.description || (
                      <span className="italic">Aucune description</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 text-secondary-foreground text-xs font-medium">
                      <Users className="h-3 w-3" />
                      {group.member_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleManageMembers(group)}
                        className="h-8 w-8 text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/50"
                        title="Gérer les membres"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(group)}
                        className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(group)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GroupSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialData={selectedGroup}
      />

      <GroupDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        group={selectedGroup}
      />

      <GroupMembersSheet
        open={membersSheetOpen}
        onOpenChange={setMembersSheetOpen}
        group={selectedGroup}
      />
    </div>
  );
}
