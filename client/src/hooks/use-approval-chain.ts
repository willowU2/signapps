'use client';

// Feature 18: Approval chain — request → approve → execute

import { useState, useEffect, useCallback } from 'react';
import { getClient, ServiceName } from '@/lib/api/factory';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export interface ApprovalStep {
  stepId: string;
  approverId: string;
  approverName: string;
  status: ApprovalStatus;
  comment?: string;
  decidedAt?: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description: string;
  requesterId: string;
  requesterName: string;
  entityType: string;
  entityId: string;
  steps: ApprovalStep[];
  currentStep: number;
  status: ApprovalStatus;
  createdAt: string;
  executedAt?: string;
}

export function useApprovalChain(entityId?: string) {
  const client = getClient(ServiceName.IDENTITY);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = entityId ? { entity_id: entityId } : {};
      const { data } = await client.get<ApprovalRequest[]>('/approvals', { params });
      setRequests(data);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [client, entityId]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (
    title: string,
    description: string,
    entityType: string,
    entityId: string,
    approverIds: string[],
  ) => {
    const steps: Omit<ApprovalStep, 'approverId' | 'approverName'>[] = approverIds.map((id, i) => ({
      stepId: `step_${i}`,
      status: 'pending' as const,
    }));
    const { data } = await client.post<ApprovalRequest>('/approvals', {
      title, description, entity_type: entityType, entity_id: entityId, approver_ids: approverIds,
    });
    setRequests(prev => [data, ...prev]);
    return data;
  }, [client]);

  const decide = useCallback(async (requestId: string, approved: boolean, comment?: string) => {
    const { data } = await client.patch<ApprovalRequest>(`/approvals/${requestId}/decide`, {
      approved, comment,
    });
    setRequests(prev => prev.map(r => r.id === requestId ? data : r));
    return data;
  }, [client]);

  const pending = requests.filter(r => r.status === 'pending');
  const myPending = pending.filter(r =>
    r.steps[r.currentStep]?.approverId === 'me'
  );

  return { requests, pending, myPending, loading, submit, decide, refresh: load };
}
