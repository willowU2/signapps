"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Save,
  UserPlus,
  X,
  Move,
  Trash2,
  Shield,
  History,
  Clock,
  LinkIcon,
  Ban,
  Star,
  UserCheck,
  Network,
  MapPin,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type {
  OrgNode,
  OrgTree,
  Assignment,
  Person,
  OrgPolicy,
  OrgGroup,
  Site,
  AssignmentType,
  ResponsibilityType,
  EffectivePolicy,
  PolicySource,
  OrgAuditEntry,
  OrgDelegation,
  OrgBoardMember,
} from "@/types/org";
import {
  getNodeTypeConfig,
  ALL_TABS,
  CATEGORY_LABELS,
  getVisibleTabs,
} from "./tab-config";
import { GovernanceTab } from "./governance-tab";
import { ComputersTabContent } from "./computers-tab";
import { GpoTabContent } from "./gpo-tab";
import { KerberosTabContent } from "./kerberos-tab";
import { DnsTabContent } from "./dns-tab";

// =============================================================================
// Local constants
// =============================================================================

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  holder: "Titulaire",
  interim: "Interimaire",
  deputy: "Adjoint",
  intern: "Stagiaire",
  contractor: "Prestataire",
};

const RESPONSIBILITY_TYPE_LABELS: Record<string, string> = {
  hierarchical: "Hierarchique",
  functional: "Fonctionnel",
  matrix: "Matriciel",
};

const POLICY_DOMAIN_LABELS: Record<string, { label: string; color: string }> = {
  security: { label: "Securite", color: "text-red-600 dark:text-red-400" },
  modules: { label: "Modules", color: "text-blue-600 dark:text-blue-400" },
  naming: { label: "Nommage", color: "text-green-600 dark:text-green-400" },
  delegation: {
    label: "Delegation",
    color: "text-purple-600 dark:text-purple-400",
  },
  compliance: {
    label: "Conformite",
    color: "text-orange-600 dark:text-orange-400",
  },
  custom: {
    label: "Personnalise",
    color: "text-slate-600 dark:text-slate-400",
  },
};

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Creation", color: "text-green-600" },
  update: { label: "Modification", color: "text-blue-600" },
  delete: { label: "Suppression", color: "text-red-600" },
  move: { label: "Deplacement", color: "text-orange-600" },
  assign: { label: "Affectation", color: "text-purple-600" },
  unassign: { label: "Desaffectation", color: "text-pink-600" },
};

const GROUP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  static: { label: "Statique", color: "text-blue-600 dark:text-blue-400" },
  dynamic: { label: "Dynamique", color: "text-green-600 dark:text-green-400" },
  derived: { label: "Derive", color: "text-orange-600 dark:text-orange-400" },
  hybrid: { label: "Hybride", color: "text-purple-600 dark:text-purple-400" },
};

const COUNTRY_FLAGS: Record<string, string> = {
  France: "FR",
  Belgique: "BE",
  Suisse: "CH",
  Canada: "CA",
  Luxembourg: "LU",
  Allemagne: "DE",
  "Royaume-Uni": "GB",
  "Etats-Unis": "US",
  Espagne: "ES",
  Italie: "IT",
};

// =============================================================================
// Helper: ancestor names breadcrumb
// =============================================================================

function getAncestorNames(nodeId: string, nodes: OrgNode[]): string[] {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const names: string[] = [];
  let current = map.get(nodeId);
  while (current?.parent_id) {
    const parent = map.get(current.parent_id);
    if (parent) {
      names.unshift(parent.name);
      current = parent;
    } else {
      break;
    }
  }
  return names;
}

// =============================================================================
// Types
// =============================================================================

type AssignmentWithPerson = Assignment & { person?: Person };

// =============================================================================
// PoliciesTab
// =============================================================================

