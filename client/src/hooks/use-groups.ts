import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { identityApiClient } from "@/lib/api/core";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  member_count: number;
}

export interface CreateGroupRequest {
  name: string;
  description?: string | null;
  parent_id?: string | null;
}

export interface ListQuery {
  limit?: number;
  offset?: number;
}

export function useGroupList(params?: ListQuery) {
  return useQuery({
    queryKey: ["groups", params],
    queryFn: async () => {
      const res = await identityApiClient.get<Group[]>("/groups", { params });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGroup(id?: string) {
  return useQuery({
    queryKey: ["groups", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await identityApiClient.get<Group>(`/groups/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGroupRequest) => {
      const res = await identityApiClient.post<Group>("/groups", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateGroupRequest;
    }) => {
      const res = await identityApiClient.put<Group>(`/groups/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["groups", id] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await identityApiClient.delete(`/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
