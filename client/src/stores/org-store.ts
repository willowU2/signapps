/**
 * Org Structure Store
 *
 * Zustand store for Enterprise Org Structure state.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { orgApi } from '@/lib/api/org';
import type { OrgTree, OrgNode, Person, Site, OrgContext } from '@/types/org';

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

  // Actions
  fetchTrees: () => Promise<void>;
  setCurrentTree: (tree: OrgTree | null) => void;
  fetchNodes: (treeId: string) => Promise<void>;
  selectNode: (node: OrgNode | null) => void;
  fetchPersons: (params?: { role?: string; node_id?: string; site_id?: string; active?: boolean }) => Promise<void>;
  fetchSites: () => Promise<void>;
  fetchOrgContext: () => Promise<void>;
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
};

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      ...initialState,

      fetchTrees: async () => {
        set({ treesLoading: true, treesError: null });
        try {
          const res = await orgApi.trees.list();
          set({ trees: res.data ?? [], treesLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Erreur lors du chargement des arbres';
          set({ treesError: message, treesLoading: false });
        }
      },

      setCurrentTree: (tree) => set({ currentTree: tree }),

      fetchNodes: async (treeId: string) => {
        set({ nodesLoading: true, nodesError: null });
        try {
          const res = await orgApi.trees.getFull(treeId);
          set({ nodes: res.data?.nodes ?? [], nodesLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Erreur lors du chargement des noeuds';
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
          const message = err instanceof Error ? err.message : 'Erreur lors du chargement des personnes';
          set({ personsError: message, personsLoading: false });
        }
      },

      fetchSites: async () => {
        set({ sitesLoading: true, sitesError: null });
        try {
          const res = await orgApi.sites.list();
          set({ sites: res.data ?? [], sitesLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Erreur lors du chargement des sites';
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

      reset: () => set(initialState),
    }),
    {
      name: 'org-storage',
      partialize: (state) => ({
        currentTree: state.currentTree,
        selectedNode: state.selectedNode,
      }),
    }
  )
);
