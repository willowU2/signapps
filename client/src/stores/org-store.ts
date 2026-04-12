/**
 * Org Structure Store
 *
 * Zustand store for Enterprise Org Structure state.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { orgApi } from "@/lib/api/org";
import type {
  OrgTree,
  OrgNode,
  Person,
  Site,
  OrgContext,
  OrgGroup,
  OrgPolicy,
  TreeType,
} from "@/types/org";

interface OrgState {
  // Data
  trees: OrgTree[];
  currentTree: OrgTree | null;
  nodes: OrgNode[];
  selectedNode: OrgNode | null;
  persons: Person[];
  sites: Site[];
  orgContext: OrgContext | null;

  // Loading
  treesLoading: boolean;
  nodesLoading: boolean;
  personsLoading: boolean;
  sitesLoading: boolean;

  // Errors
  treesError: string | null;
  nodesError: string | null;
  personsError: string | null;
  sitesError: string | null;

  // Groups
  groups: OrgGroup[];
  groupsLoading: boolean;
  groupsError: string | null;

  // Policies
  policies: OrgPolicy[];
  policiesLoading: boolean;
  policiesError: string | null;

  // Navigation
  activeNavTab: "tree" | "groups" | "sites";
  focusMode: boolean;

  // Actions
  fetchTrees: () => Promise<void>;
  setCurrentTree: (tree: OrgTree | null) => void;
  fetchNodes: (treeId: string) => Promise<void>;
  selectNode: (node: OrgNode | null) => void;
  fetchPersons: (params?: {
    role?: string;
    node_id?: string;
    site_id?: string;
    active?: boolean;
  }) => Promise<void>;
  fetchSites: () => Promise<void>;
  fetchOrgContext: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  fetchPolicies: () => Promise<void>;
  setActiveNavTab: (tab: "tree" | "groups" | "sites") => void;
  setFocusMode: (focus: boolean) => void;
  reset: () => void;
}

const initialState = {
  trees: [],
  currentTree: null,
  nodes: [],
  selectedNode: null,
  persons: [],
  sites: [],
  orgContext: null,
  treesLoading: false,
  nodesLoading: false,
  personsLoading: false,
  sitesLoading: false,
  treesError: null,
  nodesError: null,
  personsError: null,
  sitesError: null,
  groups: [] as OrgGroup[],
  groupsLoading: false,
  groupsError: null,
  policies: [] as OrgPolicy[],
  policiesLoading: false,
  policiesError: null,
  activeNavTab: "tree" as const,
  focusMode: false,
};

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      ...initialState,

      fetchTrees: async () => {
        set({ treesLoading: true, treesError: null });
        try {
          const res = await orgApi.trees.list();
          // The backend returns OrgTreeNode[] (full hierarchy).
          // We extract root nodes (parent_id = null) and map them to OrgTree shape.
          const raw = res.data ?? [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allNodes: any[] = Array.isArray(raw) ? raw : [];
          // GET /workforce/org/tree returns OrgTreeNode[] with serde(flatten),
          // so each item has all OrgNode fields directly (id, parent_id, node_type, name, ...)
          // plus children, depth, employee_count. Root nodes are the top-level items (parent_id = null).
          const roots: OrgTree[] = allNodes
            .filter((n) => !n.parent_id)
            .map((n) => {
              const nodeType = (n.node_type as string) ?? "";
              const treeType: TreeType = nodeType.startsWith("client")
                ? "clients"
                : nodeType.startsWith("supplier")
                  ? "suppliers"
                  : "internal";
              return {
                id: n.id as string,
                tenant_id: (n.tenant_id as string) ?? "",
                tree_type: treeType,
                name: n.name as string,
              };
            });
          set({ trees: roots, treesLoading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Erreur lors du chargement des arbres";
          set({ treesError: message, treesLoading: false });
        }
      },

      setCurrentTree: (tree) => set({ currentTree: tree }),

      fetchNodes: async (treeId: string) => {
        set({ nodesLoading: true, nodesError: null });
        try {
          // Get the root node itself + all its descendants
          const [rootRes, descRes] = await Promise.all([
            orgApi.nodes.get(treeId),
            orgApi.trees.getFull(treeId),
          ]);
          const root = rootRes.data;
          const descendants = descRes.data ?? [];
          const merged = root ? [root, ...descendants] : descendants;
          // Deduplicate by id and filter out nodes missing required fields
          const seen = new Set<string>();
          const allNodes = merged.filter((n: OrgNode) => {
            if (!n?.id || !n.node_type || seen.has(n.id)) return false;
            seen.add(n.id);
            return true;
          });
          set({ nodes: allNodes, nodesLoading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Erreur lors du chargement des noeuds";
          set({ nodesError: message, nodesLoading: false });
        }
      },

      selectNode: (node) => set({ selectedNode: node }),

      fetchPersons: async (params) => {
        set({ personsLoading: true, personsError: null });
        try {
          const res = await orgApi.persons.list(params);
          set({ persons: res.data ?? [], personsLoading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Erreur lors du chargement des personnes";
          set({ personsError: message, personsLoading: false });
        }
      },

      fetchSites: async () => {
        set({ sitesLoading: true, sitesError: null });
        try {
          const res = await orgApi.sites.list();
          set({ sites: res.data ?? [], sitesLoading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Erreur lors du chargement des sites";
          set({ sitesError: message, sitesLoading: false });
        }
      },

      fetchOrgContext: async () => {
        try {
          const res = await orgApi.context();
          set({ orgContext: res.data ?? null });
        } catch {
          // Context fetch is best-effort
        }
      },

      fetchGroups: async () => {
        set({ groupsLoading: true, groupsError: null });
        try {
          const res = await orgApi.groups.list();
          set({ groups: res.data ?? [], groupsLoading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Erreur lors du chargement des groupes";
          set({ groupsError: message, groupsLoading: false });
        }
      },

      fetchPolicies: async () => {
        set({ policiesLoading: true, policiesError: null });
        try {
          const res = await orgApi.policies.list();
          set({ policies: res.data ?? [], policiesLoading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Erreur lors du chargement des policies";
          set({ policiesError: message, policiesLoading: false });
        }
      },

      setActiveNavTab: (tab: "tree" | "groups" | "sites") =>
        set({ activeNavTab: tab }),
      setFocusMode: (focus: boolean) => set({ focusMode: focus }),

      reset: () => set(initialState),
    }),
    {
      name: "org-storage",
      partialize: (state) => ({
        currentTree: state.currentTree,
        selectedNode: state.selectedNode,
        activeNavTab: state.activeNavTab,
      }),
    },
  ),
);
