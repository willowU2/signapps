'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  X,
  UserRound,
  Users,
  Globe,
  CalendarDays,
  ShieldCheck,
  ShieldOff,
  Loader2,
} from 'lucide-react';
import {
  driveAclApi,
  type DriveAcl,
  type AclRole,
  type GranteeType,
} from '@/lib/api/storage';

// ─── Role config ────────────────────────────────────────────

interface RoleConfig {
  label: string;
  color: string;
  badgeCls: string;
}

const ROLE_CONFIG: Record<AclRole, RoleConfig> = {
  viewer: {
    label: 'Lecteur',
    color: 'gray',
    badgeCls: 'bg-muted text-muted-foreground border-border',
  },
  downloader: {
    label: 'Téléchargeur',
    color: 'blue',
    badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  editor: {
    label: 'Éditeur',
    color: 'green',
    badgeCls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  contributor: {
    label: 'Contributeur',
    color: 'amber',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  manager: {
    label: 'Gestionnaire',
    color: 'red',
    badgeCls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
  },
};

const GRANTEE_TYPE_LABELS: Record<GranteeType, string> = {
  user: 'Utilisateur',
  group: 'Groupe',
  everyone: 'Tous',
};

// ─── Helper: initials from name ──────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Role badge ──────────────────────────────────────────────

function RoleBadge({ role }: { role: AclRole }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <Badge variant="outline" className={`text-xs font-medium ${cfg.badgeCls}`}>
      {cfg.label}
    </Badge>
  );
}

// ─── Grant row ───────────────────────────────────────────────

interface GrantRowProps {
  grant: DriveAcl;
  onRoleChange: (aclId: string, role: AclRole) => void;
  onDelete: (aclId: string) => void;
  isInherited: boolean;
  loading: boolean;
}

function GrantRow({ grant, onRoleChange, onDelete, isInherited, loading }: GrantRowProps) {
  const displayName = grant.grantee_name ?? grant.grantee_id ?? 'Tous les utilisateurs';
  const avatarColor = getAvatarColor(displayName);
  const initials = grant.grantee_type === 'everyone' ? '★' : getInitials(displayName);

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      {/* Avatar */}
      <div
        className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
          grant.grantee_type === 'everyone' ? 'bg-muted text-muted-foreground' : avatarColor
        }`}
      >
        {grant.grantee_type === 'everyone' ? (
          <Globe className="h-4 w-4" />
        ) : (
          initials
        )}
      </div>

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
            {displayName}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50">
            {GRANTEE_TYPE_LABELS[grant.grantee_type]}
          </Badge>
          {isInherited && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 bg-muted/30 text-muted-foreground border-dashed"
            >
              Hérité
            </Badge>
          )}
        </div>
        {grant.expires_at && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            Expire le {new Date(grant.expires_at).toLocaleDateString('fr-FR')}
          </div>
        )}
      </div>

      {/* Role selector */}
      {isInherited ? (
        <RoleBadge role={grant.role} />
      ) : (
        <Select
          value={grant.role}
          onValueChange={(v) => onRoleChange(grant.id, v as AclRole)}
          disabled={loading}
        >
          <SelectTrigger className="h-7 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_CONFIG) as AclRole[]).map((role) => (
              <SelectItem key={role} value={role} className="text-xs">
                {ROLE_CONFIG[role].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Delete button — only for direct grants */}
      {!isInherited && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          onClick={() => onDelete(grant.id)}
          disabled={loading}
          title="Supprimer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export interface AclPanelProps {
  nodeId: string;
  nodeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AclPanel({ nodeId, nodeName, open, onOpenChange }: AclPanelProps) {
  const [grants, setGrants] = useState<DriveAcl[]>([]);
  const [inheritanceActive, setInheritanceActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);

  // Add grant form
  const [newGrantee, setNewGrantee] = useState('');
  const [newGranteeType, setNewGranteeType] = useState<GranteeType>('user');
  const [newRole, setNewRole] = useState<AclRole>('viewer');
  const [newExpiry, setNewExpiry] = useState('');
  const [adding, setAdding] = useState(false);

  const loadAcl = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const [aclRes, effectiveRes] = await Promise.all([
        driveAclApi.list(nodeId),
        driveAclApi.effective(nodeId),
      ]);
      setGrants(aclRes.data ?? []);
      // Determine inheritance: if effective.inherited_from is set, inheritance is active
      const eff = effectiveRes.data;
      setInheritanceActive(!eff?.inherited_from ? grants.length === 0 : true);
    } catch {
      // Fallback: just load direct grants
      try {
        const res = await driveAclApi.list(nodeId);
        setGrants(res.data ?? []);
      } catch {
        toast.error('Impossible de charger les permissions');
      }
    } finally {
      setLoading(false);
    }
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && nodeId) {
      loadAcl();
    }
  }, [open, nodeId, loadAcl]);

  const handleRoleChange = async (aclId: string, role: AclRole) => {
    setMutating(true);
    try {
      await driveAclApi.update(nodeId, aclId, { role });
      setGrants((prev) => prev.map((g) => (g.id === aclId ? { ...g, role } : g)));
      toast.success('Rôle mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour du rôle');
    } finally {
      setMutating(false);
    }
  };

  const handleDelete = async (aclId: string) => {
    setMutating(true);
    try {
      await driveAclApi.delete(nodeId, aclId);
      setGrants((prev) => prev.filter((g) => g.id !== aclId));
      toast.success('Permission supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setMutating(false);
    }
  };

  const handleToggleInheritance = async () => {
    setMutating(true);
    try {
      if (inheritanceActive) {
        await driveAclApi.breakInheritance(nodeId);
        setInheritanceActive(false);
        toast.success('Héritage cassé — les permissions sont maintenant indépendantes');
      } else {
        await driveAclApi.restoreInheritance(nodeId);
        setInheritanceActive(true);
        toast.success('Héritage restauré');
        await loadAcl();
      }
    } catch {
      toast.error("Erreur lors de la modification de l'héritage");
    } finally {
      setMutating(false);
    }
  };

  const handleAddGrant = async () => {
    if (newGranteeType !== 'everyone' && !newGrantee.trim()) {
      toast.error('Veuillez saisir un identifiant');
      return;
    }
    setAdding(true);
    try {
      const res = await driveAclApi.create(nodeId, {
        grantee_type: newGranteeType,
        grantee_id: newGranteeType !== 'everyone' ? newGrantee.trim() : undefined,
        role: newRole,
        inherit: false,
        expires_at: newExpiry || undefined,
      });
      setGrants((prev) => [...prev, res.data]);
      setNewGrantee('');
      setNewExpiry('');
      toast.success('Permission ajoutée');
    } catch {
      toast.error("Erreur lors de l'ajout de la permission");
    } finally {
      setAdding(false);
    }
  };

  const directGrants = grants.filter((g) => !g.inherit);
  const inheritedGrants = grants.filter((g) => g.inherit);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] flex flex-col overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base truncate">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Permissions — {nodeName}</span>
          </SheetTitle>
          <div className="flex items-center gap-2 mt-2">
            {inheritanceActive ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 text-xs">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Héritage actif
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs">
                <ShieldOff className="h-3 w-3 mr-1" />
                Héritage cassé
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className={`text-xs h-7 ${
                inheritanceActive
                  ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20'
                  : 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20'
              }`}
              onClick={handleToggleInheritance}
              disabled={mutating}
            >
              {mutating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : inheritanceActive ? (
                <ShieldOff className="h-3 w-3 mr-1" />
              ) : (
                <ShieldCheck className="h-3 w-3 mr-1" />
              )}
              {inheritanceActive ? "Casser l'héritage" : "Restaurer l'héritage"}
            </Button>
          </div>
        </SheetHeader>

        {/* Grants list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : grants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <ShieldCheck className="h-10 w-10 opacity-20" />
              <p>Aucune permission directe</p>
              {inheritanceActive && (
                <p className="text-xs text-center max-w-[240px]">
                  Les permissions sont héritées du dossier parent.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Direct grants */}
              {directGrants.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                    Permissions directes
                  </p>
                  <div className="divide-y divide-border/50">
                    {directGrants.map((grant) => (
                      <GrantRow
                        key={grant.id}
                        grant={grant}
                        onRoleChange={handleRoleChange}
                        onDelete={handleDelete}
                        isInherited={false}
                        loading={mutating}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Inherited grants */}
              {inheritedGrants.length > 0 && (
                <div className={directGrants.length > 0 ? 'mt-4' : ''}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                    Permissions héritées
                  </p>
                  <div className="divide-y divide-border/50">
                    {inheritedGrants.map((grant) => (
                      <GrantRow
                        key={grant.id}
                        grant={grant}
                        onRoleChange={handleRoleChange}
                        onDelete={handleDelete}
                        isInherited
                        loading={mutating}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add grant section */}
        <div className="shrink-0 border-t border-border bg-muted/30 px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">Ajouter une permission</p>

          {/* Grantee type + search */}
          <div className="flex gap-2">
            <Select
              value={newGranteeType}
              onValueChange={(v) => setNewGranteeType(v as GranteeType)}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <UserRound className="h-3 w-3" /> Utilisateur
                  </span>
                </SelectItem>
                <SelectItem value="group" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> Groupe
                  </span>
                </SelectItem>
                <SelectItem value="everyone" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3" /> Tous
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {newGranteeType !== 'everyone' && (
              <Input
                placeholder={newGranteeType === 'user' ? "ID ou nom d'utilisateur" : 'ID du groupe'}
                value={newGrantee}
                onChange={(e) => setNewGrantee(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            )}
          </div>

          {/* Role + expiry */}
          <div className="flex gap-2">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AclRole)}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_CONFIG) as AclRole[]).map((role) => (
                  <SelectItem key={role} value={role} className="text-xs">
                    {ROLE_CONFIG[role].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
              className="h-8 text-xs w-[140px]"
              title="Date d'expiration (optionnel)"
            />
          </div>

          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleAddGrant}
            disabled={adding || (newGranteeType !== 'everyone' && !newGrantee.trim())}
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            Ajouter
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
