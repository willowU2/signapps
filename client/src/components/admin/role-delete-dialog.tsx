"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useDeleteRole, type Role } from "@/hooks/use-roles"

interface RoleDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    role: Role | null
}

export function RoleDeleteDialog({ open, onOpenChange, role }: RoleDeleteDialogProps) {
    const deleteRole = useDeleteRole()

    const handleDelete = async () => {
        if (!role) return

        if (role.is_system) {
            toast.error("Les rôles système ne peuvent pas être supprimés")
            return
        }

        try {
            await deleteRole.mutateAsync(role.id)
            toast.success("Rôle supprimé avec succès")
            onOpenChange(false)
        } catch (error) {
            console.error("Impossible de supprimer role:", error)
            toast.error("Échec de la suppression du rôle")
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer le rôle</AlertDialogTitle>
                    <AlertDialogDescription>
                        Êtes-vous sûr de vouloir supprimer le rôle &quot;{role?.name}&quot; ?
                        Cette action est irréversible et les utilisateurs assignés à ce rôle
                        perdront leurs permissions associées.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteRole.isPending || role?.is_system}
                    >
                        {deleteRole.isPending ? "Suppression..." : "Supprimer"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
