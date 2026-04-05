"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, X, Star, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type {
  OrgNode,
  OrgTree,
  Person,
  OrgPolicy,
  OrgGroup,
  Site,
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
import { DetailsTab } from "./details-tab";
import { PeopleTab } from "./people-tab";
import { GroupsTab } from "./groups-tab";
import { SitesTab } from "./sites-tab";
import { PoliciesTab } from "./policies-tab";
import { AuditTab } from "./audit-tab";
import { DelegationsTab } from "./delegations-tab";

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
          <TabsContent value="details" className="mt-0">
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
          </TabsContent>

          {/* People tab */}
          <TabsContent value="people" className="mt-0">
            <PeopleTab
              nodeId={node.id}
              nodeName={node.name}
              persons={persons}
            />
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
    </div>
  );
}
