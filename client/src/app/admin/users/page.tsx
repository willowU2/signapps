"use client"

import { useState, useCallback } from "react"
import { usePageTitle } from "@/hooks/use-page-title"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { type User, isAdmin, isActive } from "@/lib/api-admin"
import { Plus, Search, MoreHorizontal, UserCog, Upload } from "lucide-react"
import { ExportButton } from "@/components/ui/export-button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserSheet } from "@/components/admin/user-sheet"
import { usersApi } from "@/lib/api/identity"
import { CreateUserRequest, UpdateUserRequest } from "@/lib/api"
import { toast } from "sonner"
import { BulkUserImportDialog } from "@/components/admin/bulk-user-import-dialog"
import { ImpersonateDialog } from "@/components/admin/impersonate-dialog"
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


export default function UsersPage() {
    usePageTitle('Utilisateurs — Administration')
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [impersonateUser, setImpersonateUser] = useState<User | null>(null)
    const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const res = await usersApi.list()
            return Array.isArray(res.data) ? res.data : (res.data?.users || [])
        },
    })

    const loadUsers = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    }, [queryClient])

    const handleOpenCreate = () => {
        setSelectedUser(null)
        setIsSheetOpen(true)
    }

    const handleOpenEdit = (user: User) => {
        setSelectedUser(user)
        setIsSheetOpen(true)
    }

    const handleDeleteUser = async () => {
        if (!deleteUserId) return
        const id = deleteUserId
        setDeleteUserId(null)
        try {
            await usersApi.delete(id)
            toast.success("User deleted")
            loadUsers()
        } catch (error: unknown) {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || "Failed to delete user")
        }
    }

    const handleSubmit = async (data: CreateUserRequest | UpdateUserRequest) => {
        setIsLoading(true)
        try {
            if (selectedUser) {
                await usersApi.update(selectedUser.id, data as UpdateUserRequest)
                toast.success("User updated successfully")
            } else {
                await usersApi.create(data as CreateUserRequest)
                toast.success("User created successfully")
            }
            setIsSheetOpen(false)
            loadUsers()
        } catch (error: unknown) {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || "Failed to save user")
        } finally {
            setIsLoading(false)
        }
    }

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        (user.email?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
        (user.display_name?.toLowerCase() ?? '').includes(search.toLowerCase())
    )

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                    <div className="flex gap-2">
                        <ExportButton
                            data={filteredUsers.map(u => ({
                                username: u.username,
                                email: u.email || '',
                                display_name: u.display_name || '',
                                role: u.role >= 2 ? 'Admin' : u.role === 1 ? 'User' : 'Guest',
                                status: isActive(u) ? 'Active' : 'Inactive',
                                created_at: new Date(u.created_at).toLocaleDateString(),
                            }))}
                            filename={`users-${new Date().toISOString().slice(0, 10)}`}
                            columns={{
                                username: 'Username',
                                email: 'Email',
                                display_name: 'Display Name',
                                role: 'Role',
                                status: 'Status',
                                created_at: 'Joined',
                            }}
                        />
                        <Button variant="outline" onClick={() => setImportOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" /> Import CSV
                        </Button>
                        <Button onClick={handleOpenCreate}>
                            <Plus className="mr-2 h-4 w-4" /> Add User
                        </Button>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id} className="transition-colors hover:bg-muted/50">
                                    <TableCell className="font-medium">{user.display_name || user.username}</TableCell>
                                    <TableCell>{user.email || '-'}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.role >= 2 ? 'bg-primary/10 text-primary' : user.role === 1 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {user.role >= 2 ? 'Admin' : user.role === 1 ? 'User' : 'Guest'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive(user) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {isActive(user) ? 'Active' : 'Inactive'}
                                        </span>
                                    </TableCell>
                                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
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
                                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.id)}>
                                                    Copy ID
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleOpenEdit(user)}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setImpersonateUser(user)}>
                                                    <UserCog className="h-3.5 w-3.5 mr-2" />
                                                    View as user
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => setDeleteUserId(user.id)}>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <UserSheet
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                user={selectedUser}
                onSubmit={handleSubmit}
                isLoading={isLoading}
            />
            <BulkUserImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onImported={loadUsers}
            />
            {impersonateUser && (
                <ImpersonateDialog
                    user={impersonateUser}
                    open={!!impersonateUser}
                    onOpenChange={(v) => !v && setImpersonateUser(null)}
                />
            )}
            <AlertDialog open={!!deleteUserId} onOpenChange={(v) => !v && setDeleteUserId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. L'utilisateur sera supprimé définitivement.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    )
}
