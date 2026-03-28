'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Plus, Trash2, Users, Shield, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { socialApi } from '@/lib/api/social';
import type { Workspace, WorkspaceMember } from '@/lib/api/social';

// --- Create Workspace Dialog ---

function CreateWorkspaceDialog({
  open,
  onClose,
  onCreate,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description?: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              placeholder="Marketing Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              placeholder="What this workspace is for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleCreate} disabled={!name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workspace
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Invite Member Dialog ---

function InviteMemberDialog({
  open,
  onClose,
  onInvite,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (data: { userId: string; role: string }) => void;
  saving: boolean;
}) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');

  useEffect(() => {
    if (open) {
      setUserId('');
      setRole('member');
    }
  }, [open]);

  const handleInvite = () => {
    if (!userId.trim()) return;
    onInvite({ userId: userId.trim(), role });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>User ID or Email</Label>
            <Input
              placeholder="user@example.com"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleInvite} disabled={!userId.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invite
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---

export function WorkspaceManager({ currentUserId }: { currentUserId?: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [deleteWsId, setDeleteWsId] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const res = await socialApi.workspaces.list();
      setWorkspaces(res.data);
      if (res.data.length > 0 && !selectedId) {
        setSelectedId(res.data[0].id);
      }
    } catch {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const fetchMembers = useCallback(async (wsId: string) => {
    try {
      setLoadingMembers(true);
      const res = await socialApi.workspaces.listMembers(wsId);
      setMembers(res.data);
    } catch {
      toast.error('Impossible de charger les membres');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (selectedId) {
      fetchMembers(selectedId);
    } else {
      setMembers([]);
    }
  }, [selectedId, fetchMembers]);

  const currentWorkspace = workspaces.find((w) => w.id === selectedId);
  const isOwner = members.some((m) => m.role === 'owner' && m.userId === currentUserId);

  const handleSelectWorkspace = (id: string) => {
    setSelectedId(id);
  };

  const handleCreateWorkspace = async (data: { name: string; description?: string }) => {
    try {
      setSaving(true);
      const res = await socialApi.workspaces.create(data);
      toast.success('Workspace created');
      setIsCreateOpen(false);
      await fetchWorkspaces();
      setSelectedId(res.data.id);
    } catch {
      toast.error('Impossible de créer workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteWsId) return;
    try {
      await socialApi.workspaces.delete(deleteWsId);
      toast.success('Workspace deleted');
      setDeleteWsId(null);
      if (selectedId === deleteWsId) {
        setSelectedId(null);
      }
      await fetchWorkspaces();
    } catch {
      toast.error('Impossible de supprimer workspace');
    }
  };

  const handleInviteMember = async (data: { userId: string; role: string }) => {
    if (!selectedId) return;
    try {
      setSaving(true);
      await socialApi.workspaces.inviteMember(selectedId, data);
      toast.success('Member invited');
      setIsInviteOpen(false);
      await fetchMembers(selectedId);
    } catch {
      toast.error('Failed to invite member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberId || !selectedId) return;
    try {
      await socialApi.workspaces.removeMember(selectedId, removeMemberId);
      toast.success('Member removed');
      setRemoveMemberId(null);
      await fetchMembers(selectedId);
    } catch {
      toast.error('Impossible de retirer le membre');
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Workspaces</h2>
          <p className="text-sm text-muted-foreground">Organize your team&apos;s social media accounts</p>
        </div>
        <div className="flex items-center gap-2">
          {workspaces.length > 0 && (
            <Select value={selectedId ?? ''} onValueChange={handleSelectWorkspace}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </Button>
        </div>
      </div>

      {/* Current Workspace Details */}
      {currentWorkspace ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="py-6 px-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{currentWorkspace.name}</h3>
                  {currentWorkspace.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentWorkspace.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {currentWorkspace.memberCount} member{currentWorkspace.memberCount !== 1 ? 's' : ''}
                    </span>
                    <span>
                      Created {format(new Date(currentWorkspace.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setDeleteWsId(currentWorkspace.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Members</h3>
              <Button variant="outline" size="sm" onClick={() => setIsInviteOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </div>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium text-muted-foreground">
                            {(member.displayName || member.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{member.displayName || member.username}</span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColor(member.role)}`}
                            >
                              {member.role === 'owner' && <Shield className="h-3 w-3 mr-1" />}
                              {member.role}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">@{member.username}</p>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          Joined {format(new Date(member.joinedAt), 'MMM d, yyyy')}
                        </div>
                        {isOwner && member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => setRemoveMemberId(member.userId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {members.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-medium">No workspace selected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create a workspace to get started
          </p>
          <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workspace
          </Button>
        </div>
      )}

      <CreateWorkspaceDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateWorkspace}
        saving={saving}
      />

      <InviteMemberDialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvite={handleInviteMember}
        saving={saving}
      />

      <AlertDialog open={!!removeMemberId} onOpenChange={(o) => !o && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le membre</AlertDialogTitle>
            <AlertDialogDescription>
              Ce membre perdra l'accès à cet espace de travail. Il pourra être réinvité ultérieurement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteWsId} onOpenChange={(o) => !o && setDeleteWsId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'espace de travail</AlertDialogTitle>
            <AlertDialogDescription>
              Cet espace de travail sera supprimé définitivement et tous les membres seront retirés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkspace} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
