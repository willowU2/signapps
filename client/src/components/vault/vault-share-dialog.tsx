"use client";

import { useState, useEffect } from "react";
import {
  Search,
  User,
  Users,
  Shield,
  Eye,
  Lock,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVaultStore } from "@/stores/vault-store";
import type { DecryptedVaultItem, ShareType, AccessLevel } from "@/types/vault";
import { usersApi, groupsApi } from "@/lib/api/identity";

// ─────────────────────────────────────────────────────────────────────────────
// Access level config
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_LEVELS: {
  value: AccessLevel;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  border: string;
  bg: string;
}[] = [
  {
    value: "full",
    label: "Accès complet",
    description: "Voir, copier et modifier le secret",
    icon: Shield,
    color: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-300 dark:border-emerald-700",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    value: "use_only",
    label: "Utilisation seulement",
    description: "Utiliser via le navigateur intégré sans voir le mot de passe",
    icon: Eye,
    color: "text-amber-600 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-700",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    value: "read_only",
    label: "Lecture seule",
    description: "Voir en lecture seule",
    icon: Lock,
    color: "text-slate-600 dark:text-slate-400",
    border: "border-slate-300 dark:border-slate-600",
    bg: "bg-slate-50 dark:bg-slate-900/40",
  },
];

interface Person {
  id: string;
  name: string;
  email: string;
}
interface Group {
  id: string;
  name: string;
  memberCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface VaultShareDialogProps {
  open: boolean;
  item: DecryptedVaultItem;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function VaultShareDialog({
  open,
  item,
  onClose,
}: VaultShareDialogProps) {
  const { shareItem } = useVaultStore();

  const [shareType, setShareType] = useState<ShareType>("person");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("use_only");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [persons, setPersons] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingData(true);
      Promise.all([
        usersApi.list(0, 100).catch(() => ({ data: { users: [] } })),
        groupsApi.list().catch(() => ({ data: [] })),
      ])
        .then(([usersRes, groupsRes]) => {
          // Shape of the API returns — backend mixes nested / flat
          // responses; both are tolerated.
          type ApiUser = {
            id: string;
            display_name?: string;
            username: string;
            email?: string;
          };
          type ApiGroup = {
            id: string;
            name: string;
            member_count?: number;
          };
          const usersResTyped = usersRes as {
            data?: { users?: ApiUser[] };
            users?: ApiUser[];
          };
          const groupsResTyped = groupsRes as {
            data?: ApiGroup[];
          } & { [K in keyof ApiGroup[]]?: ApiGroup[][K] };

          const userList: ApiUser[] =
            usersResTyped.data?.users ?? usersResTyped.users ?? [];
          const groupList: ApiGroup[] =
            groupsResTyped.data ??
            (Array.isArray(groupsRes) ? (groupsRes as ApiGroup[]) : []);

          setPersons(
            userList.map((u) => ({
              id: u.id,
              name: u.display_name || u.username,
              email: u.email || "",
            })),
          );
          setGroups(
            groupList.map((g) => ({
              id: g.id,
              name: g.name,
              memberCount: g.member_count || 0,
            })),
          );
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [open]);

  // ── Filter ──────────────────────────────────────────────────────────────

  const filteredPersons = persons.filter(
    (p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredGroups = groups.filter(
    (g) =>
      !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!selectedId) {
      toast.error("Sélectionnez un destinataire");
      return;
    }

    setLoading(true);
    try {
      await shareItem(
        item.id,
        selectedId,
        shareType,
        accessLevel,
        expiresAt || undefined,
      );
      toast.success("Élément partagé avec succès");
      onClose();
    } catch {
      toast.error("Erreur lors du partage");
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (v: ShareType) => {
    setShareType(v);
    setSelectedId(null);
    setSearchQuery("");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            Partager ce secret
          </DialogTitle>
          <DialogDescription>
            Partagez <strong>{item.name}</strong> en choisissant le destinataire
            et le niveau d'accès.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* ── Share type ── */}
          <div className="space-y-2">
            <Label>Type de destinataire</Label>
            <div className="flex gap-2">
              <TypeButton
                active={shareType === "person"}
                icon={<User className="h-4 w-4" />}
                label="Personne"
                onClick={() => handleTypeChange("person")}
              />
              <TypeButton
                active={shareType === "group"}
                icon={<Users className="h-4 w-4" />}
                label="Groupe"
                onClick={() => handleTypeChange("group")}
              />
            </div>
          </div>

          {/* ── Picker ── */}
          <div className="space-y-2">
            <Label>
              {shareType === "person"
                ? "Rechercher une personne"
                : "Rechercher un groupe"}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={
                  shareType === "person" ? "Nom ou email…" : "Nom du groupe…"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <ScrollArea className="h-40 rounded-md border border-border">
              {loadingData ? (
                <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                  Chargement...
                </div>
              ) : (
                <div className="p-1 space-y-0.5">
                  {shareType === "person" &&
                    filteredPersons.map((p) => (
                      <PersonItem
                        key={p.id}
                        person={p}
                        selected={selectedId === p.id}
                        onClick={() => setSelectedId(p.id)}
                      />
                    ))}
                  {shareType === "group" &&
                    filteredGroups.map((g) => (
                      <GroupItem
                        key={g.id}
                        group={g}
                        selected={selectedId === g.id}
                        onClick={() => setSelectedId(g.id)}
                      />
                    ))}
                  {shareType === "person" && filteredPersons.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4">
                      Aucune personne trouvée
                    </p>
                  )}
                  {shareType === "group" && filteredGroups.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4">
                      Aucun groupe trouvé
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ── Access level ── */}
          <div className="space-y-2">
            <Label>Niveau d'accès</Label>
            <div className="space-y-2">
              {ACCESS_LEVELS.map((lvl) => {
                const Icon = lvl.icon;
                const isSelected = accessLevel === lvl.value;
                return (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => setAccessLevel(lvl.value)}
                    className={cn(
                      "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                      isSelected
                        ? `${lvl.border} ${lvl.bg}`
                        : "border-border hover:bg-accent/50",
                    )}
                  >
                    <div className={cn("mt-0.5 shrink-0", lvl.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isSelected && lvl.color,
                        )}
                      >
                        {lvl.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lvl.description}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <div
                        className={cn(
                          "h-4 w-4 rounded-full border-2 transition-colors",
                          isSelected
                            ? "border-current bg-current"
                            : "border-muted-foreground",
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Expiration ── */}
          <div className="space-y-1.5">
            <Label htmlFor="expires-at" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Expiration (optionnel)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="expires-at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="flex-1"
              />
              {expiresAt && (
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setExpiresAt("")}
                  className="h-8 w-8"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleShare}
            disabled={loading || !selectedId}
            className="gap-1.5"
          >
            <Shield className="h-4 w-4" />
            {loading ? "Partage en cours…" : "Partager"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TypeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium transition-colors",
        active
          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PersonItem({
  person,
  selected,
  onClick,
}: {
  person: Person;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        selected
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "hover:bg-accent",
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {person.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">{person.email}</p>
      </div>
    </button>
  );
}

function GroupItem({
  group,
  selected,
  onClick,
}: {
  group: Group;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        selected
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "hover:bg-accent",
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Users className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{group.name}</p>
        <p className="text-xs text-muted-foreground">
          {group.memberCount} membres
        </p>
      </div>
    </button>
  );
}
