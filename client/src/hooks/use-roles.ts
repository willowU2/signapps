import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesApi, type Role, type CreateRoleRequest } from '@/lib/api/identity';

export type { Role, CreateRoleRequest };

export function useRoleList() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.list();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRole(id?: string) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await rolesApi.get(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRoleRequest) => {
      const res = await rolesApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateRoleRequest }) => {
      const res = await rolesApi.update(id, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', id] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await rolesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

// Available resources and their possible actions
export const AVAILABLE_RESOURCES = [
  { key: 'containers', label: 'Conteneurs', actions: ['read', 'create', 'update', 'delete', 'start', 'stop'] },
  { key: 'storage', label: 'Stockage', actions: ['read', 'create', 'update', 'delete', 'share'] },
  { key: 'users', label: 'Utilisateurs', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'groups', label: 'Groupes', actions: ['read', 'create', 'update', 'delete', 'manage_members'] },
  { key: 'roles', label: 'Rôles', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'webhooks', label: 'Webhooks', actions: ['read', 'create', 'update', 'delete', 'test'] },
  { key: 'scheduler', label: 'Planificateur', actions: ['read', 'create', 'update', 'delete', 'run'] },
  { key: 'calendar', label: 'Calendrier', actions: ['read', 'create', 'update', 'delete'] },
  { key: 'mail', label: 'Messagerie', actions: ['read', 'send', 'delete'] },
  { key: 'docs', label: 'Documents', actions: ['read', 'create', 'update', 'delete', 'share'] },
  { key: 'chat', label: 'Chat', actions: ['read', 'send', 'delete', 'manage_channels'] },
  { key: 'settings', label: 'Paramètres', actions: ['read', 'update'] },
  { key: 'audit', label: 'Audit', actions: ['read', 'export'] },
] as const;

export type ResourceKey = typeof AVAILABLE_RESOURCES[number]['key'];
