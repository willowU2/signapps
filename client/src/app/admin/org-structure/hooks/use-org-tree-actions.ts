import { useCallback } from "react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type { OrgNode, OrgTree, TreeType } from "@/types/org";

interface CreateTreeParams {
  newTreeName: string;
  newTreeType: TreeType;
  newTreeDecisionMakerId: string;
  setCreatingTree: (v: boolean) => void;
  setCreateTreeDialogOpen: (v: boolean) => void;
  setNewTreeName: (v: string) => void;
  setNewTreeDecisionMakerId: (v: string) => void;
  setNewTreePersonSearch: (v: string) => void;
  fetchTrees: () => Promise<void>;
  setCurrentTree: (tree: OrgTree | null) => void;
}

interface DeleteTreeParams {
  currentTree: OrgTree | null;
  selectNode: (node: OrgNode | null) => void;
  setDetailOpen: (v: boolean) => void;
  setCurrentTree: (tree: OrgTree | null) => void;
  fetchTrees: () => Promise<void>;
}

interface AddNodeParams {
  newNodeName: string;
  newNodeType: string;
  newNodeCode: string;
  newNodeDescription: string;
  addNodeParent: OrgNode | null;
  currentTree: OrgTree | null;
  setAddingNode: (v: boolean) => void;
  setAddNodeDialogOpen: (v: boolean) => void;
  reloadTree: () => Promise<void>;
}

interface DeleteNodeParams {
  nodeToDelete: OrgNode | null;
  currentTree: OrgTree | null;
  nodes: OrgNode[];
  selectedNode: OrgNode | null;
  setDeleting: (v: boolean) => void;
  setDeleteDialogOpen: (v: boolean) => void;
  selectNode: (node: OrgNode | null) => void;
  setDetailOpen: (v: boolean) => void;
  setCurrentTree: (tree: OrgTree | null) => void;
  fetchTrees: () => Promise<void>;
  reloadTree: () => Promise<void>;
}

interface MoveNodeParams {
  nodeToMove: OrgNode | null;
  moveTargetId: string;
  currentTree: OrgTree | null;
  setMoving: (v: boolean) => void;
  setMoveDialogOpen: (v: boolean) => void;
  reloadTree: () => Promise<void>;
}

export function useOrgTreeActions() {
  const handleCreateTree = useCallback(async (params: CreateTreeParams) => {
    const {
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
    } = params;
    if (!newTreeName.trim() || !newTreeDecisionMakerId) return;
    setCreatingTree(true);
    try {
      const res = await orgApi.trees.create({
        tree_type: newTreeType,
        name: newTreeName.trim(),
      });
      const createdNode = res.data!;
      try {
        await orgApi.nodes.createBoard(createdNode.id);
        await orgApi.nodes.addBoardMember(createdNode.id, {
          person_id: newTreeDecisionMakerId,
          role: "president",
          is_decision_maker: true,
          sort_order: 1,
        });
      } catch {
        console.warn("Board creation succeeded but member add may have failed");
      }
      toast.success("Arbre cree avec decideur");
      setCreateTreeDialogOpen(false);
      setNewTreeName("");
      setNewTreeDecisionMakerId("");
      setNewTreePersonSearch("");
      await fetchTrees();
      setCurrentTree({
        id: createdNode.id,
        tenant_id: createdNode.tenant_id ?? "",
        tree_type: newTreeType,
        name: createdNode.name,
      });
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setCreatingTree(false);
    }
  }, []);

  const handleDeleteTree = useCallback(async (params: DeleteTreeParams) => {
    const {
      currentTree,
      selectNode,
      setDetailOpen,
      setCurrentTree,
      fetchTrees,
    } = params;
    if (!currentTree) return;
    if (
      !confirm(
        `Supprimer l'arbre "${currentTree.name}" et tous ses noeuds ? Cette action est irreversible.`,
      )
    )
      return;
    try {
      await orgApi.nodes.deleteRecursive(currentTree.id);
      toast.success("Arbre supprime");
      setCurrentTree(null);
      selectNode(null);
      setDetailOpen(false);
      await fetchTrees();
    } catch {
      toast.error("Erreur lors de la suppression de l'arbre");
    }
  }, []);

  const handleAddNode = useCallback(async (params: AddNodeParams) => {
    const {
      newNodeName,
      newNodeType,
      newNodeCode,
      newNodeDescription,
      addNodeParent,
      currentTree,
      setAddingNode,
      setAddNodeDialogOpen,
      reloadTree,
    } = params;
    if (!newNodeName.trim() || !newNodeType || !currentTree) return;
    setAddingNode(true);
    try {
      await orgApi.nodes.create({
        parent_id: addNodeParent?.id ?? currentTree.id,
        node_type: newNodeType,
        name: newNodeName.trim(),
        code: newNodeCode.trim() || undefined,
        description: newNodeDescription.trim() || undefined,
        sort_order: 0,
        is_active: true,
        config: {},
      });
      toast.success("Noeud cree");
      setAddNodeDialogOpen(false);
      await reloadTree();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setAddingNode(false);
    }
  }, []);

  const handleDeleteNode = useCallback(async (params: DeleteNodeParams) => {
    const {
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
    } = params;
    if (!nodeToDelete || !currentTree) return;
    setDeleting(true);
    try {
      const hasChildren = nodes.some((n) => n.parent_id === nodeToDelete.id);
      if (hasChildren) {
        await orgApi.nodes.deleteRecursive(nodeToDelete.id);
      } else {
        await orgApi.nodes.delete(nodeToDelete.id);
      }
      toast.success("Noeud supprime");
      setDeleteDialogOpen(false);
      if (selectedNode?.id === nodeToDelete.id) {
        selectNode(null);
        setDetailOpen(false);
      }
      if (nodeToDelete.id === currentTree.id) {
        setCurrentTree(null);
        await fetchTrees();
      } else {
        await reloadTree();
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  }, []);

  const handleMoveNode = useCallback(async (params: MoveNodeParams) => {
    const {
      nodeToMove,
      moveTargetId,
      currentTree,
      setMoving,
      setMoveDialogOpen,
      reloadTree,
    } = params;
    if (!nodeToMove || !moveTargetId || !currentTree) return;
    setMoving(true);
    try {
      await orgApi.nodes.move(nodeToMove.id, moveTargetId);
      toast.success("Noeud deplace");
      setMoveDialogOpen(false);
      await reloadTree();
    } catch {
      toast.error("Erreur lors du deplacement");
    } finally {
      setMoving(false);
    }
  }, []);

  return {
    handleCreateTree,
    handleDeleteTree,
    handleAddNode,
    handleDeleteNode,
    handleMoveNode,
  };
}
