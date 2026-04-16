"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Share2,
  X,
  User,
  Users,
  Building2,
  Globe,
  Loader2,
} from "lucide-react";
import { useSharing } from "@/hooks/use-sharing";
import type {
  SharingResourceType,
  SharingRole,
  SharingGranteeType,
  SharingGrant,
} from "@/types/sharing";
import {
  SHARING_ROLE_LABELS,
  SHARING_GRANTEE_TYPE_LABELS,
} from "@/types/sharing";
import { GranteePicker } from "./grantee-picker";
import { TemplatePicker } from "./template-picker";

// ─── Role badge config ──────────────────────────────────────────────────────

const ROLE_BADGE_CLS: Record<SharingRole, string> = {
  viewer: "bg-muted text-muted-foreground border-border",
  editor:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  manager:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  deny: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
};

// ─── Avatar helpers ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic color palette for user avatars — hashed from display name so
// the same person always gets the same color. These 8 colors are intentional
// design tokens and should NOT be replaced with semantic bg-primary/muted.
const AVATAR_PALETTE = [
  "bg-blue-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-orange-500",
] as const;

function getAvatarColor(name: string): string {
  const colors = AVATAR_PALETTE;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Grantee type icon ──────────────────────────────────────────────────────

function GranteeTypeIcon({ type }: { type: SharingGranteeType }) {
  const cls = "h-3 w-3";
  switch (type) {
    case "user":
      return <User className={cls} />;
    case "group":
      return <Users className={cls} />;
    case "org_node":
      return <Building2 className={cls} />;
    case "everyone":
      return <Globe className={cls} />;
  }
}

// ─── Grant row ──────────────────────────────────────────────────────────────

interface GrantRowProps {
  grant: SharingGrant;
  onRoleChange: (grantId: string, role: SharingRole) => void;
  onDelete: (grantId: string) => void;
  loading: boolean;
}

function GrantRow({ grant, onRoleChange, onDelete, loading }: GrantRowProps) {
  const displayName =
    grant.grantee_type === "everyone"
      ? "Tout le monde"
      : (grant.grantee_id ?? "Inconnu");
  const avatarColor = getAvatarColor(displayName);
  const initials =
    grant.grantee_type === "everyone" ? "★" : getInitials(displayName);

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      {/* Avatar */}
      <div
        className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
          grant.grantee_type === "everyone"
            ? "bg-muted text-muted-foreground"
            : avatarColor
        }`}
      >
        {grant.grantee_type === "everyone" ? (
          <Globe className="h-4 w-4" />
        ) : (
          initials
        )}
      </div>

      {/* Name + grantee type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
            {displayName}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 flex items-center gap-0.5"
          >
            <GranteeTypeIcon type={grant.grantee_type} />
            <span>{SHARING_GRANTEE_TYPE_LABELS[grant.grantee_type]}</span>
          </Badge>
          {grant.inherit && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 bg-muted/30 text-muted-foreground border-dashed"
            >
              Hérité
            </Badge>
          )}
          {grant.can_reshare && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 bg-muted/30 text-muted-foreground"
            >
              Peut partager
            </Badge>
          )}
        </div>
        {grant.expires_at && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Expire le {new Date(grant.expires_at).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>

      {/* Role selector */}
      {grant.inherit ? (
        <Badge
          variant="outline"
          className={`text-xs font-medium ${ROLE_BADGE_CLS[grant.role]}`}
        >
          {SHARING_ROLE_LABELS[grant.role]}
        </Badge>
      ) : (
        <Select
          value={grant.role}
          onValueChange={(v) => onRoleChange(grant.id, v as SharingRole)}
          disabled={loading}
        >
          <SelectTrigger className="h-7 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SHARING_ROLE_LABELS) as SharingRole[]).map((role) => (
              <SelectItem key={role} value={role} className="text-xs">
                {SHARING_ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Delete button — only for direct grants */}
      {!grant.inherit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          onClick={() => onDelete(grant.id)}
          disabled={loading}
          title="Supprimer"
          aria-label="Supprimer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ShareDialogProps {
  resourceType: SharingResourceType;
  resourceId: string;
  resourceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ShareDialog({
  resourceType,
  resourceId,
  resourceName,
  open,
  onOpenChange,
}: ShareDialogProps) {
  const { grants, loading, createGrant, revokeGrant, updateGrantRole } =
    useSharing(open ? resourceType : null, open ? resourceId : null);

  // Form state
  const [granteeType, setGranteeType] = useState<SharingGranteeType>("user");
  const [granteeId, setGranteeId] = useState<string | null>(null);
  const [granteeName, setGranteeName] = useState("");
  const [role, setRole] = useState<SharingRole>("viewer");
  const [canReshare, setCanReshare] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mutating, setMutating] = useState(false);

  const handleAdd = async () => {
    if (granteeType !== "everyone" && !granteeId) return;
    setSubmitting(true);
    try {
      await createGrant({
        grantee_type: granteeType,
        grantee_id: granteeType !== "everyone" ? granteeId : null,
        role,
        can_reshare: canReshare,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setGranteeId(null);
      setGranteeName("");
      setExpiresAt("");
      setCanReshare(false);
    } catch {
      // toast already shown by the hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (grantId: string, newRole: SharingRole) => {
    setMutating(true);
    try {
      await updateGrantRole(grantId, newRole);
    } catch {
      // toast already shown by the hook
    } finally {
      setMutating(false);
    }
  };

  const handleDelete = async (grantId: string) => {
    setMutating(true);
    try {
      await revokeGrant(grantId);
    } catch {
      // toast already shown by the hook
    } finally {
      setMutating(false);
    }
  };

  const directGrants = grants.filter((g) => !g.inherit);
  const inheritedGrants = grants.filter((g) => g.inherit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Partager — {resourceName}</span>
          </DialogTitle>
          <DialogDescription>
            Gérez les accès à cette ressource. Les modifications sont appliquées
            immédiatement.
          </DialogDescription>
        </DialogHeader>

        {/* Apply template section */}
        <div className="shrink-0 bg-muted/20 border-b border-border px-6 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            Appliquer un template
          </p>
          <TemplatePicker
            resourceType={resourceType}
            resourceId={resourceId}
            onApplied={() => {
              // Grants list will refresh automatically via the useSharing hook
              // when the dialog detects the resource has changed; no manual
              // refresh needed here.
            }}
          />
        </div>

        {/* Add grant form */}
        <div className="shrink-0 bg-muted/30 border-y border-border px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">
            Ajouter un accès
          </p>

          {/* Grantee type + picker */}
          <div className="flex gap-2">
            <Select
              value={granteeType}
              onValueChange={(v) => {
                setGranteeType(v as SharingGranteeType);
                setGranteeId(null);
                setGranteeName("");
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3 w-3" />
                    Utilisateur
                  </span>
                </SelectItem>
                <SelectItem value="group" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    Groupe
                  </span>
                </SelectItem>
                <SelectItem value="org_node" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" />
                    Département
                  </span>
                </SelectItem>
                <SelectItem value="everyone" className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3" />
                    Tout le monde
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <GranteePicker
              granteeType={granteeType}
              value={granteeId}
              onChange={(id, label) => {
                setGranteeId(id);
                setGranteeName(label);
              }}
              disabled={submitting}
            />
          </div>

          {/* Role + expiry */}
          <div className="flex gap-2">
            <Select
              value={role}
              onValueChange={(v) => setRole(v as SharingRole)}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SHARING_ROLE_LABELS) as SharingRole[]).map(
                  (r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {SHARING_ROLE_LABELS[r]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-8 text-xs w-[140px]"
              title="Date d'expiration (optionnel)"
            />
          </div>

          {/* Can reshare */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="can-reshare"
              checked={canReshare}
              onCheckedChange={(v) => setCanReshare(v === true)}
            />
            <Label
              htmlFor="can-reshare"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Autoriser le destinataire à re-partager cette ressource
            </Label>
          </div>

          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleAdd}
            disabled={submitting || (granteeType !== "everyone" && !granteeId)}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Ajouter
          </Button>
        </div>

        {/* Grants list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : grants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Share2 className="h-10 w-10 opacity-20" />
              <p>Aucun partage pour l&apos;instant</p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Direct grants */}
              {directGrants.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Accès directs
                  </p>
                  <div className="divide-y divide-border/50">
                    {directGrants.map((grant) => (
                      <GrantRow
                        key={grant.id}
                        grant={grant}
                        onRoleChange={handleRoleChange}
                        onDelete={handleDelete}
                        loading={mutating}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Separator between sections */}
              {directGrants.length > 0 && inheritedGrants.length > 0 && (
                <Separator className="my-3" />
              )}

              {/* Inherited grants */}
              {inheritedGrants.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Accès hérités
                  </p>
                  <div className="divide-y divide-border/50">
                    {inheritedGrants.map((grant) => (
                      <GrantRow
                        key={grant.id}
                        grant={grant}
                        onRoleChange={handleRoleChange}
                        onDelete={handleDelete}
                        loading={mutating}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
