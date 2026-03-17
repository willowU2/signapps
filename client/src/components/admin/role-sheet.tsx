"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useCreateRole, useUpdateRole, type Role } from "@/hooks/use-roles"
import { PermissionsEditor } from "./permissions-editor"
import type { RolePermissions } from "@/lib/api/identity"

const roleSchema = z.object({
    name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
    description: z.string().optional(),
    permissions: z.record(z.array(z.string())).default({}),
})

type RoleFormValues = z.infer<typeof roleSchema>

interface RoleSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: Role | null
}

export function RoleSheet({ open, onOpenChange, initialData }: RoleSheetProps) {
    const createRole = useCreateRole()
    const updateRole = useUpdateRole()
    const isEditing = !!initialData
    const isSystem = initialData?.is_system ?? false

    const form = useForm<RoleFormValues>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: "",
            description: "",
            permissions: {},
        },
    })

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    name: initialData.name,
                    description: initialData.description || "",
                    permissions: initialData.permissions || {},
                })
            } else {
                form.reset({
                    name: "",
                    description: "",
                    permissions: {},
                })
            }
        }
    }, [open, initialData, form])

    const onSubmit = async (values: RoleFormValues) => {
        try {
            if (isEditing && initialData) {
                await updateRole.mutateAsync({
                    id: initialData.id,
                    data: {
                        name: values.name,
                        description: values.description,
                        permissions: values.permissions as RolePermissions,
                    },
                })
                toast.success("Rôle mis à jour avec succès")
            } else {
                await createRole.mutateAsync({
                    name: values.name,
                    description: values.description,
                    permissions: values.permissions as RolePermissions,
                })
                toast.success("Rôle créé avec succès")
            }
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to save role:", error)
            toast.error(isEditing ? "Échec de la mise à jour" : "Échec de la création")
        }
    }

    const isLoading = createRole.isPending || updateRole.isPending

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>
                        {isEditing ? "Modifier le rôle" : "Nouveau rôle"}
                    </SheetTitle>
                    <SheetDescription>
                        {isEditing
                            ? "Modifiez les informations et permissions du rôle."
                            : "Créez un nouveau rôle avec des permissions personnalisées."}
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nom du rôle</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="ex: Éditeur, Modérateur..."
                                            disabled={isSystem}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Décrivez les responsabilités de ce rôle..."
                                            className="resize-none"
                                            rows={3}
                                            disabled={isSystem}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="permissions"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <PermissionsEditor
                                            value={field.value as RolePermissions}
                                            onChange={field.onChange}
                                            disabled={isSystem}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {isSystem && (
                            <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-md">
                                Les rôles système ne peuvent pas être modifiés.
                            </p>
                        )}

                        <SheetFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isLoading || isSystem}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditing ? "Enregistrer" : "Créer"}
                            </Button>
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}
