//! Zustand store for multi-tenant state management

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Tenant,
  Workspace,
  WorkspaceMember,
  tenantApi,
  workspacesApi,
} from "@/lib/api/tenant";

interface TenantState {
  // Current tenant
  tenant: Tenant | null;
  tenantLoading: boolean;
  tenantError: string | null;

  // Workspaces
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  workspacesLoading: boolean;
  workspacesError: string | null;

  // Current workspace members
  members: WorkspaceMember[];
  membersLoading: boolean;

  // Actions - Tenant
  fetchTenant: () => Promise<void>;
  clearTenant: () => void;

  // Actions - Workspaces
  fetchWorkspaces: () => Promise<void>;
  fetchMyWorkspaces: () => Promise<void>;
  selectWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (
    name: string,
    description?: string,
    color?: string,
  ) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    data: { name?: string; description?: string; color?: string },
  ) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  // Actions - Members
  fetchMembers: (workspaceId: string) => Promise<void>;
  addMember: (
    workspaceId: string,
    userId: string,
    role?: string,
  ) => Promise<void>;
  updateMemberRole: (
    workspaceId: string,
    userId: string,
    role: string,
  ) => Promise<void>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;

  // Reset
  reset: () => void;
}

const initialState = {
  tenant: null,
  tenantLoading: false,
  tenantError: null,
  workspaces: [],
  currentWorkspace: null,
  workspacesLoading: false,
  workspacesError: null,
  members: [],
  membersLoading: false,
};

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Tenant actions
      fetchTenant: async () => {
        set({ tenantLoading: true, tenantError: null });
        try {
          const response = await tenantApi.get();
          set({ tenant: response.data, tenantLoading: false });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Failed to fetch tenant";
          set({ tenantError: message, tenantLoading: false });
        }
      },

      clearTenant: () => set({ tenant: null }),

      // Workspace actions
      fetchWorkspaces: async () => {
        set({ workspacesLoading: true, workspacesError: null });
        try {
          const response = await workspacesApi.list();
          set({ workspaces: response.data, workspacesLoading: false });

          // Select first workspace if none selected
          const { currentWorkspace } = get();
          if (!currentWorkspace && response.data.length > 0) {
            const defaultWs =
              response.data.find((w) => w.is_default) || response.data[0];
            set({ currentWorkspace: defaultWs });
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to fetch workspaces";
          set({ workspacesError: message, workspacesLoading: false });
        }
      },

      fetchMyWorkspaces: async () => {
        set({ workspacesLoading: true, workspacesError: null });
        try {
          const response = await workspacesApi.mine();
          set({ workspaces: response.data, workspacesLoading: false });

          // Select first workspace if none selected
          const { currentWorkspace } = get();
          if (!currentWorkspace && response.data.length > 0) {
            const defaultWs =
              response.data.find((w) => w.is_default) || response.data[0];
            set({ currentWorkspace: defaultWs });
          }
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to fetch workspaces";
          set({ workspacesError: message, workspacesLoading: false });
        }
      },

      selectWorkspace: (workspace) => {
        set({ currentWorkspace: workspace, members: [] });
      },

      createWorkspace: async (name, description, color) => {
        const response = await workspacesApi.create({
          name,
          description,
          color,
        });
        const newWorkspace = response.data;
        set((state) => ({
          workspaces: [...state.workspaces, newWorkspace],
        }));
        return newWorkspace;
      },

      updateWorkspace: async (id, data) => {
        const response = await workspacesApi.update(id, data);
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? response.data : w,
          ),
          currentWorkspace:
            state.currentWorkspace?.id === id
              ? response.data
              : state.currentWorkspace,
        }));
      },

      deleteWorkspace: async (id) => {
        await workspacesApi.delete(id);
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
          currentWorkspace:
            state.currentWorkspace?.id === id ? null : state.currentWorkspace,
        }));
      },

      // Member actions
      fetchMembers: async (workspaceId) => {
        set({ membersLoading: true });
        try {
          const response = await workspacesApi.listMembers(workspaceId);
          set({ members: response.data, membersLoading: false });
        } catch {
          set({ members: [], membersLoading: false });
        }
      },

      addMember: async (workspaceId, userId, role) => {
        await workspacesApi.addMember(workspaceId, {
          user_id: userId,
          role: role as "owner" | "admin" | "member" | "viewer",
        });
        // Refresh members
        const { fetchMembers } = get();
        await fetchMembers(workspaceId);
      },

      updateMemberRole: async (workspaceId, userId, role) => {
        await workspacesApi.updateMemberRole(workspaceId, userId, {
          role: role as "owner" | "admin" | "member" | "viewer",
        });
        set((state) => ({
          members: state.members.map((m) =>
            m.user_id === userId
              ? { ...m, role: role as "owner" | "admin" | "member" | "viewer" }
              : m,
          ),
        }));
      },

      removeMember: async (workspaceId, userId) => {
        await workspacesApi.removeMember(workspaceId, userId);
        set((state) => ({
          members: state.members.filter((m) => m.user_id !== userId),
        }));
      },

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: "tenant-storage",
      partialize: (state) => ({
        currentWorkspace: state.currentWorkspace,
      }),
    },
  ),
);

// Selectors
export const useCurrentWorkspace = () =>
  useTenantStore((state) => state.currentWorkspace);
export const useWorkspaces = () => useTenantStore((state) => state.workspaces);
export const useTenant = () => useTenantStore((state) => state.tenant);
