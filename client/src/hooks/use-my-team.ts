"use client";

/**
 * My Team hooks — react-query wrappers for the My Team API
 *
 * Provides data fetching, mutation, and store synchronisation for the
 * manager's team view (pending leave approvals, timesheet approvals, etc.).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  myTeamApi,
  ApproveLeaveRequest,
  RejectLeaveRequest,
  ApproveTimesheetRequest,
} from "@/lib/api/my-team";
import { useTeamStore } from "@/stores/team-store";

// ============================================================================
// Query keys
// ============================================================================

export const myTeamKeys = {
  all: ["my-team"] as const,
  team: () => [...myTeamKeys.all, "members"] as const,
  summary: () => [...myTeamKeys.all, "summary"] as const,
  pendingActions: () => [...myTeamKeys.all, "pending-actions"] as const,
  pendingLeaves: () => [...myTeamKeys.all, "pending-leaves"] as const,
  pendingTimesheets: () => [...myTeamKeys.all, "pending-timesheets"] as const,
};

// ============================================================================
// Query hooks
// ============================================================================

/**
 * Fetches the current manager's team members.
 * Syncs `hasReports` into the team store.
 */
export function useMyTeam() {
  const setHasReports = useTeamStore((s) => s.setHasReports);

  return useQuery({
    queryKey: myTeamKeys.team(),
    queryFn: async () => {
      const res = await myTeamApi.getMyTeam();
      const data = res.data;
      setHasReports(data.total > 0);
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetches the team summary (counts, pending actions badge).
 * Syncs `pendingActionsCount` into the team store.
 */
export function useTeamSummary() {
  const setPendingActionsCount = useTeamStore((s) => s.setPendingActionsCount);

  return useQuery({
    queryKey: myTeamKeys.summary(),
    queryFn: async () => {
      const res = await myTeamApi.getSummary();
      const data = res.data;
      setPendingActionsCount(data.pending_actions);
      return data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Fetches all pending actions (leaves + timesheets) for the manager.
 */
export function usePendingActions() {
  return useQuery({
    queryKey: myTeamKeys.pendingActions(),
    queryFn: async () => {
      const res = await myTeamApi.listPendingActions();
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// Mutation hooks
// ============================================================================

/**
 * Approves a leave request.
 * Shows toast feedback and invalidates pending action queries.
 */
export function useApproveLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leaveId,
      data,
    }: {
      leaveId: string;
      data?: ApproveLeaveRequest;
    }) => {
      const res = await myTeamApi.approveLeave(leaveId, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Demande de congé approuvée");
      queryClient.invalidateQueries({ queryKey: myTeamKeys.pendingActions() });
      queryClient.invalidateQueries({ queryKey: myTeamKeys.pendingLeaves() });
      queryClient.invalidateQueries({ queryKey: myTeamKeys.summary() });
    },
    onError: () => {
      toast.error("Impossible d'approuver la demande de congé");
    },
  });
}

/**
 * Rejects a leave request.
 * Shows toast feedback and invalidates pending action queries.
 */
export function useRejectLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leaveId,
      data,
    }: {
      leaveId: string;
      data: RejectLeaveRequest;
    }) => {
      const res = await myTeamApi.rejectLeave(leaveId, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Demande de congé refusée");
      queryClient.invalidateQueries({ queryKey: myTeamKeys.pendingActions() });
      queryClient.invalidateQueries({ queryKey: myTeamKeys.pendingLeaves() });
      queryClient.invalidateQueries({ queryKey: myTeamKeys.summary() });
    },
    onError: () => {
      toast.error("Impossible de refuser la demande de congé");
    },
  });
}

/**
 * Approves a timesheet submission.
 * Shows toast feedback and invalidates pending action queries.
 */
export function useApproveTimesheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      timesheetId,
      data,
    }: {
      timesheetId: string;
      data?: ApproveTimesheetRequest;
    }) => {
      const res = await myTeamApi.approveTimesheet(timesheetId, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feuille de temps approuvée");
      queryClient.invalidateQueries({ queryKey: myTeamKeys.pendingActions() });
      queryClient.invalidateQueries({
        queryKey: myTeamKeys.pendingTimesheets(),
      });
      queryClient.invalidateQueries({ queryKey: myTeamKeys.summary() });
    },
    onError: () => {
      toast.error("Impossible d'approuver la feuille de temps");
    },
  });
}
