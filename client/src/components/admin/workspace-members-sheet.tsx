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
import { Input } from "@/components/ui/input"
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
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Trash2, UserPlus, Shield, User, Eye, Crown, Loader2 } from "lucide-react"
import { workspacesApi, type WorkspaceMember, type WorkspaceRole, type Workspace } from "@/lib/api/tenant"
import { usersApi, type User as UserType } from "@/lib/api/identity"

interface WorkspaceMembersSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspace: Workspace | null
}

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; icon: typeof Crown; color: string }> = {
    owner: { label: "Owner", icon: Crown, color: "text-amber-500" },
    admin: { label: "Admin", icon: Shield, color: "text-blue-500" },
    member: { label: "Member", icon: User, color: "text-green-500" },
    viewer: { label: "Viewer", icon: Eye, color: "text-gray-500" },
}

export function WorkspaceMembersSheet({ open, onOpenChange, workspace }: WorkspaceMembersSheetProps) {
    const [members, setMembers] = useState<WorkspaceMember[]>([])
    const [allUsers, setAllUsers] = useState<UserType[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState("")
    const [selectedRole, setSelectedRole] = useState<WorkspaceRole>("member")

    useEffect(() => {
        if (open && workspace) {
            loadMembers()
            loadUsers()
        }
    }, [open, workspace?.id])

    const loadMembers = async () => {
        if (!workspace) return
        setIsLoading(true)
        try {
            const response = await workspacesApi.listMembers(workspace.id)
            setMembers(response.data || [])
        } catch (error) {
            console.error("Failed to load members:", error)
            toast.error("Failed to load workspace members")
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
        if (!workspace || !selectedUserId) return
        setIsAdding(true)
        try {
            await workspacesApi.addMember(workspace.id, {
                user_id: selectedUserId,
                role: selectedRole,
            })
            toast.success("Member added successfully")
            setSelectedUserId("")
            setSelectedRole("member")
            loadMembers()
        } catch (error) {
            console.error("Failed to add member:", error)
            toast.error("Failed to add member")
        } finally {
            setIsAdding(false)
        }
    }

    const handleUpdateRole = async (userId: string, newRole: WorkspaceRole) => {
        if (!workspace) return
        try {
            await workspacesApi.updateMemberRole(workspace.id, userId, { role: newRole })
            toast.success("Role updated successfully")
            loadMembers()
        } catch (error) {
            console.error("Failed to update role:", error)
            toast.error("Failed to update role")
        }
    }

    const handleRemoveMember = async (userId: string, username: string) => {
        if (!workspace) return
        if (!confirm(`Remove "${username}" from this workspace?`)) return
        try {
            await workspacesApi.removeMember(workspace.id, userId)
            toast.success("Member removed successfully")
            loadMembers()
        } catch (error) {
            console.error("Failed to remove member:", error)
            toast.error("Failed to remove member")
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
                    <SheetTitle>Manage Members</SheetTitle>
                    <SheetDescription>
                        {workspace?.name} - Add or remove members and manage their roles.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Add Member Form */}
                    <div className="rounded-lg border p-4 space-y-4">
                        <Label className="text-sm font-medium">Add New Member</Label>
                        <div className="flex gap-2">
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUsers.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                            No users available
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
                            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as WorkspaceRole)}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
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
                            Add Member
                        </Button>
                    </div>

                    {/* Members List */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            Current Members ({members.length})
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
                                    No members yet. Add someone to get started.
                                </div>
                            ) : (
                                <Table>
                                    <TableBody>
                                        {members.map((member) => {
                                            const roleConfig = ROLE_CONFIG[member.role]
                                            const RoleIcon = roleConfig.icon
                                            const isOwner = member.role === "owner"

                                            return (
                                                <TableRow key={member.user_id}>
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarFallback className="text-xs">
                                                                    {getInitials(member.username || "?")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-sm truncate">
                                                                    {member.display_name || member.username}
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
                                                        {isOwner ? (
                                                            <Badge variant="outline" className={roleConfig.color}>
                                                                <RoleIcon className="mr-1 h-3 w-3" />
                                                                {roleConfig.label}
                                                            </Badge>
                                                        ) : (
                                                            <Select
                                                                value={member.role}
                                                                onValueChange={(v) =>
                                                                    handleUpdateRole(member.user_id, v as WorkspaceRole)
                                                                }
                                                            >
                                                                <SelectTrigger className="h-7 w-28 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="admin">Admin</SelectItem>
                                                                    <SelectItem value="member">Member</SelectItem>
                                                                    <SelectItem value="viewer">Viewer</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2 w-10">
                                                        {!isOwner && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                onClick={() =>
                                                                    handleRemoveMember(
                                                                        member.user_id,
                                                                        member.username || "this user"
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
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
