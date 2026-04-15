// Feature 26: Project completion → trigger HR performance review

import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface ProjectCompletionReview {
  id: string;
  projectId: string;
  projectName: string;
  completedAt: string;
  teamMembers: { employeeId: string; employeeName: string; role: string }[];
  reviewStatus: "pending" | "scheduled" | "completed";
  scheduledDate?: string;
  reviewType: "post_project" | "quarterly";
}

const DEMO_PENDING: ProjectCompletionReview[] = [
  {
    id: "rev1",
    projectId: "p3",
    projectName: "Migration PostgreSQL",
    completedAt: "2026-02-28T17:00:00Z",
    teamMembers: [
      { employeeId: "1", employeeName: "Alice Martin", role: "Lead Dev" },
      { employeeId: "8", employeeName: "Marc Dubois", role: "Backend Dev" },
    ],
    reviewStatus: "pending",
    reviewType: "post_project",
  },
];

export function useProjectPerformanceReview() {
  const [reviews, setReviews] =
    useState<ProjectCompletionReview[]>(DEMO_PENDING);
  const [scheduling, setScheduling] = useState(false);

  const triggerReviewOnCompletion = useCallback(
    async (params: {
      projectId: string;
      projectName: string;
      teamMembers: { employeeId: string; employeeName: string; role: string }[];
    }) => {
      const review: ProjectCompletionReview = {
        id: `rev-${Date.now()}`,
        projectId: params.projectId,
        projectName: params.projectName,
        completedAt: new Date().toISOString(),
        teamMembers: params.teamMembers,
        reviewStatus: "pending",
        reviewType: "post_project",
      };

      setReviews((prev) => [...prev, review]);

      toast.success(`Revue de performance déclenchée`, {
        description: `${params.teamMembers.length} revue(s) planifiées pour ${params.projectName}.`,
      });

      window.dispatchEvent(
        new CustomEvent("agentiq:notification", {
          detail: {
            id: `review-${review.id}`,
            type: "hr",
            title: `Revue de performance — ${params.projectName}`,
            message: `Le projet ${params.projectName} est terminé. ${params.teamMembers.length} revues de performance à planifier.`,
            context: { projectId: params.projectId, reviewId: review.id },
            recipients: params.teamMembers.map((m) => m.employeeId),
            createdAt: new Date().toISOString(),
            read: false,
          },
        }),
      );

      return review;
    },
    [],
  );

  const scheduleReview = useCallback(async (reviewId: string, date: string) => {
    setScheduling(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, reviewStatus: "scheduled" as const, scheduledDate: date }
          : r,
      ),
    );
    setScheduling(false);
    toast.success("Revue planifiée", {
      description: `Entretien prévu le ${new Date(date).toLocaleDateString("fr-FR")}.`,
    });
  }, []);

  const completeReview = useCallback((reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, reviewStatus: "completed" as const } : r,
      ),
    );
    toast.success("Revue de performance complétée.");
  }, []);

  const pendingReviews = reviews.filter((r) => r.reviewStatus === "pending");

  return {
    reviews,
    pendingReviews,
    scheduling,
    triggerReviewOnCompletion,
    scheduleReview,
    completeReview,
  };
}
