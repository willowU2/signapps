"use client"

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
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
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Trash2, UserPlus, Shield, User, Eye, Crown, Users } from 'lucide-react';
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
    viewer: { label: "Viewer", icon: Eye, color: "text-muted-foreground" },
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
            toast.error("Impossible de charger les membres")
        } finally {
            setIsLoading(false)
        }
    }

    const loadUsers = async () => {
        try {
            const response = await usersApi.list()
            setAllUsers(response.data?.users ?? [])
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
            toast.success("Membre ajouté avec succès")
            setSelectedUserId("")
            setSelectedRole("member")
            loadMembers()
        } catch (error) {
            console.error("Impossible d'ajouter le membre:", error)
            toast.error("Impossible d'ajouter le membre")
        } finally {
            setIsAdding(false)
        }
    }

    const handleUpdateRole = async (userId: string, newRole: WorkspaceRole) => {
        if (!workspace) return
        try {
            await workspacesApi.updateMemberRole(workspace.id, userId, { role: newRole })
            toast.success("Rôle mis à jour avec succès")
            loadMembers()
        } catch (error) {
            console.error("Impossible de mettre à jour le rôle:", error)
            toast.error("Impossible de mettre à jour le rôle")
        }
    }

    const handleRemoveMember = async (userId: string, username: string) => {
        if (!workspace) return
        if (!confirm(`Remove "${username}" from this workspace?`)) return
        try {
            await workspacesApi.removeMember(workspace.id, userId)
            toast.success("Membre retiré avec succès")
            loadMembers()
        } catch (error) {
            console.error("Impossible de retirer le membre:", error)
            toast.error("Impossible de retirer le membre")
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-border/40 shadow-2xl glass-panel">
                <div className="p-6 pb-4 border-b border-border/50 bg-muted/10">
                    <DialogHeader>
                        <div className="flex items-start gap-4 mb-1">
                           <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 shadow-sm ring-1 ring-primary/20">
                              <Users className="h-6 w-6" />
                           </div>
                           <div className="space-y-1">
                             <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground text-left">
                               Manage Members
                             </DialogTitle>
                             <DialogDescription className="text-[14.5px] font-medium text-muted-foreground leading-snug text-left">
                               {workspace?.name} - Add or remove members and manage their roles.
                             </DialogDescription>
                           </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 pt-4 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Add Member Form */}
                    <div className="rounded-xl border border-border/60 bg-sidebar-accent/30 p-5 shadow-sm space-y-4">
                        <Label className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">Add New Member</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger className="flex-1 h-[48px] bg-background border-border/80 focus:ring-1 focus:ring-primary shadow-sm rounded-lg transition-all">
                                    <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableUsers.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                            No users available
                                        </SelectItem>
                                    ) : (
                                        availableUsers.map((user) => (
                                            <SelectItem key={user.id} value={user.id} className="font-medium cursor-pointer">
                                                {user.display_name || user.username}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <div className="flex gap-3">
                                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as WorkspaceRole)}>
                                    <SelectTrigger className="w-[130px] h-[48px] bg-background border-border/80 focus:ring-1 focus:ring-primary shadow-sm rounded-lg transition-all">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin" className="font-medium cursor-pointer">Admin</SelectItem>
                                        <SelectItem value="member" className="font-medium cursor-pointer">Member</SelectItem>
                                        <SelectItem value="viewer" className="font-medium cursor-pointer">Viewer</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={handleAddMember}
                                    disabled={!selectedUserId || isAdding}
                                    className="h-[48px] px-6 rounded-lg text-sm bg-[#4d51f2] hover:bg-[#4d51f2]/90 text-white shadow-sm font-bold transition-all hover:scale-[1.02]"
                                >
                                    {isAdding ? (
                                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
                                    ) : (
                                        <UserPlus className="mr-2 h-4 w-4" />
                                    )}
                                    Add
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Members List */}
                    <div className="space-y-4">
                        <Label className="text-[13px] font-extrabold text-foreground/85 uppercase tracking-wide">
                            Current Members <span className="text-muted-foreground/70 ml-1">({members.length})</span>
                        </Label>
                        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
                            {isLoading ? (
                                <div className="p-4 space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <Skeleton className="h-9 w-9 rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-48" />
                                            </div>
                                            <Skeleton className="h-8 w-24 rounded-lg" />
                                        </div>
                                    ))}
                                </div>
                            ) : members.length === 0 ? (
                                <div className="p-10 text-center flex flex-col items-center justify-center">
                                    <div className="p-3 bg-primary/10 rounded-full mb-3">
                                        <Users className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">No members yet</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Add someone to get started.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableBody>
                                        {members.map((member) => {
                                            const roleConfig = ROLE_CONFIG[member.role]
                                            const RoleIcon = roleConfig.icon
                                            const isOwner = member.role === "owner"

                                            return (
                                                <TableRow key={member.user_id} className="hover:bg-sidebar-accent/30 transition-colors">
                                                    <TableCell className="py-3 px-4">
                                                        <div className="flex items-center gap-3.5">
                                                            <Avatar className="h-9 w-9 shadow-sm border border-border/50">
                                                                <AvatarFallback className="text-[11px] font-bold bg-primary/5 text-primary">
                                                                    {getInitials(member.username || "?")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-[14px] truncate text-foreground/90">
                                                                    {member.display_name || member.username}
                                                                </p>
                                                                {member.email && (
                                                                    <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                                                                        {member.email}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3 px-4 w-[140px]">
                                                        {isOwner ? (
                                                            <Badge variant="outline" className={cn("px-2.5 py-1 whitespace-nowrap bg-background shadow-sm border-border/80", roleConfig.color)}>
                                                                <RoleIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                {roleConfig.label}
                                                            </Badge>
                                                        ) : (
                                                            <Select
                                                                value={member.role}
                                                                onValueChange={(v) =>
                                                                    handleUpdateRole(member.user_id, v as WorkspaceRole)
                                                                }
                                                            >
                                                                <SelectTrigger className="h-8 w-[110px] text-xs font-semibold focus:ring-1 focus:ring-primary">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="admin" className="font-medium cursor-pointer">Admin</SelectItem>
                                                                    <SelectItem value="member" className="font-medium cursor-pointer">Member</SelectItem>
                                                                    <SelectItem value="viewer" className="font-medium cursor-pointer">Viewer</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-3 pl-0 pr-4 w-12 text-right">
                                                        {!isOwner && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
            </DialogContent>
        </Dialog>
    )
}
