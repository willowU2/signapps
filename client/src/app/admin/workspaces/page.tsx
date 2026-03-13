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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Search, MoreHorizontal, Users, Pencil, Trash2 } from "lucide-react"
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

export default function WorkspacesPage() {
    const { workspaces, workspacesLoading, fetchWorkspaces, createWorkspace, deleteWorkspace } = useTenantStore()
    const [search, setSearch] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newWorkspace, setNewWorkspace] = useState({ name: "", description: "", color: "#3B82F6" })
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    const filteredWorkspaces = workspaces.filter(workspace =>
        workspace.name.toLowerCase().includes(search.toLowerCase()) ||
        (workspace.description?.toLowerCase() ?? "").includes(search.toLowerCase())
    )

    const handleCreate = async () => {
        if (!newWorkspace.name.trim()) return
        setIsSubmitting(true)
        try {
            await createWorkspace(newWorkspace.name, newWorkspace.description || undefined, newWorkspace.color)
            setIsCreateOpen(false)
            setNewWorkspace({ name: "", description: "", color: "#3B82F6" })
        } catch (error) {
            console.error("Failed to create workspace:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (workspace: Workspace) => {
        if (workspace.is_default) {
            alert("Cannot delete the default workspace")
            return
        }
        if (!confirm(`Delete workspace "${workspace.name}"? This action cannot be undone.`)) return
        try {
            await deleteWorkspace(workspace.id)
        } catch (error) {
            console.error("Failed to delete workspace:", error)
        }
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> New Workspace
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Workspace</DialogTitle>
                                <DialogDescription>
                                    Create a new workspace to organize your projects and resources.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="My Workspace"
                                        value={newWorkspace.name}
                                        onChange={(e) => setNewWorkspace(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        placeholder="Optional description..."
                                        value={newWorkspace.description}
                                        onChange={(e) => setNewWorkspace(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="color">Color</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            id="color"
                                            value={newWorkspace.color}
                                            onChange={(e) => setNewWorkspace(prev => ({ ...prev, color: e.target.value }))}
                                            className="h-10 w-20 cursor-pointer rounded border"
                                        />
                                        <span className="text-sm text-muted-foreground">{newWorkspace.color}</span>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCreate} disabled={isSubmitting || !newWorkspace.name.trim()}>
                                    {isSubmitting ? "Creating..." : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search workspaces..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {workspacesLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-muted-foreground">Loading...</div>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredWorkspaces.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No workspaces found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredWorkspaces.map((workspace) => (
                                        <TableRow key={workspace.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-3 w-3 rounded-full"
                                                        style={{ backgroundColor: workspace.color }}
                                                    />
                                                    {workspace.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {workspace.description || "-"}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${workspace.is_default ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                                                    {workspace.is_default ? "Default" : "Custom"}
                                                </span>
                                            </TableCell>
                                            <TableCell>{new Date(workspace.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(workspace.id)}>
                                                            Copy ID
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem>
                                                            <Users className="mr-2 h-4 w-4" />
                                                            Manage Members
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem>
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
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
