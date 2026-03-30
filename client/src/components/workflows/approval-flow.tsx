'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'waiting';

export interface ApprovalLevel {
  id: string;
  label: string;
  approver: string;
  status: ApprovalStatus;
  comment?: string;
  actedAt?: string;
}

export interface ApprovalFlowProps {
  title: string;
  levels: ApprovalLevel[];
  currentUserId?: string;
  onApprove?: (levelId: string, comment: string) => void;
  onReject?: (levelId: string, comment: string) => void;
  onSubmit?: () => void;
  readOnly?: boolean;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ApprovalStatus }) {
  if (status === 'approved') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'rejected') return <XCircle className="h-5 w-5 text-red-500" />;
  if (status === 'pending') return <Clock className="h-5 w-5 text-amber-500 animate-pulse" />;
  return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40" />;
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, { label: string; className: string }> = {
    approved: { label: 'Approuvé', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    pending: { label: 'En attente', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    waiting: { label: 'En file', className: 'bg-muted text-muted-foreground' },
  };
  const cfg = map[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.label}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApprovalFlow({
  title,
  levels,
  currentUserId,
  onApprove,
  onReject,
  onSubmit,
  readOnly = false,
}: ApprovalFlowProps) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const activeLevel = levels.find(l => l.status === 'pending');
  const isCurrentUserActive = activeLevel?.approver === currentUserId;

  const handleApprove = async (levelId: string) => {
    setActing(levelId);
    await onApprove?.(levelId, comments[levelId] || '');
    setActing(null);
  };

  const handleReject = async (levelId: string) => {
    setActing(levelId);
    await onReject?.(levelId, comments[levelId] || '');
    setActing(null);
  };

  const globalStatus = levels.some(l => l.status === 'rejected')
    ? 'rejected'
    : levels.every(l => l.status === 'approved')
    ? 'approved'
    : 'in_progress';

  return (
    <div className="border rounded-xl p-5 space-y-5 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Chaîne d&apos;approbation multi-niveaux</p>
        </div>
        <Badge
          variant="outline"
          className={
            globalStatus === 'approved' ? 'border-green-300 text-green-700' :
            globalStatus === 'rejected' ? 'border-red-300 text-red-700' :
            'border-amber-300 text-amber-700'
          }
        >
          {globalStatus === 'approved' ? 'Approuvé' : globalStatus === 'rejected' ? 'Rejeté' : 'En cours'}
        </Badge>
      </div>

      {/* Stepper */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-[10px] top-5 bottom-5 w-0.5 bg-border" />

        <div className="space-y-4">
          {levels.map((level, idx) => (
            <div key={level.id} className="relative pl-8">
              {/* Status icon */}
              <div className="absolute left-0 top-0.5">
                <StatusIcon status={level.status} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">Niveau {idx + 1}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{level.label}</span>
                  <StatusBadge status={level.status} />
                  {level.actedAt && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(level.actedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>

                {/* Comment */}
                {level.comment && (
                  <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground italic">
                    &ldquo;{level.comment}&rdquo;
                  </div>
                )}

                {/* Action area */}
                {!readOnly && level.status === 'pending' && isCurrentUserActive && acting !== level.id && (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      placeholder="Commentaire (optionnel)..."
                      value={comments[level.id] || ''}
                      onChange={e => setComments(c => ({ ...c, [level.id]: e.target.value }))}
                      rows={2}
                      className="text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(level.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approuver
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(level.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Rejeter
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit button */}
      {!readOnly && globalStatus === 'in_progress' && !activeLevel && onSubmit && (
        <Button className="w-full" onClick={onSubmit}>
          Soumettre pour approbation
        </Button>
      )}
    </div>
  );
}

// ─── Demo / default export ────────────────────────────────────────────────────

export function ApprovalFlowDemo() {
  const [levels, setLevels] = useState<ApprovalLevel[]>([
    { id: '1', label: 'Manager', approver: 'manager@company.com', status: 'approved', comment: 'OK validé', actedAt: new Date().toISOString() },
    { id: '2', label: 'Directeur', approver: 'director@company.com', status: 'pending' },
    { id: '3', label: 'Finance', approver: 'finance@company.com', status: 'waiting' },
  ]);

  const handleApprove = async (levelId: string, comment: string) => {
    setLevels(ls => {
      const updated = ls.map(l =>
        l.id === levelId ? { ...l, status: 'approved' as ApprovalStatus, comment, actedAt: new Date().toISOString() } : l
      );
      // Activate next
      const idx = updated.findIndex(l => l.status === 'waiting');
      if (idx >= 0) updated[idx] = { ...updated[idx], status: 'pending' };
      return updated;
    });
  };

  const handleReject = async (levelId: string, comment: string) => {
    setLevels(ls => ls.map(l =>
      l.id === levelId ? { ...l, status: 'rejected' as ApprovalStatus, comment, actedAt: new Date().toISOString() } : l
    ));
  };

  return (
    <ApprovalFlow
      title="Approbation du devis #2024-042"
      levels={levels}
      currentUserId="director@company.com"
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
