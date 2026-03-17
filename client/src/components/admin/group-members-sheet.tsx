"use client"

import { useEffect, useState } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Trash2, UserPlus, Shield, User, Loader2 } from "lucide-react"
import { groupsApi, type GroupMember } from "@/lib/api/identity"
import { usersApi, type User as UserType } from "@/lib/api/identity"

// Minimal group interface for compatibility with different sources
interface GroupInfo {
    id: string
    name: string
    description?: string | null
}

interface GroupMembersSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    group: GroupInfo | null
    onMembersChange?: () => void
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
    admin: { label: "Admin", icon: Shield, color: "text-blue-500" },
    member: { label: "Membre", icon: User, color: "text-green-500" },
}

export function GroupMembersSheet({ open, onOpenChange, group, onMembersChange }: GroupMembersSheetProps) {
    const [members, setMembers] = useState<GroupMember[]>([])
    const [allUsers, setAllUsers] = useState<UserType[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState("")
    const [selectedRole, setSelectedRole] = useState("member")

    useEffect(() => {
        if (open && group) {
            loadMembers()
            loadUsers()
        }
    }, [open, group?.id])

    const loadMembers = async () => {
        if (!group) return
        setIsLoading(true)
        try {
            const response = await groupsApi.listMembers(group.id)
            setMembers(response.data || [])
        } catch (error) {
            console.error("Failed to load members:", error)
            toast.error("Échec du chargement des membres")
        } finally {
            setIsLoading(false)
        }
    }

    const loadUsers = async () => {
        try {
            const response = await usersApi.list()
            setAllUsers(response.data?.users || [])
        } catch (error) {
            console.error("Failed to load users:", error)
        }
    }

    const handleAddMember = async () => {
        if (!group || !selectedUserId) return
        setIsAdding(true)
        try {
            await groupsApi.addMember(group.id, selectedUserId, selectedRole)
            toast.success("Membre ajouté avec succès")
            setSelectedUserId("")
            setSelectedRole("member")
            loadMembers()
            onMembersChange?.()
        } catch (error) {
            console.error("Failed to add member:", error)
            toast.error("Échec de l'ajout du membre")
        } finally {
            setIsAdding(false)
        }
    }

    const handleRemoveMember = async (userId: string, username: string) => {
        if (!group) return
        if (!confirm(`Retirer "${username}" de ce groupe ?`)) return
        try {
            await groupsApi.removeMember(group.id, userId)
            toast.success("Membre retiré avec succès")
            loadMembers()
            onMembersChange?.()
        } catch (error) {
            console.error("Failed to remove member:", error)
            toast.error("Échec du retrait du membre")
        }
    }

    const availableUsers = allUsers.filter(
        (user) => !members.some((m) => m.user_id === user.id)
    )

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>Gérer les membres</SheetTitle>
                    <SheetDescription>
                        {group?.name} - Ajoutez ou retirez des membres du groupe.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Add Member Form */}
                    <div className="rounded-lg border p-4 space-y-4">
                        <Label className="text-sm font-medium">Ajouter un membre</Label>
                        <div className="flex gap-2">
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Sélectionner un utilisateur" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUsers.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                            Aucun utilisateur disponible
                                        </SelectItem>
                                    ) : (
                                        availableUsers.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.display_name || user.username}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="member">Membre</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleAddMember}
                            disabled={!selectedUserId || isAdding}
                            className="w-full"
                        >
                            {isAdding ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                            )}
                            Ajouter
                        </Button>
                    </div>

                    {/* Members List */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            Membres actuels ({members.length})
                        </Label>
                        <div className="rounded-lg border">
                            {isLoading ? (
                                <div className="p-4 space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <div className="flex-1">
                                                <Skeleton className="h-4 w-32" />
                                            </div>
                                            <Skeleton className="h-8 w-24" />
                                        </div>
                                    ))}
                                </div>
                            ) : members.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    Aucun membre. Ajoutez quelqu'un pour commencer.
                                </div>
                            ) : (
                                <Table>
                                    <TableBody>
                                        {members.map((member) => {
                                            const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member
                                            const RoleIcon = roleConfig.icon

                                            return (
                                                <TableRow key={member.user_id}>
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarFallback className="text-xs">
                                                                    {getInitials(member.full_name || member.username || "?")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-sm truncate">
                                                                    {member.full_name || member.username}
                                                                </p>
                                                                {member.email && (
                                                                    <p className="text-xs text-muted-foreground truncate">
                                                                        {member.email}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Badge variant="outline" className={roleConfig.color}>
                                                            <RoleIcon className="mr-1 h-3 w-3" />
                                                            {roleConfig.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2 w-10">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() =>
                                                                handleRemoveMember(
                                                                    member.user_id,
                                                                    member.full_name || member.username || "cet utilisateur"
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
