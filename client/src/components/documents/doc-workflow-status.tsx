"use client";

// IDEA-273: Document workflow status — draft→review→approved→published

import { useState } from "react";
import {
  ChevronRight,
  Clock,
  Eye,
  CheckCircle2,
  Globe,
  Send,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

export type WorkflowStep = "draft" | "review" | "approved" | "published";

interface WorkflowTransition {
  from: WorkflowStep;
  to: WorkflowStep;
  action: string;
  color: string;
}

const TRANSITIONS: WorkflowTransition[] = [
  {
    from: "draft",
    to: "review",
    action: "Submit for Review",
    color: "bg-blue-500",
  },
  { from: "review", to: "approved", action: "Approve", color: "bg-green-500" },
  {
    from: "review",
    to: "draft",
    action: "Request Changes",
    color: "bg-orange-500",
  },
  {
    from: "approved",
    to: "published",
    action: "Publish",
    color: "bg-purple-500",
  },
  { from: "published", to: "draft", action: "Unpublish", color: "bg-gray-500" },
];

const STEP_CONFIG: Record<
  WorkflowStep,
  {
    icon: React.ReactNode;
    label: string;
    variant: "secondary" | "default" | "outline";
  }
> = {
  draft: {
    icon: <Clock className="h-3.5 w-3.5" />,
    label: "Draft",
    variant: "secondary",
  },
  review: {
    icon: <Eye className="h-3.5 w-3.5" />,
    label: "Under Review",
    variant: "default",
  },
  approved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Approved",
    variant: "outline",
  },
  published: {
    icon: <Globe className="h-3.5 w-3.5" />,
    label: "Published",
    variant: "default",
  },
};

interface WorkflowEvent {
  id: string;
  step: WorkflowStep;
  action: string;
  user_name: string;
  comment?: string;
  created_at: string;
}

interface DocWorkflowStatusProps {
  documentId: string;
  currentStep: WorkflowStep;
  reviewerEmail?: string;
  history?: WorkflowEvent[];
  onTransition?: (
    docId: string,
    to: WorkflowStep,
    comment?: string,
    reviewerEmail?: string,
  ) => Promise<void>;
}

const ALL_STEPS: WorkflowStep[] = ["draft", "review", "approved", "published"];

export function DocWorkflowStatus({
  documentId,
  currentStep,
  reviewerEmail: initialReviewer = "",
  history = [],
  onTransition,
}: DocWorkflowStatusProps) {
  const [step, setStep] = useState<WorkflowStep>(currentStep);
  const [comment, setComment] = useState("");
  const [reviewerEmail, setReviewerEmail] = useState(initialReviewer);
  const [pending, setPending] = useState<WorkflowStep | null>(null);
  const [confirmTransition, setConfirmTransition] =
    useState<WorkflowTransition | null>(null);

  const availableTransitions = TRANSITIONS.filter((t) => t.from === step);
  const currentIdx = ALL_STEPS.indexOf(step);

  async function doTransition(t: WorkflowTransition) {
    setPending(t.to);
    try {
      await onTransition?.(
        documentId,
        t.to,
        comment || undefined,
        reviewerEmail || undefined,
      );
      setStep(t.to);
      setComment("");
      setConfirmTransition(null);
      toast.success(`Document moved to ${STEP_CONFIG[t.to].label}`);
    } catch {
      toast.error("Transition échouée");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Step progress bar */}
      <div className="flex items-center gap-1">
        {ALL_STEPS.map((s, i) => {
          const conf = STEP_CONFIG[s];
          const done = i < currentIdx;
          const active = s === step;
          return (
            <div key={s} className="flex items-center flex-1">
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
                  active && "bg-primary text-primary-foreground",
                  done && "text-muted-foreground",
                  !active && !done && "text-muted-foreground/50",
                )}
              >
                {conf.icon} {conf.label}
              </div>
              {i < ALL_STEPS.length - 1 && (
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 flex-shrink-0",
                    done ? "text-foreground" : "text-muted-foreground/40",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current status */}
      <div className="flex items-center gap-2">
        <Badge variant={STEP_CONFIG[step].variant} className="gap-1">
          {STEP_CONFIG[step].icon} {STEP_CONFIG[step].label}
        </Badge>
      </div>

      {/* Transition actions */}
      {availableTransitions.length > 0 && (
        <div className="space-y-3 border rounded-lg p-3">
          {confirmTransition ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{confirmTransition.action}</p>
              {confirmTransition.to === "review" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Reviewer email</Label>
                  <Input
                    value={reviewerEmail}
                    onChange={(e) => setReviewerEmail(e.target.value)}
                    placeholder="reviewer@example.com"
                    className="h-7 text-xs"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Comment (optional)</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => doTransition(confirmTransition)}
                  disabled={!!pending}
                >
                  {pending ? "…" : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmTransition(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((t) => (
                <Button
                  key={`${t.from}-${t.to}`}
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmTransition(t)}
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> {t.action}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">History</p>
          {history.map((ev) => (
            <div key={ev.id} className="flex items-start gap-2">
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {ev.user_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-medium">{ev.user_name}</span> ·{" "}
                  {ev.action}
                </p>
                {ev.comment && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                    <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {ev.comment}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(ev.created_at), "MMM d, HH:mm")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