function PoliciesTab({
  nodeId,
  allPolicies,
}: {
  nodeId: string;
  allPolicies: OrgPolicy[];
}) {
  const [effective, setEffective] = useState<EffectivePolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgApi.policies
      .resolveNode(nodeId)
      .then((res) => {
        if (!cancelled) setEffective(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setEffective(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const handleAttachPolicy = async () => {
    if (!selectedPolicyId) return;
    setAttaching(true);
    try {
      await orgApi.policies.addLink(selectedPolicyId, {
        link_type: "node",
        link_id: nodeId,
        is_blocked: false,
      });
      toast.success("Politique attachee");
      setAttachOpen(false);
      setSelectedPolicyId("");
      const res = await orgApi.policies.resolveNode(nodeId);
      setEffective(res.data ?? null);
    } catch {
      toast.error("Erreur lors de l'attachement");
    } finally {
      setAttaching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement des politiques...
      </div>
    );
  }

  const sources = effective?.sources ?? [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sources.length} regle(s) effective(s)
        </p>
        <DropdownMenu open={attachOpen} onOpenChange={setAttachOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <LinkIcon className="h-4 w-4 mr-1" />
              Attacher une politique
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3">
            <div className="space-y-3">
              <Select
                value={selectedPolicyId}
                onValueChange={setSelectedPolicyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une politique..." />
                </SelectTrigger>
                <SelectContent>
                  {allPolicies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="w-full"
                onClick={handleAttachPolicy}
                disabled={!selectedPolicyId || attaching}
              >
                {attaching ? "Attachement..." : "Attacher"}
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune politique effective</p>
          <p className="text-xs mt-1">
            Attachez une politique pour configurer les regles
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source: PolicySource, idx: number) => {
            const domainInfo = POLICY_DOMAIN_LABELS[source.link_type] ?? {
              label: source.link_type,
              color: "text-muted-foreground",
            };
            return (
              <div
                key={`${source.policy_id}-${source.key}-${idx}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <Shield className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{source.key}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        domainInfo.color,
                      )}
                    >
                      {source.link_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {source.policy_name} — via {source.via}
                  </p>
                  <p className="text-xs font-mono mt-1 text-foreground/70">
                    {JSON.stringify(source.value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// AuditTab
// =============================================================================

function AuditTab({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const [entries, setEntries] = useState<OrgAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgApi.audit
      .entityHistory(entityType, entityId)
      .then((res) => {
        if (!cancelled) setEntries(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement de l&apos;historique...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun historique</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        {entries.length} evenement(s)
      </p>
      <div className="space-y-2">
        {entries.map((entry) => {
          const actionInfo = AUDIT_ACTION_LABELS[entry.action] ?? {
            label: entry.action,
            color: "text-muted-foreground",
          };
          const date = new Date(entry.created_at);
          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30"
            >
              <div className="flex flex-col items-center mt-0.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 py-0", actionInfo.color)}
                  >
                    {actionInfo.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.entity_type}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {entry.actor_type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {date.toLocaleDateString("fr-FR")}{" "}
                  {date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {entry.actor_id && ` — ${entry.actor_id.slice(0, 8)}...`}
                </p>
                {Object.keys(entry.changes).length > 0 && (
                  <p className="text-xs font-mono mt-1 text-foreground/60 truncate">
                    {JSON.stringify(entry.changes).slice(0, 120)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// DelegationsTab (focus mode only)
// =============================================================================

function DelegationsTab({
  nodeId,
  persons,
}: {
  nodeId: string;
  persons: Person[];
}) {
  const [delegations, setDelegations] = useState<OrgDelegation[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [delegateId, setDelegateId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    read: true,
    write: false,
    manage_assignments: false,
    manage_children: false,
    manage_policies: false,
    delegate: false,
  });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadDelegations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.delegations.list();
      const all = res.data ?? [];
      setDelegations(all.filter((d) => d.scope_node_id === nodeId));
    } catch {
      setDelegations([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    loadDelegations();
  }, [loadDelegations]);

  const handleCreate = async () => {
    if (!delegateId) return;
    setCreating(true);
    try {
      await orgApi.delegations.create({
        delegate_type: "person",
        delegate_id: delegateId,
        scope_node_id: nodeId,
        permissions,
        depth: 0,
        expires_at: expiresAt || undefined,
        is_active: true,
      });
      toast.success("Delegation creee");
      setCreateOpen(false);
      setDelegateId("");
      setExpiresAt("");
      setPermissions({
        read: true,
        write: false,
        manage_assignments: false,
        manage_children: false,
        manage_policies: false,
        delegate: false,
      });
      loadDelegations();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await orgApi.delegations.revoke(id);
      toast.success("Delegation revoquee");
      loadDelegations();
    } catch {
      toast.error("Erreur lors de la revocation");
    } finally {
      setRevoking(null);
    }
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement des delegations...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {delegations.length} delegation(s) active(s)
        </p>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle delegation
        </Button>
      </div>

      {delegations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune delegation pour ce noeud</p>
        </div>
      ) : (
        <div className="space-y-2">
          {delegations.map((d) => {
            const permKeys = Object.entries(d.permissions)
              .filter(([, v]) => v)
              .map(([k]) => k);
            const date = d.expires_at ? new Date(d.expires_at) : null;
            return (
              <div
                key={d.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <UserCheck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {d.delegate_id.slice(0, 8)}...
                    <span className="text-xs text-muted-foreground ml-2">
                      ({d.delegate_type})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {permKeys.map((k) => (
                      <Badge
                        key={k}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {k}
                      </Badge>
                    ))}
                  </div>
                  {date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expire: {date.toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive h-7"
                  onClick={() => handleRevoke(d.id)}
                  disabled={revoking === d.id}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" />
                  {revoking === d.id ? "..." : "Revoquer"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create delegation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle delegation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Personne delegataire *</Label>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(permissions).map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                  >
                    <Checkbox
                      checked={permissions[key]}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <span className="text-sm capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delegation-expires">Date d&apos;expiration</Label>
              <Input
                id="delegation-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating || !delegateId}>
              {creating ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// GroupsTab (for detail panel)
// =============================================================================

function GroupsTab({ groups }: { groups: OrgGroup[] }) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-2">
        {groups.length} groupe(s)
      </p>
      {groups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun groupe</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groups.map((g) => {
            const typeInfo = GROUP_TYPE_LABELS[g.group_type] ?? {
              label: g.group_type,
              color: "text-muted-foreground",
            };
            return (
              <div
                key={g.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30"
              >
                <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium flex-1 truncate">
                  {g.name}
                </span>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1.5 py-0", typeInfo.color)}
                >
                  {typeInfo.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SitesTab (for detail panel)
// =============================================================================

function SitesTab({ sites }: { sites: Site[] }) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-2">
        {sites.length} site(s)
      </p>
      {sites.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun site</p>
        </div>
      ) : (
        <div className="space-y-1">
          {sites.map((s) => {
            const flag = COUNTRY_FLAGS[s.country ?? ""] ?? "";
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.city && (
                    <p className="text-xs text-muted-foreground">
                      {flag ? `${flag} ` : ""}
                      {s.city}
                      {s.country ? `, ${s.country}` : ""}
                    </p>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 shrink-0 capitalize"
                >
                  {s.site_type}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DetailPanel
// =============================================================================

export interface DetailPanelProps {
  node: OrgNode | null;
  allNodes: OrgNode[];
  tree: OrgTree;
  onClose: () => void;
  onNodeUpdated: () => void;
  onAddChild: (parentNode: OrgNode) => void;
  onDeleteNode: (node: OrgNode) => void;
  onMoveNode: (node: OrgNode) => void;
  focusMode: boolean;
  allPolicies: OrgPolicy[];
  persons: Person[];
  groups?: OrgGroup[];
  sites?: Site[];
}

export function DetailPanel({
  node,
  allNodes,
  onClose,
  onNodeUpdated,
  onAddChild,
  onDeleteNode,
  onMoveNode,
  focusMode,
  allPolicies,
  persons,
  groups = [],
  sites = [],
}: DetailPanelProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState("details");
  const [assignments, setAssignments] = useState<AssignmentWithPerson[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Assignment creation dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignPersonSearch, setAssignPersonSearch] = useState("");
  const [assignPersonId, setAssignPersonId] = useState("");
  const [assignType, setAssignType] = useState<AssignmentType>("holder");
  const [assignResponsibility, setAssignResponsibility] =
    useState<ResponsibilityType>("hierarchical");
  const [assignFte, setAssignFte] = useState("1.0");
  const [assignStartDate, setAssignStartDate] = useState("");
  const [assignCreating, setAssignCreating] = useState(false);
  const [endingAssignment, setEndingAssignment] = useState<string | null>(null);

  // Board decision maker for the header
  const [boardDecisionMaker, setBoardDecisionMaker] = useState<{
    name: string;
    inherited: boolean;
    inheritedFrom?: string;
  } | null>(null);

  useEffect(() => {
    if (node) {
      setName(node.name);
      setCode(node.code ?? "");
      setDescription(node.description ?? "");
      setDetailTab("details");
      // Load board decision maker for header display
      setBoardDecisionMaker(null);
      if (typeof orgApi.nodes.board !== "function") return;
      orgApi.nodes
        .board(node.id)
        .then((res) => {
          const board = res.data;
          if (!board) return;
          const decisionMakers = (board.members ?? []).filter(
            (m: OrgBoardMember) => m.is_decision_maker,
          );
          if (decisionMakers.length > 0) {
            const dm = decisionMakers[0];
            const person = persons.find((p) => p.id === dm.person_id);
            const dmName = person
              ? `${person.first_name} ${person.last_name}`
              : dm.person_id.slice(0, 8) + "...";
            setBoardDecisionMaker({
              name: dmName,
              inherited: !!board.inherited_from_node_id,
              inheritedFrom:
                board.inherited_from_node_name ??
                allNodes.find((n) => n.id === board.inherited_from_node_id)
                  ?.name,
            });
          }
        })
        .catch(() => {
          // No board or error — leave null
        });
    }
  }, [node, persons, allNodes]);

  const loadAssignments = useCallback(async () => {
    if (!node) return;
    setAssignmentsLoading(true);
    try {
      const res = await orgApi.nodes.assignments(node.id);
      setAssignments((res.data ?? []) as AssignmentWithPerson[]);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [node]);

  useEffect(() => {
    if (node && detailTab === "people") {
      loadAssignments();
    }
  }, [node, detailTab, loadAssignments]);

  const visibleTabs = useMemo(() => {
    if (!node) return ALL_TABS.filter((t) => t.id === "details");
    return getVisibleTabs(node.node_type);
  }, [node]);

  const handleSave = async () => {
    if (!node) return;
    setSaving(true);
    try {
      await orgApi.nodes.update(node.id, {
        name,
        code: code || undefined,
        description: description || undefined,
      });
      toast.success("Noeud mis a jour");
      onNodeUpdated();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!node || !assignPersonId) return;
    setAssignCreating(true);
    try {
      await orgApi.assignments.create({
        person_id: assignPersonId,
        node_id: node.id,
        assignment_type: assignType,
        responsibility_type: assignResponsibility,
        fte_ratio: parseFloat(assignFte) || 1.0,
        start_date: assignStartDate || new Date().toISOString().split("T")[0],
        is_primary: true,
      });
      toast.success("Affectation creee");
      setAssignDialogOpen(false);
      setAssignPersonId("");
      setAssignPersonSearch("");
      setAssignType("holder");
      setAssignResponsibility("hierarchical");
      setAssignFte("1.0");
      setAssignStartDate("");
      loadAssignments();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setAssignCreating(false);
    }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    setEndingAssignment(assignmentId);
    try {
      await orgApi.assignments.end(assignmentId, "Fin d'affectation");
      toast.success("Affectation terminee");
      loadAssignments();
    } catch {
      toast.error("Erreur lors de la cloture");
    } finally {
      setEndingAssignment(null);
    }
  };

  // Filter persons by search
  const filteredPersons = useMemo(() => {
    if (!assignPersonSearch) return persons;
    const q = assignPersonSearch.toLowerCase();
    return persons.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [persons, assignPersonSearch]);

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
        <Building2 className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Selectionnez un noeud</p>
        <p className="text-xs">pour voir et modifier ses details</p>
      </div>
    );
  }

  const cfg = getNodeTypeConfig(node.node_type);
  const breadcrumb = getAncestorNames(node.id, allNodes);
  const childNodes = allNodes
    .filter((n) => n.parent_id === node.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="secondary"
              className={cn("text-xs px-2 py-0.5 shrink-0", cfg.color, cfg.bg)}
            >
              {cfg.label}
            </Badge>
            <h3 className="font-semibold text-base truncate">{node.name}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {breadcrumb.length > 0 && (
          <p
            className="text-xs text-muted-foreground mt-0.5 truncate max-w-full"
            title={breadcrumb.join(" > ") + " > " + node.name}
          >
            {breadcrumb.join(" > ")} &gt; {node.name}
          </p>
        )}
        {node.code && (
          <span className="text-xs font-mono text-muted-foreground">
            Code: {node.code}
          </span>
        )}
        {boardDecisionMaker && (
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span className="text-xs text-muted-foreground">
              Decideur:{" "}
              <span className="font-medium text-foreground">
                {boardDecisionMaker.name}
              </span>
              {boardDecisionMaker.inherited &&
                boardDecisionMaker.inheritedFrom && (
                  <span className="text-muted-foreground">
                    {" "}
                    (herite de {boardDecisionMaker.inheritedFrom})
                  </span>
                )}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={detailTab}
        onValueChange={setDetailTab}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Categorized TabsList */}
        <TabsList
          className={cn(
            "mx-4 mt-2 shrink-0 w-auto h-auto flex flex-nowrap justify-start gap-1 bg-transparent p-0 border-b border-border overflow-x-auto scrollbar-none",
            focusMode && "mx-6",
          )}
        >
          {(
            ["organisation", "groupes_politiques", "infrastructure"] as const
          ).map((category) => {
            const categoryTabs = visibleTabs.filter(
              (t) => t.category === category,
            );
            if (categoryTabs.length === 0) return null;
            return (
              <div
                key={category}
                className="flex items-center gap-1 pr-4 mr-4 border-r border-border/40 last:border-r-0 last:mr-0 last:pr-0 py-1.5"
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2 hidden xl:inline">
                  {CATEGORY_LABELS[category]}
                </span>
                {categoryTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="text-xs px-2 py-1 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </div>
            );
          })}
          {focusMode && (
            <div className="flex items-center gap-0.5 py-1">
              <TabsTrigger
                value="delegations"
                className="text-xs px-2 py-1 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <UserCheck className="h-3 w-3 mr-1" />
                Delegations
              </TabsTrigger>
            </div>
          )}
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Details tab */}
          <TabsContent value="details" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label htmlFor="detail-name">Nom</Label>
              <Input
                id="detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du noeud"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-code">Code</Label>
              <Input
                id="detail-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: DRH, IT, SALES"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-desc">Description</Label>
              <Textarea
                id="detail-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle..."
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </div>

            {/* Actions */}
            <div className="border-t border-border pt-4 mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMoveNode(node)}
                >
                  <Move className="h-4 w-4 mr-1" />
                  Deplacer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDeleteNode(node)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* People tab */}
          <TabsContent value="people" className="p-4 space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {assignments.length} personne(s) affectee(s)
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAssignDialogOpen(true);
                  setAssignStartDate(new Date().toISOString().split("T")[0]);
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Affecter
              </Button>
            </div>
            {assignmentsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Chargement...
              </p>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                Aucune affectation pour ce noeud
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {a.person
                          ? `${a.person.first_name[0]}${a.person.last_name[0]}`
                          : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.person
                          ? `${a.person.first_name} ${a.person.last_name}`
                          : a.person_id}
                      </p>
                      {a.person?.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {a.person.email}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {ASSIGNMENT_TYPE_LABELS[a.assignment_type] ??
                        a.assignment_type}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleEndAssignment(a.id)}
                      disabled={endingAssignment === a.id}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Children tab */}
          <TabsContent value="children" className="p-4 space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {childNodes.length} sous-noeud(s)
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddChild(node)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>
            {childNodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                Aucun sous-noeud
              </div>
            ) : (
              <div className="space-y-1">
                {childNodes.map((child) => {
                  const childCfg = getNodeTypeConfig(child.node_type);
                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors"
                    >
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0 shrink-0",
                          childCfg.color,
                          childCfg.bg,
                        )}
                      >
                        {childCfg.label}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {child.name}
                      </span>
                      {child.code && (
                        <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0">
                          {child.code}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Governance tab */}
          <TabsContent value="governance" className="mt-0">
            <GovernanceTab
              nodeId={node.id}
              persons={persons}
              allNodes={allNodes}
            />
          </TabsContent>

          {/* Policies tab */}
          <TabsContent value="policies" className="mt-0">
            <PoliciesTab nodeId={node.id} allPolicies={allPolicies} />
          </TabsContent>

          {/* Audit tab */}
          <TabsContent value="audit" className="mt-0">
            <AuditTab entityType="node" entityId={node.id} />
          </TabsContent>

          {/* GPO tab */}
          <TabsContent value="gpo" className="mt-0 p-4">
            <GpoTabContent nodeId={node.id} />
          </TabsContent>

          {/* Computers tab */}
          <TabsContent value="computers" className="mt-0 p-4">
            <ComputersTabContent nodeId={node.id} />
          </TabsContent>

          {/* Kerberos tab */}
          <TabsContent value="kerberos" className="mt-0 p-4">
            <KerberosTabContent
              nodeId={node?.id || ""}
              nodeType={node?.node_type || ""}
            />
          </TabsContent>

          {/* DNS tab */}
          <TabsContent value="dns" className="mt-0 p-4">
            <DnsTabContent
              nodeId={node?.id || ""}
              nodeType={node?.node_type || ""}
            />
          </TabsContent>

          {/* Groups tab */}
          <TabsContent value="groups" className="mt-0">
            <GroupsTab groups={groups} />
          </TabsContent>

          {/* Sites tab */}
          <TabsContent value="sites" className="mt-0">
            <SitesTab sites={sites} />
          </TabsContent>

          {/* Delegations tab (focus mode only) */}
          {focusMode && (
            <TabsContent value="delegations" className="mt-0">
              <DelegationsTab nodeId={node.id} persons={persons} />
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* Assignment creation dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Affecter une personne a &laquo;{node.name}&raquo;
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rechercher une personne *</Label>
              <Input
                value={assignPersonSearch}
                onChange={(e) => setAssignPersonSearch(e.target.value)}
                placeholder="Nom, prenom ou email..."
              />
              <Select value={assignPersonId} onValueChange={setAssignPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type d&apos;affectation</Label>
                <Select
                  value={assignType}
                  onValueChange={(v) => setAssignType(v as AssignmentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsabilite</Label>
                <Select
                  value={assignResponsibility}
                  onValueChange={(v) =>
                    setAssignResponsibility(v as ResponsibilityType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESPONSIBILITY_TYPE_LABELS).map(
                      ([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assign-fte">Ratio ETP</Label>
                <Input
                  id="assign-fte"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={assignFte}
                  onChange={(e) => setAssignFte(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-start">Date de debut</Label>
                <Input
                  id="assign-start"
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateAssignment}
              disabled={assignCreating || !assignPersonId}
            >
              {assignCreating ? "Affectation..." : "Affecter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
