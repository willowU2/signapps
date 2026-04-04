/**
 * React Query hooks for Active Directory administration.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adApi } from "@/lib/api/active-directory";
import type {
  CreateDomainRequest,
  AdDnsRecord,
  CreateDnsRecordRequest,
  GroupPolicyObject,
} from "@/types/active-directory";

// ── Domains ──

export function useAdDomains() {
  return useQuery({
    queryKey: ["ad-domains"],
    queryFn: async () => {
      const res = await adApi.domains.list();
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useAdDomain(id: string) {
  return useQuery({
    queryKey: ["ad-domain", id],
    queryFn: async () => {
      const res = await adApi.domains.get(id);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDomainRequest) => {
      const res = await adApi.domains.create(data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-domains"] }),
  });
}

export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await adApi.domains.delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-domains"] }),
  });
}

// ── Principal Keys ──

export function useAdKeys(domainId: string) {
  return useQuery({
    queryKey: ["ad-keys", domainId],
    queryFn: async () => {
      const res = await adApi.keys.list(domainId);
      return res.data;
    },
    enabled: !!domainId,
  });
}

export function useRotateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      domainId,
      principal,
    }: {
      domainId: string;
      principal: string;
    }) => {
      await adApi.keys.rotate(domainId, principal);
    },
    onSuccess: (_, { domainId }) =>
      qc.invalidateQueries({ queryKey: ["ad-keys", domainId] }),
  });
}

// ── DNS ──

export function useAdDnsZones(domainId: string) {
  return useQuery({
    queryKey: ["ad-dns-zones", domainId],
    queryFn: async () => {
      const res = await adApi.dns.zones(domainId);
      return res.data;
    },
    enabled: !!domainId,
  });
}

export function useAdDnsRecords(zoneId: string) {
  return useQuery({
    queryKey: ["ad-dns-records", zoneId],
    queryFn: async () => {
      const res = await adApi.dns.records(zoneId);
      return res.data;
    },
    enabled: !!zoneId,
  });
}

export function useAddDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      zoneId,
      data,
    }: {
      zoneId: string;
      data: CreateDnsRecordRequest;
    }): Promise<AdDnsRecord> => {
      const res = await adApi.dns.addRecord(zoneId, data);
      return res.data;
    },
    onSuccess: (_, { zoneId }) =>
      qc.invalidateQueries({ queryKey: ["ad-dns-records", zoneId] }),
  });
}

export function useDeleteDnsRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recordId,
      zoneId,
    }: {
      recordId: string;
      zoneId: string;
    }) => {
      await adApi.dns.deleteRecord(recordId);
    },
    onSuccess: (_, { zoneId }) =>
      qc.invalidateQueries({ queryKey: ["ad-dns-records", zoneId] }),
  });
}

// ── Computers ──

export function useAdComputers(domainId: string) {
  return useQuery({
    queryKey: ["ad-computers", domainId],
    queryFn: async () => {
      const res = await adApi.computers.list(domainId);
      return res.data;
    },
    enabled: !!domainId,
  });
}

// ── DC Status ──

export function useDcStatus() {
  return useQuery({
    queryKey: ["dc-status"],
    queryFn: async () => {
      const res = await adApi.status();
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

// ── GPOs ──

export function useAdGpos(domainId: string) {
  return useQuery({
    queryKey: ["ad-gpos", domainId],
    queryFn: async () => {
      const res = await adApi.gpos.list(domainId);
      return res.data;
    },
    enabled: !!domainId,
  });
}

export function useCreateGpo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      domainId,
      data,
    }: {
      domainId: string;
      data: Partial<GroupPolicyObject>;
    }) => {
      const res = await adApi.gpos.create(domainId, data);
      return res.data;
    },
    onSuccess: (_, { domainId }) =>
      qc.invalidateQueries({ queryKey: ["ad-gpos", domainId] }),
  });
}

export function useUpdateGpo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<GroupPolicyObject>;
    }) => {
      const res = await adApi.gpos.update(id, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-gpos"] }),
  });
}

export function useDeleteGpo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, domainId }: { id: string; domainId: string }) => {
      await adApi.gpos.delete(id);
    },
    onSuccess: (_, { domainId }) =>
      qc.invalidateQueries({ queryKey: ["ad-gpos", domainId] }),
  });
}
