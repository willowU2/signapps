"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { AppLayout } from "@/components/layout/app-layout";
import { useUIStore } from "@/lib/store";
import { usePageTitle } from "@/hooks/use-page-title";
import { useDebounce } from "@/hooks/use-debounce";
import { useOrgStore } from "@/stores/org-store";
import { useTenantStore } from "@/stores/tenant-store";
import { orgApi } from "@/lib/api/org";
import type {
  OrgNode,
  Person,
  TreeType,
  BoardSummary,
  Assignment,
} from "@/types/org";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Components — always visible
import { TreeNodeItem } from "./components/tree-node-item";
import type { TreeNode, BoardInfo } from "./components/tree-node-item";
import { UnassignedPeoplePanel } from "./components/unassigned-people-panel";
import { DetailPanel } from "./components/detail-panel";
import { GroupsNav } from "./components/groups-nav";
import { SitesNav } from "./components/sites-nav";
import { StatsBar } from "./components/stats-bar";
import { OrgTreeHeader } from "./components/org-tree-header";
import { OrgToolbar } from "./components/org-toolbar";
import type { ViewMode, NavTab } from "./components/org-toolbar";
import { FocusBreadcrumb } from "./components/focus-breadcrumb";
import { CreateTreeDialog } from "./components/dialogs/create-tree-dialog";
import { AddNodeDialog } from "./components/dialogs/add-node-dialog";
import { DeleteNodeDialog } from "./components/dialogs/delete-node-dialog";
import { MoveNodeDialog } from "./components/dialogs/move-node-dialog";

// Lazy-loaded view-specific components
const OrgChartCard = dynamic(
  () =>
    import("./components/org-chart-card").then((m) => ({
      default: m.OrgChartCard,
    })),
  { loading: () => <div className="animate-pulse bg-muted h-40 rounded-lg" /> },
);

const ListView = dynamic(
  () => import("./components/list-view").then((m) => ({ default: m.ListView })),
  { loading: () => <div className="animate-pulse bg-muted h-40 rounded-lg" /> },
);
import {
  getNodeTypesByTreeType,
  INTERNAL_NODE_TYPES,
} from "./components/tab-config";
import { useOrgExport } from "./hooks/use-org-export";
import { useOrgTreeActions } from "./hooks/use-org-tree-actions";

// =============================================================================
// Helpers
// =============================================================================

function buildTree(nodes: OrgNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const n of nodes) map.set(n.id, { ...n, children: [] });
  for (const n of nodes) {
    const treeNode = map.get(n.id)!;
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }
  const sortChildren = (list: TreeNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order);
    list.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);
  return roots;
}

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

// =============================================================================
// Main page
// =============================================================================

