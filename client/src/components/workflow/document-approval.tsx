"use client";

// IDEA-126: Document approval circuit — submit doc for review, reviewer approves/rejects

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

export type ApprovalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "revision";

export interface ApprovalRecord {
  id: string;
  documentId: string;
  documentTitle: string;
  reviewerEmail: string;
  status: ApprovalStatus;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_META: Record<
  ApprovalStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Brouillon",
    color: "bg-muted text-muted-foreground",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  pending: {
    label: "En attente",
    color: "bg-yellow-100 text-yellow-700",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  approved: {
    label: "Approuvé",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  rejected: {
    label: "Rejeté",
    color: "bg-red-100 text-red-700",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  revision: {
    label: "Révision demandée",
    color: "bg-orange-100 text-orange-700",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
};

// ─── Submit for Review ─────────────────────────────────────────────────────────

interface SubmitApprovalDialogProps {
  documentId: string;
  documentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function SubmitApprovalDialog({
  documentId,
  documentTitle,
  open,
  onOpenChange,
  onSubmitted,
}: SubmitApprovalDialogProps) {
  const [reviewer, setReviewer] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reviewer.trim()) {
      toast.error("Veuillez saisir l'email du relecteur");
      return;
    }
    setLoading(true);
    try {
      const client = getClient(ServiceName.DOCS);
      await client.post("/approvals", {
        document_id: documentId,
        reviewer_email: reviewer.trim(),
        message: message.trim() || undefined,
      });
      toast.success("Demande d'approbation envoyée");
      onOpenChange(false);
      onSubmitted?.();
    } catch {
      toast.error("Impossible d'envoyer la demande");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Soumettre pour révision
          </DialogTitle>
          <DialogDescription>
            Le document &ldquo;{documentTitle}&rdquo; sera envoyé au relecteur
            pour approbation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email du relecteur *</label>
            <input
              type="email"
              placeholder="prenom.nom@entreprise.com"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message (optionnel)</label>
            <Textarea
              placeholder="Instructions spécifiques pour le relecteur…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            <Send className="h-4 w-4" />
            {loading ? "Envoi…" : "Soumettre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approval Action Dialog ────────────────────────────────────────────────────

interface ApprovalActionDialogProps {
  approval: ApprovalRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActioned?: () => void;
}

export function ApprovalActionDialog({
  approval,
  open,
  onOpenChange,
  onActioned,
}: ApprovalActionDialogProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<ApprovalStatus | null>(null);

  const handleAction = async (status: "approved" | "rejected" | "revision") => {
    setLoading(status);
    try {
      const client = getClient(ServiceName.DOCS);
      await client.patch(`/approvals/${approval.id}`, {
        status,
        comment: comment.trim() || undefined,
      });
      toast.success(
        status === "approved"
          ? "Document approuvé"
          : status === "rejected"
            ? "Document rejeté"
            : "Révision demandée",
      );
      onOpenChange(false);
      onActioned?.();
    } catch {
      toast.error("Impossible d'effectuer cette action");
    } finally {
      setLoading(null);
    }
  };

  const meta = STATUS_META[approval.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Révision du document</DialogTitle>
          <DialogDescription>{approval.documentTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Statut actuel :
            </span>
            <Badge className={`gap-1 ${meta.color}`}>
              {meta.icon}
              {meta.label}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Commentaire</label>
            <Textarea
              placeholder="Ajoutez un commentaire pour l'auteur…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2 text-orange-600 hover:text-orange-700"
            onClick={() => handleAction("revision")}
            disabled={loading !== null}
          >
            <MessageSquare className="h-4 w-4" />
            Demander révision
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => handleAction("rejected")}
            disabled={loading !== null}
          >
            <XCircle className="h-4 w-4" />
            Rejeter
          </Button>
          <Button
            className="gap-2 bg-green-600 hover:bg-green-700"
            onClick={() => handleAction("approved")}
            disabled={loading !== null}
          >
            <CheckCircle className="h-4 w-4" />
            Approuver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approval Status Badge ─────────────────────────────────────────────────────

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge className={`gap-1 text-xs ${meta.color}`}>
      {meta.icon}
      {meta.label}
    </Badge>
  );
}
