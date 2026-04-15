import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  routesApi,
  Route,
  Certificate,
  ShieldStats,
  CreateRouteRequest,
} from "@/lib/api";
import { toast } from "sonner";

export function useRoutes() {
  return useQuery<Route[]>({
    queryKey: ["routes"],
    retry: false,
    queryFn: async () => {
      const response = await routesApi.list();
      return response.data || [];
    },
  });
}

export function useCertificates() {
  return useQuery<Certificate[]>({
    queryKey: ["certificates"],
    queryFn: async () => {
      const response = await routesApi.listCertificates();
      return response.data || [];
    },
  });
}

export function useShieldStats() {
  return useQuery<ShieldStats | null>({
    queryKey: ["shield", "stats"],
    queryFn: async () => {
      const response = await routesApi.shieldStats();
      return response.data || null;
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await routesApi.delete(id);
    },
    onSuccess: () => {
      toast.success("Route deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
    onError: () => {
      toast.error("Impossible de supprimer route");
    },
  });
}

export function useToggleRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await routesApi.update(id, { enabled } as Partial<CreateRouteRequest>);
    },
    onSuccess: (_, { enabled }) => {
      toast.success(`Route ${enabled ? "enabled" : "disabled"} successfully`);
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
    onError: () => {
      toast.error("Failed to toggle route");
    },
  });
}

export function useRequestCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domain: string) => {
      await routesApi.requestCertificate(domain);
    },
    onSuccess: () => {
      toast.success("Certificate requested successfully");
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: () => {
      toast.error("Failed to request certificate");
    },
  });
}

export function useRenewCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await routesApi.renewCertificate(id);
    },
    onSuccess: () => {
      toast.success("Certificate renewal initiated");
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: () => {
      toast.error("Failed to renew certificate");
    },
  });
}
