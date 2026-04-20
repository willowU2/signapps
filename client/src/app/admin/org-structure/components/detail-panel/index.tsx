"use client";

/**
 * DetailPanel container - SO6 refonte.
 *
 * Orchestrates :
 * - Mode selection (Node vs Person) based on the `mode` prop.
 * - Hero card (NodeHero or PersonHero) - always visible at the top.
 * - Main tabs row with 5 primary tabs + "..." overflow.
 * - TabsContent panels driven by the panel layout config.
 *
 * This file replaces the monolithic detail-panel.tsx (462 lines).
 * The old path keeps a re-export for compat (see `../detail-panel.tsx`).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { orgApi } from "@/lib/api/org";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";
import type {
  OrgBoardMember,
  OrgGroup,
  OrgNode,
  OrgPolicy,
  OrgTree,
  Person,
  Site,
} from "@/types/org";
import type { PanelEntitySlug, PanelTabItem } from "@/lib/api/org";

import { AuditTab } from "../audit-tab";
import { CertificatesTabContent } from "../certificates-tab";
import { ComputersTabContent } from "../computers-tab";
import { DecisionsTab } from "../decisions-tab";
import { DelegationsTab } from "../delegations-tab";
import { DeploymentTabContent } from "../deployment-tab";
import { DetailsTab } from "../details-tab";
import { DhcpTabContent } from "../dhcp-tab";
import { DnsTabContent } from "../dns-tab";
import { GovernanceTab } from "../governance-tab";
import { GpoTabContent } from "../gpo-tab";
import { GroupsTab } from "../groups-tab";
import { KerberosTabContent } from "../kerberos-tab";
import { NtpTabContent } from "../ntp-tab";
import { PeopleTab } from "../people-tab";
import { PoliciesTab } from "../policies-tab";
import { PositionsTab } from "../positions-tab";
import { RaciMatrixTab } from "../raci-matrix-tab";
import { ResourcesTab } from "../resources-tab";
import { SitesTab } from "../sites-tab";
import { SkillsSection } from "../skills-section";

import { MainTabs, resolveVisibleTabIds } from "./main-tabs";
import { NodeHero } from "./node-hero";
import { PersonHero } from "./person-hero";
import { TabRenderer } from "./tab-renderer";
import {
  mapUserRoleToPanelRole,
  usePanelLayout,
} from "./hooks/use-panel-layout";

// =============================================================================
// Types
// =============================================================================

export interface DetailPanelProps {
  /** Node to display when `mode === "node"`. */
  node: OrgNode | null;
  /** Person to display when `mode === "person"`. */
  person?: Person | null;
  /** Which entity mode to render in. */
  mode?: "node" | "person";
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

// =============================================================================
// Helpers
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
    } else break;
  }
  return names;
}

/** Labels for every builtin node tab id. */
const NODE_TAB_LABELS: Record<string, string> = {
  details: "Détails",
  people: "Personnes",
  positions: "Postes",
  governance: "Gouvernance",
  headcount: "Effectifs",
  audit: "Audit",
  raci: "RACI",
  decisions: "Décisions",
  policies: "Policies",
  groups: "Groupes",
  sites: "Sites",
  resources: "Ressources",
  gpo: "GPO",
  computers: "Ordinateurs",
  kerberos: "Kerberos",
  dns: "DNS",
  certificates: "Certificats",
  dhcp: "DHCP",
  ntp: "NTP",
  deployment: "Déploiement",
  delegations: "Délégations",
};

/** Labels for every builtin person tab id. */
const PERSON_TAB_LABELS: Record<string, string> = {
  profile: "Profil",
  assignments: "Affectations",
  skills: "Compétences",
  permissions: "Permissions",
  delegations: "Délégations",
  audit: "Audit",
  groups: "Groupes",
  sites: "Sites",
  resources: "Ressources",
};

/** Tabs marked as stubs (no real implementation yet). */
const STUB_TABS = new Set([
  "gpo",
  "computers",
  "kerberos",
  "dns",
  "certificates",
  "dhcp",
  "ntp",
  "deployment",
  "policies",
  "permissions",
  "assignments",
]);

/**
 * Stub tab placeholder - used for tabs flagged in [`STUB_TABS`] but no
 * real component. Does NOT call any API.
 */
