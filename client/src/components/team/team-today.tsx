"use client";

import { CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  useMyTeam,
  usePendingActions,
  useApproveLeave,
  useRejectLeave,
} from "@/hooks/use-my-team";
import type { PendingAction } from "@/lib/api/my-team";

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-red-500",
];

function memberColor(name: string) {
  const index =
    name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  remote: "bg-blue-400",
  on_leave: "bg-amber-400",
  inactive: "bg-gray-400",
};

// ── Pending action card ───────────────────────────────────────────────────────

function PendingCard({ action }: { action: PendingAction }) {
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();

  const isLeave = action.type === "leave_request";
  const isPending = action.status === "pending";

  const handleApprove = () => {
    if (isLeave) {
      approveLeave.mutate({ leaveId: action.id });
    }
  };

  const handleReject = () => {
    if (isLeave) {
      rejectLeave.mutate({ leaveId: action.id, data: { reason: "" } });
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="flex items-start justify-between gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{action.employee_name}</p>
          <p className="text-xs text-muted-foreground">{action.description}</p>
          {action.due_date && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(action.due_date).toLocaleDateString("fr-FR")}
            </p>
          )}
          <Badge
            variant="outline"
            className={cn(
              "w-fit text-[10px]",
              action.type === "leave_request" &&
                "border-amber-400 text-amber-600",
              action.type === "timesheet_approval" &&
                "border-blue-400 text-blue-600",
            )}
          >
            {action.type === "leave_request" ? "Congé" : "Feuille de temps"}
          </Badge>
        </div>

        {isPending && isLeave && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-green-500 text-green-600 hover:bg-green-50"
              disabled={approveLeave.isPending}
              onClick={handleApprove}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approuver
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-destructive text-destructive hover:bg-destructive/10"
              disabled={rejectLeave.isPending}
              onClick={handleReject}
            >
              <XCircle className="h-3.5 w-3.5" />
              Refuser
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamToday() {
  const teamQuery = useMyTeam();
  const actionsQuery = usePendingActions();

  if (teamQuery.isLoading || actionsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-12 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    );
  }

  const members = teamQuery.data?.members ?? [];
  const pendingActions = actionsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* Presence grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Présence
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun membre dans l&apos;équipe.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {members.map((member) => {
              const initials =
                `${member.first_name[0] ?? ""}${member.last_name[0] ?? ""}`.toUpperCase();
              const dotColor = STATUS_DOT[member.status] ?? "bg-gray-400";
              return (
                <div
                  key={member.id}
                  className="flex flex-col items-center gap-1"
                  title={`${member.first_name} ${member.last_name} — ${member.status}`}
                >
                  <div className="relative">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white",
                        memberColor(`${member.first_name} ${member.last_name}`),
                      )}
                    >
                      {initials}
                    </div>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                        dotColor,
                      )}
                    />
                  </div>
                  <span className="max-w-[56px] truncate text-center text-[10px] text-muted-foreground">
                    {member.first_name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending actions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Actions en attente
        </h2>
        {pendingActions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium">Aucune action en attente</p>
              <p className="text-xs text-muted-foreground">
                Toutes les demandes ont été traitées.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingActions.map((action) => (
              <PendingCard key={action.id} action={action} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