export default function OrgStructurePage() {
  usePageTitle("Structure organisationnelle \u2014 Administration");
  useUIStore((s) => s.sidebarCollapsed);
  useUIStore((s) => s.rightSidebarOpen);
  useUIStore((s) => s.rightSidebarPinned);

  const {
    trees,
    treesLoading,
    currentTree,
    nodes,
    nodesLoading,
    selectedNode,
    persons,
    sites,
    groups,
    policies,
    groupsLoading,
    sitesLoading,
    activeNavTab,
    focusMode,
    fetchTrees,
    setCurrentTree,
    fetchNodes,
    selectNode,
    fetchPersons,
    fetchSites,
    fetchGroups,
    fetchPolicies,
    setActiveNavTab,
    setFocusMode,
  } = useOrgStore();

  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [boardMap, setBoardMap] = useState<Record<string, BoardInfo>>({});
  const [assignmentsByNode, setAssignmentsByNode] = useState<
    Record<
      string,
      Array<{
        assignmentId: string;
        personId: string;
        role?: string;
        isPrimary: boolean;
      }>
    >
  >({});

  // Dialog state — create tree
  const [createTreeDialogOpen, setCreateTreeDialogOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeType, setNewTreeType] = useState<TreeType>("internal");
  const [creatingTree, setCreatingTree] = useState(false);
  const [newTreeDecisionMakerId, setNewTreeDecisionMakerId] = useState("");
  const [newTreePersonSearch, setNewTreePersonSearch] = useState("");

  // Dialog state — add node
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [addNodeParent, setAddNodeParent] = useState<OrgNode | null>(null);
  const [newNodeType, setNewNodeType] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeCode, setNewNodeCode] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [addingNode, setAddingNode] = useState(false);

  // Dialog state — delete node
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<OrgNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dialog state — move node
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [nodeToMove, setNodeToMove] = useState<OrgNode | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [moving, setMoving] = useState(false);

  const treeHierarchy = useMemo(() => buildTree(nodes), [nodes]);
  const personsById = useMemo(() => {
    const map: Record<string, Person> = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);
  const freshSelectedNode = useMemo(
    () =>
      selectedNode
        ? (nodes.find((n) => n.id === selectedNode.id) ?? null)
        : null,
    [nodes, selectedNode],
  );

  const currentTreeIdRef = React.useRef<string | null>(null);
  const selectedNodeIdRef = React.useRef<string | null>(null);
  const prevNodesLenRef = React.useRef(0);
  const boardFetchVersionRef = React.useRef(0);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNode?.id ?? null;
  }, [selectedNode]);

  useEffect(() => {
    fetchTrees();
    fetchPersons();
    fetchSites();
    fetchGroups();
    fetchPolicies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-node assignments — batch fetch so the tree/orgchart can show
  // avatars + roles on each node. Guarded against stale responses by a
  // version ref. Exposed as a callback so mutations (assign / move /
  // end) can refresh without duplicating the fan-out logic.
  const assignmentsVersionRef = React.useRef(0);
  const fetchAssignmentsForAllNodes = useCallback(
    async (nodeList: OrgNode[]) => {
      if (nodeList.length === 0) {
        setAssignmentsByNode({});
        return;
      }
      const version = ++assignmentsVersionRef.current;
      const results = await Promise.all(
        nodeList.map((n) =>
          orgApi.nodes
            .assignments(n.id)
            .then((res) => ({ nodeId: n.id, rows: res.data ?? [] }))
            .catch(() => ({ nodeId: n.id, rows: [] as Assignment[] })),
        ),
      );
      if (assignmentsVersionRef.current !== version) return;
      const map: Record<
        string,
        Array<{
          assignmentId: string;
          personId: string;
          role?: string;
          isPrimary: boolean;
        }>
      > = {};
      for (const { nodeId, rows } of results) {
        map[nodeId] = rows.map((a) => ({
          assignmentId: a.id,
          personId: a.person_id,
          role: (a as unknown as { role?: string }).role,
          isPrimary: Boolean(a.is_primary),
        }));
      }
      setAssignmentsByNode(map);
    },
    [],
  );

  useEffect(() => {
    void fetchAssignmentsForAllNodes(nodes);
  }, [nodes, fetchAssignmentsForAllNodes]);

  // Board indicators — single batched request with version-guard against
  // stale overwrites when `nodes` changes while a fetch is in flight.
  useEffect(() => {
    if (nodes.length === 0) {
      setBoardMap({});
      return;
    }
    const version = ++boardFetchVersionRef.current;
    orgApi.nodes
      .listBoards()
      .then((res) => {
        if (boardFetchVersionRef.current !== version) return;
        const summaries = res.data;
        const map: Record<string, BoardInfo> = {};
        const boardNodeIds = new Set(
          summaries.map((s: BoardSummary) => s.node_id),
        );
        for (const s of summaries) {
          const person = s.decision_maker_person_id
            ? persons.find((p: Person) => p.id === s.decision_maker_person_id)
            : undefined;
          map[s.node_id] = {
            decisionMakerName: person
              ? `${person.first_name} ${person.last_name}`
              : undefined,
            isInherited: false,
          };
        }
        for (const node of nodes) {
          if (!boardNodeIds.has(node.id)) {
            let parentId: string | undefined = node.parent_id;
            while (parentId) {
              if (map[parentId]) {
                map[node.id] = { ...map[parentId], isInherited: true };
                break;
              }
              parentId = nodes.find((n) => n.id === parentId)?.parent_id;
            }
          }
        }
        setBoardMap(map);
      })
      .catch(() => {});
  }, [nodes, persons]);

  useEffect(() => {
    if (trees.length > 0 && !currentTree) setCurrentTree(trees[0]);
  }, [trees, currentTree, setCurrentTree]);

  useEffect(() => {
    if (currentTree && currentTree.id !== currentTreeIdRef.current) {
      currentTreeIdRef.current = currentTree.id;
      fetchNodes(currentTree.id);
    }
  }, [currentTree, fetchNodes]);

  useEffect(() => {
    if (nodes.length === 0) {
      prevNodesLenRef.current = 0;
      return;
    }
    if (nodes.length !== prevNodesLenRef.current) {
      prevNodesLenRef.current = nodes.length;
      const parents = new Set<string>();
      for (const n of nodes) {
        if (!n.parent_id) parents.add(n.id);
        if (n.parent_id) parents.add(n.parent_id);
      }
      setExpanded(parents);
    }
    const selId = selectedNodeIdRef.current;
    if (selId && !nodes.find((n) => n.id === selId)) {
      selectedNodeIdRef.current = null;
      selectNode(null);
      setDetailOpen(false);
    }
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) setFocusMode(false);
      if (e.key === "Enter" && selectedNode && !focusMode) {
        const el = document.activeElement;
        if (
          el?.tagName !== "INPUT" &&
          el?.tagName !== "TEXTAREA" &&
          el?.tagName !== "SELECT"
        ) {
          setFocusMode(true);
          setDetailOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, selectedNode, setFocusMode]);

  // Action hooks
  const { handleExport, handlePrint } = useOrgExport(nodes, currentTree);
  const {
    handleCreateTree,
    handleDeleteTree,
    handleAddNode,
    handleDeleteNode,
    handleMoveNode,
  } = useOrgTreeActions();

  const reloadTree = useCallback(async () => {
    if (currentTree) {
      currentTreeIdRef.current = null;
      await Promise.all([fetchTrees(), fetchNodes(currentTree.id)]);
      currentTreeIdRef.current = currentTree.id;
    } else {
      await fetchTrees();
    }
  }, [fetchTrees, fetchNodes, currentTree]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const handleSelectNode = useCallback(
    (node: OrgNode) => {
      selectNode(node);
      setDetailOpen(true);
    },
    [selectNode],
  );
  const handleDoubleClickNode = useCallback(
    (node: TreeNode) => {
      selectNode(node);
      setDetailOpen(true);
      setFocusMode(true);
    },
    [selectNode, setFocusMode],
  );
  const handleCloseDetail = useCallback(() => {
    if (focusMode) setFocusMode(false);
    setDetailOpen(false);
    selectNode(null);
  }, [selectNode, focusMode, setFocusMode]);
  const handleExitFocusMode = useCallback(
    () => setFocusMode(false),
    [setFocusMode],
  );

  const openAddNodeDialog = useCallback((parentNode: OrgNode | null) => {
    setAddNodeParent(parentNode);
    setNewNodeName("");
    setNewNodeCode("");
    setNewNodeDescription("");
    setNewNodeType("");
    setAddNodeDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((node: OrgNode) => {
    setNodeToDelete(node);
    setDeleteDialogOpen(true);
  }, []);
  const openMoveDialog = useCallback((node: OrgNode) => {
    setNodeToMove(node);
    setMoveTargetId("");
    setMoveDialogOpen(true);
  }, []);

  const handleContextAction = useCallback(
    (action: string, node: TreeNode) => {
      switch (action) {
        case "add-child":
          openAddNodeDialog(node);
          break;
        case "edit":
          selectNode(node);
          setDetailOpen(true);
          break;
        case "move":
          openMoveDialog(node);
          break;
        case "delete":
          openDeleteDialog(node);
          break;
      }
    },
    [openAddNodeDialog, selectNode, openMoveDialog, openDeleteDialog],
  );

  const handleDrop = useCallback(
    async (targetId: string) => {
      const movedId = draggedId;
      setDraggedId(null);
      if (!movedId || movedId === targetId || !currentTree) return;
      const isDescendant = (pid: string, cid: string): boolean =>
        nodes
          .filter((n) => n.parent_id === pid)
          .some((c) => c.id === cid || isDescendant(c.id, cid));
      if (isDescendant(movedId, targetId)) {
        toast.error(
          "Impossible de deplacer un noeud dans un de ses descendants",
        );
        return;
      }
      const movedNode = nodes.find((n) => n.id === movedId);
      if (movedNode?.parent_id === targetId) return;
      try {
        await orgApi.nodes.move(movedId, targetId);
        toast.success(
          `"${movedNode?.name}" deplace sous "${nodes.find((n) => n.id === targetId)?.name}"`,
        );
        await reloadTree();
      } catch (err) {
        console.error("[DnD] move failed:", err);
        toast.error("Erreur lors du deplacement");
      }
    },
    [draggedId, currentTree, nodes, reloadTree],
  );

  // Drop a person from the unassigned panel onto a node → create a new
  // structure-axis member assignment. The backend enforces the at-most-
  // one-primary-per-axis rule, so we always post `is_primary: false`.
  const handlePersonDrop = useCallback(
    async (targetNodeId: string, personId: string) => {
      const tenantId = useTenantStore.getState().tenant?.id;
      if (!tenantId) {
        toast.error("Tenant inconnu — reconnectez-vous");
        return;
      }
      const person = personsById[personId];
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      try {
        await orgApi.assignments.create({
          // The canonical POST body is augmented with tenant_id, axis
          // and role — fields the TS `Assignment` type doesn't declare,
          // so we cross the boundary with an unknown cast.
          ...({
            tenant_id: tenantId,
            person_id: personId,
            node_id: targetNodeId,
            axis: "structure",
            role: "member",
            is_primary: false,
          } as unknown as Parameters<typeof orgApi.assignments.create>[0]),
        });
        toast.success(
          person && targetNode
            ? `${person.first_name} ${person.last_name} assigne(e) a ${targetNode.name}`
            : "Personne assignee",
        );
        await fetchAssignmentsForAllNodes(nodes);
      } catch (err) {
        console.error("[DnD] assignment create failed:", err);
        toast.error("Erreur lors de l'affectation");
      }
    },
    [fetchAssignmentsForAllNodes, nodes, personsById],
  );

  // Move an already-assigned person onto a different node by dragging
  // their avatar. Uses PUT /org/assignments/:id with the new node_id.
  const handlePersonMove = useCallback(
    async (
      assignmentId: string,
      personId: string,
      sourceNodeId: string,
      targetNodeId: string,
    ) => {
      if (sourceNodeId === targetNodeId) return;
      const person = personsById[personId];
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      try {
        await orgApi.assignments.update(assignmentId, {
          ...({ node_id: targetNodeId } as unknown as Parameters<
            typeof orgApi.assignments.update
          >[1]),
        });
        toast.success(
          person && targetNode
            ? `${person.first_name} ${person.last_name} deplace(e) vers ${targetNode.name}`
            : "Affectation deplacee",
        );
        await fetchAssignmentsForAllNodes(nodes);
      } catch (err) {
        console.error("[DnD] assignment move failed:", err);
        toast.error("Erreur lors du deplacement");
      }
    },
    [fetchAssignmentsForAllNodes, nodes, personsById],
  );

  const handleToolbarAddNode = useCallback(
    (nodeType: string, parent: OrgNode | null) => {
      setNewNodeType(nodeType);
      setAddNodeParent(parent);
      setNewNodeName("");
      setNewNodeCode("");
      setNewNodeDescription("");
      setAddNodeDialogOpen(true);
    },
    [],
  );

  const nodeTypesByTree = currentTree
    ? getNodeTypesByTreeType(currentTree.tree_type)
    : INTERNAL_NODE_TYPES;

  const moveTargets = useMemo(() => {
    if (!nodeToMove) return nodes;
    const desc = new Set<string>();
    const collect = (id: string) => {
      desc.add(id);
      nodes.filter((n) => n.parent_id === id).forEach((c) => collect(c.id));
    };
    collect(nodeToMove.id);
    return nodes.filter((n) => !desc.has(n.id));
  }, [nodeToMove, nodes]);

  const treeCreationFilteredPersons = useMemo(() => {
    if (!newTreePersonSearch) return persons;
    const q = newTreePersonSearch.toLowerCase();
    return persons.filter(
      (p: Person) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [persons, newTreePersonSearch]);

  const focusBreadcrumb = useMemo(() => {
    if (!selectedNode) return [];
    return [...getAncestorNames(selectedNode.id, nodes), selectedNode.name];
  }, [selectedNode, nodes]);

  // Bound async handlers
  const onCreateTree = () =>
    handleCreateTree({
      newTreeName,
      newTreeType,
      newTreeDecisionMakerId,
      setCreatingTree,
      setCreateTreeDialogOpen,
      setNewTreeName,
      setNewTreeDecisionMakerId,
      setNewTreePersonSearch,
      fetchTrees,
      setCurrentTree,
    });
  const onDeleteTree = () =>
    handleDeleteTree({
      currentTree,
      selectNode,
      setDetailOpen,
      setCurrentTree,
      fetchTrees,
    });
  const onAddNode = () =>
    handleAddNode({
      newNodeName,
      newNodeType,
      newNodeCode,
      newNodeDescription,
      addNodeParent,
      currentTree,
      setAddingNode,
      setAddNodeDialogOpen,
      reloadTree,
    });
  const onDeleteNode = () =>
    handleDeleteNode({
      nodeToDelete,
      currentTree,
      nodes,
      selectedNode,
      setDeleting,
      setDeleteDialogOpen,
      selectNode,
      setDetailOpen,
      setCurrentTree,
      fetchTrees,
      reloadTree,
    });
  const onMoveNode = () =>
    handleMoveNode({
      nodeToMove,
      moveTargetId,
      currentTree,
      setMoving,
      setMoveDialogOpen,
      reloadTree,
    });

  return (
    <AppLayout>
      <div
        className={cn(
          "flex flex-col overflow-hidden -m-4 md:-m-6",
          "h-[calc(100vh-4rem)] relative z-0",
        )}
      >
        {!focusMode && (
          <OrgTreeHeader
            trees={trees}
            treesLoading={treesLoading}
            currentTree={currentTree}
            onSelectTree={setCurrentTree}
            onCreateTree={() => setCreateTreeDialogOpen(true)}
            onDeleteTree={onDeleteTree}
          />
        )}

        {focusMode && freshSelectedNode && (
          <FocusBreadcrumb
            breadcrumb={focusBreadcrumb}
            onExit={handleExitFocusMode}
          />
        )}

        {currentTree ? (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {!focusMode && activeNavTab === "tree" && (
              <UnassignedPeoplePanel
                persons={persons}
                assignmentsByNode={assignmentsByNode}
                className="hidden lg:flex"
              />
            )}

            {!focusMode && (
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <StatsBar
                  nodeCount={nodes.length}
                  personCount={persons.length}
                  policyCount={policies.length}
                  siteCount={sites.length}
                />
                <OrgToolbar
                  activeNavTab={activeNavTab as NavTab}
                  onNavTabChange={(tab) => setActiveNavTab(tab)}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  selectedNode={selectedNode}
                  nodeTypesByTree={nodeTypesByTree}
                  onAddNode={handleToolbarAddNode}
                  onEnterFocusMode={() => {
                    setFocusMode(true);
                    setDetailOpen(true);
                  }}
                  onExport={handleExport}
                  onPrint={handlePrint}
                />

                <div className="flex-1 overflow-auto min-w-0">
                  {activeNavTab === "groups" ? (
                    <GroupsNav
                      groups={groups}
                      loading={groupsLoading}
                      selectedGroupId={selectedGroupId}
                      onSelectGroup={(g) => setSelectedGroupId(g.id)}
                    />
                  ) : activeNavTab === "sites" ? (
                    <SitesNav
                      sites={sites}
                      loading={sitesLoading}
                      selectedSiteId={selectedSiteId}
                      onSelectSite={(s) => setSelectedSiteId(s.id)}
                    />
                  ) : nodesLoading ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                      Chargement de la structure...
                    </div>
                  ) : nodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2 mt-12">
                      <Building2 className="h-10 w-10 opacity-30" />
                      <p>Aucun noeud dans cet arbre</p>
                      <p className="text-xs">
                        Cliquez sur &laquo;Ajouter&raquo; pour commencer
                      </p>
                    </div>
                  ) : viewMode === "tree" ? (
                    <div className="p-2 space-y-0.5 overflow-x-hidden">
                      {treeHierarchy.map((node) => (
                        <TreeNodeItem
                          key={node.id}
                          node={node}
                          depth={0}
                          selectedId={selectedNode?.id ?? null}
                          onSelect={handleSelectNode}
                          expanded={expanded}
                          onToggleExpand={handleToggleExpand}
                          onContextAction={handleContextAction}
                          searchQuery={debouncedSearchQuery}
                          draggedId={draggedId}
                          onDragStart={setDraggedId}
                          onDrop={handleDrop}
                          onDragEnd={() => setDraggedId(null)}
                          onDoubleClick={handleDoubleClickNode}
                          boardMap={boardMap}
                          assignmentsByNode={assignmentsByNode}
                          personsById={personsById}
                          onPersonDrop={handlePersonDrop}
                          onPersonMove={handlePersonMove}
                        />
                      ))}
                    </div>
                  ) : viewMode === "orgchart" ? (
                    <div className="h-full min-h-[500px]">
                      <OrgChartCard
                        nodes={nodes}
                        selectedId={selectedNode?.id ?? null}
                        onSelect={handleSelectNode}
                        boardMap={boardMap}
                        assignmentsByNode={assignmentsByNode}
                        personsById={personsById}
                        onPersonDrop={handlePersonDrop}
                        onPersonMove={handlePersonMove}
                      />
                    </div>
                  ) : (
                    <ListView
                      nodes={nodes}
                      selectedId={selectedNode?.id ?? null}
                      onSelect={handleSelectNode}
                      searchQuery={debouncedSearchQuery}
                    />
                  )}
                </div>
              </div>
            )}

            {focusMode ? (
              <div className="flex-1 bg-card flex flex-col overflow-hidden">
                <DetailPanel
                  node={freshSelectedNode}
                  allNodes={nodes}
                  tree={currentTree}
                  onClose={handleCloseDetail}
                  onNodeUpdated={reloadTree}
                  onAddChild={openAddNodeDialog}
                  onDeleteNode={openDeleteDialog}
                  onMoveNode={openMoveDialog}
                  focusMode={true}
                  allPolicies={policies}
                  persons={persons}
                  groups={groups}
                  sites={sites}
                />
              </div>
            ) : detailOpen ? (
              <div className="w-full lg:w-[420px] lg:shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card flex flex-col overflow-hidden">
                <DetailPanel
                  node={freshSelectedNode}
                  allNodes={nodes}
                  tree={currentTree}
                  onClose={handleCloseDetail}
                  onNodeUpdated={reloadTree}
                  onAddChild={openAddNodeDialog}
                  onDeleteNode={openDeleteDialog}
                  onMoveNode={openMoveDialog}
                  focusMode={false}
                  allPolicies={policies}
                  persons={persons}
                  groups={groups}
                  sites={sites}
                />
              </div>
            ) : (
              !focusMode && (
                <div className="hidden lg:flex w-[420px] shrink-0 items-center justify-center text-muted-foreground text-sm p-8 text-center border-l border-border overflow-hidden">
                  <div>
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Selectionnez un noeud</p>
                    <p className="text-xs mt-1">
                      pour voir et modifier ses details
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3">
            <Building2 className="h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">
              Selectionnez un arbre organisationnel
            </p>
            <p className="text-sm">ou creez-en un nouveau</p>
          </div>
        )}
      </div>

      <CreateTreeDialog
        open={createTreeDialogOpen}
        onOpenChange={setCreateTreeDialogOpen}
        newTreeName={newTreeName}
        onNewTreeNameChange={setNewTreeName}
        newTreeType={newTreeType}
        onNewTreeTypeChange={setNewTreeType}
        newTreePersonSearch={newTreePersonSearch}
        onNewTreePersonSearchChange={setNewTreePersonSearch}
        newTreeDecisionMakerId={newTreeDecisionMakerId}
        onNewTreeDecisionMakerIdChange={setNewTreeDecisionMakerId}
        filteredPersons={treeCreationFilteredPersons}
        creatingTree={creatingTree}
        onConfirm={onCreateTree}
      />
      <AddNodeDialog
        open={addNodeDialogOpen}
        onOpenChange={setAddNodeDialogOpen}
        addNodeParent={addNodeParent}
        newNodeName={newNodeName}
        onNewNodeNameChange={setNewNodeName}
        newNodeType={newNodeType}
        onNewNodeTypeChange={setNewNodeType}
        newNodeCode={newNodeCode}
        onNewNodeCodeChange={setNewNodeCode}
        newNodeDescription={newNodeDescription}
        onNewNodeDescriptionChange={setNewNodeDescription}
        nodeTypesByTree={nodeTypesByTree}
        addingNode={addingNode}
        onConfirm={onAddNode}
      />
      <DeleteNodeDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        nodeToDelete={nodeToDelete}
        deleting={deleting}
        onConfirm={onDeleteNode}
      />
      <MoveNodeDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        nodeToMove={nodeToMove}
        moveTargetId={moveTargetId}
        onMoveTargetIdChange={setMoveTargetId}
        moveTargets={moveTargets}
        moving={moving}
        onConfirm={onMoveNode}
      />
    </AppLayout>
  );
}
