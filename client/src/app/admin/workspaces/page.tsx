"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTenantStore } from "@/stores/tenant-store"
import type { Workspace } from "@/lib/api/tenant"
import { DataTable } from "@/components/ui/data-table"
import { WorkspaceSheet, type WorkspaceFormValues } from "@/components/admin/workspace-sheet"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Plus, Search, MoreHorizontal, Users, Pencil, Trash2 } from "lucide-react"


export default function WorkspacesPage() {
    const { workspaces, workspacesLoading, fetchWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace } = useTenantStore()
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    const handleOpenSheet = (workspace?: Workspace) => {
        setEditingWorkspace(workspace || null)
        setIsSheetOpen(true)
    }

    const handleSubmit = async (values: WorkspaceFormValues) => {
        setIsSubmitting(true)
        try {
            if (editingWorkspace) {
                await updateWorkspace(editingWorkspace.id, {
                    name: values.name,
                    description: values.description || undefined,
                    color: values.color
                })
                toast.success("Workspace updated successfully")
            } else {
                await createWorkspace(values.name, values.description || undefined, values.color)
                toast.success("Workspace created successfully")
            }
            setIsSheetOpen(false)
            setEditingWorkspace(null)
        } catch (error) {
            console.error("Failed to save workspace:", error)
            toast.error("Failed to save workspace")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (workspace: Workspace) => {
        if (workspace.is_default) {
            toast.error("Cannot delete the default workspace")
            return
        }
        if (!confirm(`Delete workspace "${workspace.name}"? This action cannot be undone.`)) return
        try {
            await deleteWorkspace(workspace.id)
            toast.success("Workspace deleted successfully")
        } catch (error) {
            console.error("Failed to delete workspace:", error)
            toast.error("Failed to delete workspace")
        }
    }

    const workspaceColumns: ColumnDef<Workspace>[] = [
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: row.original.color || "#3B82F6" }}
                    />
                    <span className="font-medium">{row.original.name}</span>
                </div>
            ),
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "-"}</span>,
        },
        {
            accessorKey: "is_default",
            header: "Type",
            cell: ({ row }) => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${row.original.is_default ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                    {row.original.is_default ? "Default" : "Custom"}
                </span>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Created",
            cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const workspace = row.original
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => {
                                navigator.clipboard.writeText(workspace.id)
                                toast.success("ID copied to clipboard")
                            }}>
                                Copy ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
{/* Member management retiré - feature non implémentée (NO DEAD ENDS) */}
                            <DropdownMenuItem onClick={() => handleOpenSheet(workspace)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(workspace)}
                                disabled={workspace.is_default}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        },
    ]

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
                    <Button onClick={() => handleOpenSheet()}>
                        <Plus className="mr-2 h-4 w-4" /> New Workspace
                    </Button>
                </div>

                {workspacesLoading ? (
                    <div className="space-y-4">
                        <div className="h-10 w-full bg-muted/50 rounded-md animate-pulse" />
                        <div className="h-12 w-full bg-muted/50 rounded-md animate-pulse" />
                        <div className="h-12 w-full bg-muted/50 rounded-md animate-pulse" />
                    </div>
                ) : (
                    <DataTable
                        columns={workspaceColumns}
                        data={workspaces}
                        searchKey="name"
                    />
                )}

                <WorkspaceSheet
                    open={isSheetOpen}
                    onOpenChange={setIsSheetOpen}
                    workspace={editingWorkspace}
                    onSubmit={handleSubmit}
                    isLoading={isSubmitting}
                />
            </div>
        </AppLayout>
    )
}
