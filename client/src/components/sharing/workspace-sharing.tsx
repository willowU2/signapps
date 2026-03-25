'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Crown,
  Shield,
  Eye,
  MoreHorizontal,
  Trash2,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  workspacesApi,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@/lib/api/tenant';
import { usersApi, type User } from '@/lib/api/identity';

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceSharingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  currentUserId?: string;
}

// ============================================================================
// Role config
// ============================================================================

const ROLE_CONFIG: Record<
  WorkspaceRole,
  { label: string; icon: React.ElementType; color: string }
> = {
  owner: {
    label: 'Proprietaire',
    icon: Crown,
    color: 'text-amber-600 dark:text-amber-400',
  },
  admin: {
    label: 'Administrateur',
    icon: Shield,
    color: 'text-blue-600 dark:text-blue-400',
  },
  member: {
    label: 'Membre',
    icon: Users,
    color: 'text-green-600 dark:text-green-400',
  },
  viewer: {
    label: 'Lecteur',
    icon: Eye,
    color: 'text-muted-foreground',
  },
};

// ============================================================================
// Component
// ============================================================================

export function WorkspaceSharing({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  currentUserId,
}: WorkspaceSharingProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load members
  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await workspacesApi.listMembers(workspaceId);
      setMembers(response.data || []);
    } catch {
      toast.error('Erreur lors du chargement des membres');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open, loadMembers]);

  // Search users by email
  useEffect(() => {
    if (!inviteEmail || inviteEmail.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await usersApi.list(1, 10);
        const users = response.data?.users || response.data || [];
        const filtered = users.filter(
          (u: User) =>
            (u.email || '').toLowerCase().includes(inviteEmail.toLowerCase()) ||
            u.username.toLowerCase().includes(inviteEmail.toLowerCase())
        );
        // Exclude already-invited members
        const memberIds = new Set(members.map((m) => m.user_id));
        setSearchResults(filtered.filter((u: User) => !memberIds.has(u.id)));
      } catch {
        // Silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inviteEmail, members]);

  const handleInvite = async (userId?: string) => {
    const targetUserId = userId;
    if (!targetUserId) {
      toast.error('Selectionnez un utilisateur');
      return;
    }

    setIsInviting(true);
    try {
      await workspacesApi.addMember(workspaceId, {
        user_id: targetUserId,
        role: inviteRole,
      });
      toast.success('Membre ajoute');
      setInviteEmail('');
      setSearchResults([]);
      await loadMembers();
    } catch {
      toast.error('Erreur lors de l\'invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: WorkspaceRole) => {
    try {
      await workspacesApi.updateMemberRole(workspaceId, userId, {
        role: newRole,
      });
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId ? { ...m, role: newRole } : m
        )
      );
      toast.success('Role mis a jour');
    } catch {
      toast.error('Erreur lors de la mise a jour du role');
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await workspacesApi.removeMember(workspaceId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success('Membre retire');
    } catch {
      toast.error('Erreur lors du retrait du membre');
    }
  };

  const currentUserRole = members.find(
    (m) => m.user_id === currentUserId
  )?.role;
  const canManage =
    currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Partager &quot;{workspaceName}&quot;
          </DialogTitle>
          <DialogDescription>
            Gerez les membres et les permissions de cet espace de travail
          </DialogDescription>
        </DialogHeader>

        {/* Invite section */}
        {canManage && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Inviter par email
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="email@exemple.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as WorkspaceRole)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="viewer">Lecteur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => handleInvite(user.id)}
                    disabled={isInviting}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {(user.display_name || user.username)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="font-medium truncate">
                        {user.display_name || user.username}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {user.email || `@${user.username}`}
                      </span>
                    </div>
                    {isInviting ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                    ) : (
                      <UserPlus className="h-4 w-4 ml-auto text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Recherche...
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Members list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Membres ({members.length})
            </Label>
          </div>

          <ScrollArea className="max-h-[280px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Aucun membre</p>
              </div>
            ) : (
              <div className="space-y-1">
                {members.map((member) => (
                  <MemberItem
                    key={member.user_id}
                    member={member}
                    canManage={canManage && member.role !== 'owner'}
                    isCurrentUser={member.user_id === currentUserId}
                    onRoleChange={(role) =>
                      handleRoleChange(member.user_id, role)
                    }
                    onRemove={() => handleRemove(member.user_id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MemberItem sub-component
// ============================================================================

interface MemberItemProps {
  member: WorkspaceMember;
  canManage: boolean;
  isCurrentUser: boolean;
  onRoleChange: (role: WorkspaceRole) => void;
  onRemove: () => void;
}

function MemberItem({
  member,
  canManage,
  isCurrentUser,
  onRoleChange,
  onRemove,
}: MemberItemProps) {
  const roleConfig = ROLE_CONFIG[member.role];
  const RoleIcon = roleConfig.icon;

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.avatar_url} />
        <AvatarFallback className="text-xs">
          {(member.display_name || member.username)
            .slice(0, 2)
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {member.display_name || member.username}
          </span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-[10px] h-4">
              Vous
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate block">
          {member.email || `@${member.username}`}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canManage ? (
          <Select
            value={member.role}
            onValueChange={(v) => onRoleChange(v as WorkspaceRole)}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">
                <span className="flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  Admin
                </span>
              </SelectItem>
              <SelectItem value="member">
                <span className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  Membre
                </span>
              </SelectItem>
              <SelectItem value="viewer">
                <span className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  Lecteur
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge
            variant="secondary"
            className={cn('text-xs gap-1', roleConfig.color)}
          >
            <RoleIcon className="h-3 w-3" />
            {roleConfig.label}
          </Badge>
        )}

        {canManage && !isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Retirer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export default WorkspaceSharing;