function StubTab({ label }: { label: string }) {
  return (
    <div className="p-4">
      <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground text-center">
        <p className="font-medium">{label}</p>
        <p className="text-xs mt-1">
          Cette fonctionnalité n'est pas encore disponible.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// DetailPanel
// =============================================================================

export function DetailPanel(props: DetailPanelProps) {
  const mode: "node" | "person" =
    props.mode ?? (props.person ? "person" : "node");

  if (mode === "person" && props.person) {
    return <PersonModeDetailPanel {...props} person={props.person} />;
  }
  if (props.node) {
    return <NodeModeDetailPanel {...props} node={props.node} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
      <Building2 className="h-12 w-12 opacity-20" />
      <p className="text-sm font-medium">Sélectionnez un noeud</p>
      <p className="text-xs">pour voir et modifier ses détails</p>
    </div>
  );
}

// =============================================================================
// Node mode
// =============================================================================

type NodeModeProps = DetailPanelProps & { node: OrgNode };

function NodeModeDetailPanel({
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
}: NodeModeProps) {
  const userRole = useAuthStore((s) => s.user?.role);
  const panelRole = useMemo(() => mapUserRoleToPanelRole(userRole), [userRole]);
  const { config } = usePanelLayout(panelRole, "node");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [boardDecisionMaker, setBoardDecisionMaker] = useState<{
    name: string;
    inherited: boolean;
    inheritedFrom?: string;
  } | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);

  useEffect(() => {
    setName(node.name);
    setCode(node.code ?? "");
    setDescription(node.description ?? "");
    setBoardDecisionMaker(null);
    setBoardId(null);
    if (typeof orgApi.nodes.board !== "function") return;
    orgApi.nodes
      .board(node.id)
      .then((res) => {
        const board = res.data;
        if (!board) return;
        const maybeId = (board as unknown as { id?: string }).id;
        if (typeof maybeId === "string") setBoardId(maybeId);
        const decisionMakers = (board.members ?? []).filter(
          (m: OrgBoardMember) => m.is_decision_maker,
        );
        if (decisionMakers.length > 0) {
          const dm = decisionMakers[0];
          const person = persons.find((p) => p.id === dm.person_id);
          const dmName = person
            ? person.first_name + " " + person.last_name
            : dm.person_id.slice(0, 8) + "...";
          setBoardDecisionMaker({
            name: dmName,
            inherited: !!board.inherited_from_node_id,
            inheritedFrom:
              board.inherited_from_node_name ??
              allNodes.find((n) => n.id === board.inherited_from_node_id)?.name,
          });
        }
      })
      .catch(() => {
        // No board or error — leave null
      });
  }, [node, persons, allNodes]);

  const breadcrumb = useMemo(
    () => getAncestorNames(node.id, allNodes),
    [node, allNodes],
  );

  // Build the effective list of tab items. If config is still loading
  // we fall back to a minimal default so the UI stays useful.
  const effectiveItems: PanelTabItem[] = useMemo(() => {
    if (!config) {
      return [
        { type: "builtin", id: "details", position: -1 },
        { type: "builtin", id: "people", position: 0 },
      ];
    }
    // Always surface `details` first — editing the node is a core action
    // that must remain reachable from every role.
    const hasDetails = config.main_tabs.some(
      (t) => t.type === "builtin" && t.id === "details",
    );
    const base: PanelTabItem[] = hasDetails
      ? []
      : [{ type: "builtin", id: "details", position: -1 }];
    return [...base, ...config.main_tabs];
  }, [config]);

  const hiddenIds = useMemo(() => (config ? config.hidden_tabs : []), [config]);

  const heroKpis = config?.hero_kpis ?? [];
  const heroQuickActions = config?.hero_quick_actions ?? [];

  // Compute visible tab ids for sanity check (activeTab fallback).
  const visibleIds = useMemo(
    () => resolveVisibleTabIds(effectiveItems, hiddenIds),
    [effectiveItems, hiddenIds],
  );

  useEffect(() => {
    if (visibleIds.length === 0) return;
    if (!visibleIds.includes(activeTab)) {
      setActiveTab(visibleIds[0]);
    }
  }, [visibleIds, activeTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await orgApi.nodes.update(node.id, {
        name,
        code: code || undefined,
        description: description || undefined,
      });
      toast.success("Noeud mis à jour");
      onNodeUpdated();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const extraTabs =
    focusMode && !visibleIds.includes("delegations")
      ? [{ id: "delegations", label: "Délégations" }]
      : [];

  const renderBuiltin = (id: string): React.ReactNode => {
    if (STUB_TABS.has(id)) {
      const label = NODE_TAB_LABELS[id] ?? id;
      switch (id) {
        case "gpo":
          return <GpoTabContent nodeId={node.id} />;
        case "computers":
          return <ComputersTabContent nodeId={node.id} />;
        case "kerberos":
          return (
            <KerberosTabContent nodeId={node.id} nodeType={node.node_type} />
          );
        case "dns":
          return <DnsTabContent nodeId={node.id} nodeType={node.node_type} />;
        case "certificates":
          return (
            <CertificatesTabContent
              nodeId={node.id}
              nodeType={node.node_type}
            />
          );
        case "dhcp":
          return <DhcpTabContent nodeId={node.id} nodeType={node.node_type} />;
        case "ntp":
          return <NtpTabContent nodeId={node.id} nodeType={node.node_type} />;
        case "deployment":
          return (
            <DeploymentTabContent nodeId={node.id} nodeType={node.node_type} />
          );
        case "policies":
          return <PoliciesTab nodeId={node.id} allPolicies={allPolicies} />;
        default:
          return <StubTab label={label} />;
      }
    }
    switch (id) {
      case "groups":
        return <GroupsTab mode="node" node={node} />;
      case "sites":
        return <SitesTab mode="node" />;
      case "resources":
        return <ResourcesTab mode="node" nodeId={node.id} />;
      case "details":
        return (
          <DetailsTab
            node={node}
            allNodes={allNodes}
            name={name}
            code={code}
            description={description}
            saving={saving}
            onNameChange={setName}
            onCodeChange={setCode}
            onDescriptionChange={setDescription}
            onSave={handleSave}
            onAddChild={onAddChild}
            onDeleteNode={onDeleteNode}
            onMoveNode={onMoveNode}
          />
        );
      case "people":
        return (
          <PeopleTab nodeId={node.id} nodeName={node.name} persons={persons} />
        );
      case "positions":
        return (
          <div className="p-4">
            <PositionsTab
              nodeId={node.id}
              personsById={Object.fromEntries(persons.map((p) => [p.id, p]))}
            />
          </div>
        );
      case "governance":
        return (
          <GovernanceTab
            nodeId={node.id}
            persons={persons}
            allNodes={allNodes}
          />
        );
      case "headcount":
        return <StubTab label="Effectifs" />;
      case "raci":
        return (
          <RaciMatrixTab
            projectId={node.id}
            projectName={node.name}
            persons={persons}
          />
        );
      case "decisions":
        return boardId ? (
          <DecisionsTab boardId={boardId} persons={persons} />
        ) : (
          <p className="p-4 text-xs text-muted-foreground">
            Aucun board attaché à ce node.
          </p>
        );
      case "audit":
        return <AuditTab entityType="node" entityId={node.id} />;
      case "delegations":
        return <DelegationsTab nodeId={node.id} persons={persons} />;
      default: {
        const label = NODE_TAB_LABELS[id] ?? id;
        return <StubTab label={label} />;
      }
    }
  };

  const metaById: Record<string, { id: string; label: string }> = {};
  for (const [id, label] of Object.entries(NODE_TAB_LABELS)) {
    metaById[id] = { id, label };
  }

  return (
    <div className="flex flex-col h-full">
      <NodeHero
        node={node}
        breadcrumb={breadcrumb}
        kpis={heroKpis}
        quickActions={heroQuickActions}
        boardDecisionMaker={boardDecisionMaker}
        onClose={onClose}
        onAddChild={onAddChild}
        onMoveNode={onMoveNode}
        onDeleteNode={onDeleteNode}
        onEditFocus={() => setActiveTab("details")}
        focusMode={focusMode}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <MainTabs
          items={effectiveItems}
          metaById={metaById}
          hiddenIds={hiddenIds}
          activeId={activeTab}
          onChange={setActiveTab}
          extraTabs={extraTabs}
          wideMargin={focusMode}
        />

        <div className="flex-1 overflow-y-auto min-h-0 mt-3">
          {visibleIds.map((id) => {
            const item = effectiveItems.find((i) => {
              if (i.type === "builtin") return i.id === id;
              return id.startsWith("widget:");
            });
            if (!item) return null;
            return (
              <TabsContent key={id} value={id} className="mt-0">
                <TabRenderer
                  item={item}
                  ctx={{ entityId: node.id, entityType: "node" }}
                  renderBuiltin={renderBuiltin}
                />
              </TabsContent>
            );
          })}
          {extraTabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-0">
              {renderBuiltin(t.id)}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}

// =============================================================================
// Person mode
// =============================================================================

type PersonModeProps = DetailPanelProps & { person: Person };

function PersonModeDetailPanel({
  person,
  allNodes,
  onClose,
  persons,
}: PersonModeProps) {
  const userRole = useAuthStore((s) => s.user?.role);
  const panelRole = useMemo(() => mapUserRoleToPanelRole(userRole), [userRole]);
  const { config } = usePanelLayout(panelRole, "person");

  // Resolve the primary node (structure axis assignment).
  const [primaryNode, setPrimaryNode] = useState<OrgNode | null>(null);
  useEffect(() => {
    let cancelled = false;
    orgApi.persons
      .get(person.id)
      .then((res) => {
        if (cancelled) return;
        const primaryId = (res.data as unknown as { primary_node_id?: string })
          .primary_node_id;
        if (primaryId) {
          const found = allNodes.find((n) => n.id === primaryId);
          setPrimaryNode(found ?? null);
        } else {
          setPrimaryNode(null);
        }
      })
      .catch(() => {
        setPrimaryNode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [person.id, allNodes]);

  const [activeTab, setActiveTab] = useState("profile");

  const effectiveItems: PanelTabItem[] = useMemo(() => {
    if (!config) {
      return [{ type: "builtin", id: "profile", position: 0 }];
    }
    const hasProfile = config.main_tabs.some(
      (t) => t.type === "builtin" && t.id === "profile",
    );
    const base: PanelTabItem[] = hasProfile
      ? []
      : [{ type: "builtin", id: "profile", position: -1 }];
    return [...base, ...config.main_tabs];
  }, [config]);
  const hiddenIds = useMemo(() => (config ? config.hidden_tabs : []), [config]);
  const heroKpis = config?.hero_kpis ?? [];
  const heroQuickActions = config?.hero_quick_actions ?? [];

  const visibleIds = useMemo(
    () => resolveVisibleTabIds(effectiveItems, hiddenIds),
    [effectiveItems, hiddenIds],
  );
  useEffect(() => {
    if (visibleIds.length === 0) return;
    if (!visibleIds.includes(activeTab)) setActiveTab(visibleIds[0]);
  }, [visibleIds, activeTab]);

  const renderBuiltin = (id: string): React.ReactNode => {
    if (STUB_TABS.has(id)) {
      return <StubTab label={PERSON_TAB_LABELS[id] ?? id} />;
    }
    switch (id) {
      case "profile":
        return (
          <div className="p-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium">{person.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="font-medium">{person.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Noeud principal</p>
              <p className="font-medium">{primaryNode?.name ?? "—"}</p>
            </div>
          </div>
        );
      case "skills":
        return (
          <div className="p-4">
            <SkillsSection personId={person.id} />
          </div>
        );
      case "groups":
        return <GroupsTab mode="person" personId={person.id} />;
      case "sites":
        return <SitesTab mode="person" personId={person.id} />;
      case "resources":
        return <ResourcesTab mode="person" personId={person.id} />;
      case "audit":
        return <AuditTab entityType="person" entityId={person.id} />;
      default:
        return <StubTab label={PERSON_TAB_LABELS[id] ?? id} />;
    }
  };

  const metaById: Record<string, { id: string; label: string }> = {};
  for (const [id, label] of Object.entries(PERSON_TAB_LABELS)) {
    metaById[id] = { id, label };
  }

  return (
    <div className="flex flex-col h-full">
      <PersonHero
        person={person}
        primaryNode={primaryNode}
        kpis={heroKpis}
        quickActions={heroQuickActions}
        onClose={onClose}
      />
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <MainTabs
          items={effectiveItems}
          metaById={metaById}
          hiddenIds={hiddenIds}
          activeId={activeTab}
          onChange={setActiveTab}
        />
        <div className="flex-1 overflow-y-auto min-h-0 mt-3">
          {visibleIds.map((id) => {
            const item = effectiveItems.find((i) => {
              if (i.type === "builtin") return i.id === id;
              return id.startsWith("widget:");
            });
            if (!item) return null;
            return (
              <TabsContent key={id} value={id} className="mt-0">
                <TabRenderer
                  item={item}
                  ctx={{
                    entityId: person.id,
                    entityType: "person" as PanelEntitySlug,
                  }}
                  renderBuiltin={renderBuiltin}
                />
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
}
