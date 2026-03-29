"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, FileCheck } from "lucide-react";
import { toast } from "sonner";

export interface RevisionStep {
  id: "draft" | "review" | "approved" | "published";
  label: string;
  icon: React.ReactNode;
  completed: boolean;
}

export interface RevisionWorkflowProps {
  documentId: string;
  documentTitle: string;
  currentStep: "draft" | "review" | "approved" | "published";
  reviewerName?: string;
  reviewerEmail?: string;
  onApprove?: (docId: string) => Promise<void>;
  onReject?: (docId: string, reason: string) => Promise<void>;
}

const STEPS: RevisionStep[] = [
  { id: "draft", label: "Brouillon", icon: <Clock className="w-4 h-4" />, completed: false },
  { id: "review", label: "Relecture", icon: <AlertCircle className="w-4 h-4" />, completed: false },
  { id: "approved", label: "Approuvé", icon: <CheckCircle2 className="w-4 h-4" />, completed: false },
  { id: "published", label: "Publié", icon: <FileCheck className="w-4 h-4" />, completed: false },
];

export function RevisionWorkflow({
  documentId,
  documentTitle,
  currentStep,
  reviewerName,
  reviewerEmail,
  onApprove,
  onReject,
}: RevisionWorkflowProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const completedSteps = STEPS.slice(0, stepIndex).map((s) => ({ ...s, completed: true }));
  const currentStepObj = STEPS[stepIndex] || STEPS[0];
  const futureSteps = STEPS.slice(stepIndex + 1);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(documentId);
      toast.success("Document approuvé et passé à l'étape suivante");
    } catch (error) {
      toast.error("Erreur lors de l'approbation du document");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !rejectReason.trim()) {
      toast.error("Veuillez fournir une raison de rejet");
      return;
    }
    setIsRejecting(true);
    try {
      await onReject(documentId, rejectReason);
      toast.success("Document rejeté avec feedback envoyé");
      setRejectReason("");
      setShowRejectForm(false);
    } catch (error) {
      toast.error("Erreur lors du rejet du document");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{documentTitle}</h3>
        <p className="text-sm text-muted-foreground">ID: {documentId}</p>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {/* Completed Steps */}
        {completedSteps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
              {step.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700">{step.label}</p>
              <p className="text-xs text-muted-foreground">Complété</p>
            </div>
          </div>
        ))}

        {/* Current Step */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-200 animate-pulse">
            {currentStepObj.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-700">{currentStepObj.label}</p>
            <p className="text-xs text-blue-600">En cours</p>
          </div>
          <Badge className="bg-blue-600">Actif</Badge>
        </div>

        {/* Future Steps */}
        {futureSteps.map((step) => (
          <div key={step.id} className="flex items-center gap-3 opacity-50">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
              {step.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">{step.label}</p>
              <p className="text-xs text-gray-400">À venir</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reviewer Info */}
      {(reviewerName || reviewerEmail) && (
        <div className="bg-muted p-4 rounded-lg border border-border">
          <p className="text-sm font-medium text-muted-foreground">Responsable de la relecture:</p>
          <p className="text-sm text-muted-foreground mt-1">
            {reviewerName}
            {reviewerEmail && ` (${reviewerEmail})`}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {currentStep === "review" && (onApprove || onReject) && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isApproving ? "Approbation..." : "✓ Approuver"}
            </Button>
            <Button
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={isRejecting}
              variant="outline"
              className="flex-1"
            >
              ✗ Rejeter
            </Button>
          </div>

          {showRejectForm && (
            <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Expliquez les raisons du rejet..."
                className="w-full px-3 py-2 border border-red-300 rounded text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleReject}
                  disabled={isRejecting || !rejectReason.trim()}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isRejecting ? "Envoi..." : "Confirmer le rejet"}
                </Button>
                <Button
                  onClick={() => setShowRejectForm(false)}
                  variant="outline"
                  size="sm"
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
