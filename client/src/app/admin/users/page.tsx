"use client"

import { useState, useCallback } from "react"
import { usePageTitle } from "@/hooks/use-page-title"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { type User, isAdmin, isActive } from "@/lib/api-admin"
import { Plus, MoreHorizontal, UserCog, Upload, Users } from "lucide-react"
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
import { triggerHrOnboarding } from "@/components/interop/lms-hr-bridge"
import { toast } from "sonner"
import { BulkUserImportDialog } from "@/components/admin/bulk-user-import-dialog"
import { ImpersonateDialog } from "@/components/admin/impersonate-dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { PageHeader } from "@/components/ui/page-header"
import { SearchInput } from "@/components/ui/search-input"
import { StatusBadge } from "@/components/ui/status-badge"
import { DateDisplay } from "@/components/ui/date-display"


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
            toast.success("Utilisateur supprimé")
            loadUsers()
        } catch (error: unknown) {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || "Échec de la suppression de l'utilisateur")
        }
    }

    const handleSubmit = async (data: CreateUserRequest | UpdateUserRequest) => {
        setIsLoading(true)
        try {
            if (selectedUser) {
                await usersApi.update(selectedUser.id, data as UpdateUserRequest)
                toast.success("Utilisateur mis à jour")
            } else {
                await usersApi.create(data as CreateUserRequest)
                toast.success("Utilisateur créé avec succès")
            }
            setIsSheetOpen(false)
            loadUsers()
        } catch (error: unknown) {
            const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(msg || "Échec de l'enregistrement de l'utilisateur")
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
                <PageHeader
                    title="Utilisateurs"
                    description="Gestion des comptes utilisateurs"
                    icon={<Users className="h-5 w-5" />}
                    actions={<>
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
                            <Upload className="h-4 w-4" /> Import CSV
                        </Button>
                        <Button onClick={handleOpenCreate}>
                            <Plus className="h-4 w-4" /> Ajouter
                        </Button>
                    </>}
                />

                <SearchInput
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Rechercher un utilisateur..."
                    containerClassName="max-w-sm"
                />

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
                                <TableRow key={user.id} className="h-12 transition-colors hover:bg-muted/50">
                                    <TableCell className="font-medium">{user.display_name || user.username}</TableCell>
                                    <TableCell>{user.email || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                                            {user.role >= 2 ? 'Admin' : user.role === 1 ? 'User' : 'Guest'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={isActive(user) ? 'active' : 'inactive'} />
                                    </TableCell>
                                    <TableCell><DateDisplay date={user.created_at} /></TableCell>
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
                                                <DropdownMenuItem onClick={() => handleOpenEdit(user)}>Modifier</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setImpersonateUser(user)}>
                                                    <UserCog className="h-3.5 w-3.5 mr-2" />
                                                    View as user
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => setDeleteUserId(user.id)}>Supprimer</DropdownMenuItem>
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
            <ConfirmDeleteDialog
                open={!!deleteUserId}
                onOpenChange={(v) => !v && setDeleteUserId(null)}
                title="Supprimer cet utilisateur ?"
                description="Cette action est irréversible. L'utilisateur sera supprimé définitivement."
                onConfirm={handleDeleteUser}
            />
        </AppLayout>
    )
}
