'use client';

import { useState, useEffect, useCallback } from 'react';
import { signaturesApi } from '@/lib/api/crosslinks';
import type { EnvelopeTransition, EnvelopeStep } from '@/types/crosslinks';
import { Loader2, CheckCircle2, Send, Ban, Clock, ShieldCheck, Eye, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock className="h-4 w-4 text-gray-500" />,
  sent: <Send className="h-4 w-4 text-blue-500" />,
  in_progress: <Clock className="h-4 w-4 text-yellow-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  declined: <Ban className="h-4 w-4 text-red-500" />,
  voided: <Ban className="h-4 w-4 text-gray-400" />,
  expired: <Clock className="h-4 w-4 text-orange-500" />,
  signed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  viewed: <Eye className="h-4 w-4 text-blue-400" />,
  notified: <Send className="h-4 w-4 text-blue-300" />,
  pending: <Clock className="h-4 w-4 text-gray-400" />,
  approved: <UserCheck className="h-4 w-4 text-green-500" />,
};

const ACTION_LABELS: Record<string, string> = {
  draft: 'Brouillon créé',
  sent: 'Envoyé aux signataires',
  in_progress: 'Signature en cours',
  completed: 'Complété',
  declined: 'Refusé',
  voided: 'Annulé',
  expired: 'Expiré',
  signed: 'Signé',
  viewed: 'Document consulté',
  notified: 'Notification envoyée',
  pending: 'En attente',
};

interface TimelineEvent {
  id: string;
  timestamp: string;
  action: string;
  fromStatus?: string;
  toStatus: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  documentHash?: string;
  stepId?: string;
  triggeredBy?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AuditTrailProps {
  envelopeId: string;
  steps?: EnvelopeStep[];
  className?: string;
}

export function AuditTrail({ envelopeId, steps, className }: AuditTrailProps) {
  const [transitions, setTransitions] = useState<EnvelopeTransition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await signaturesApi.transitions(envelopeId);
      setTransitions(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Silently fail — show empty trail
    } finally {
      setLoading(false);
    }
  }, [envelopeId]);

  useEffect(() => {
    fetchTransitions();
  }, [fetchTransitions]);

  // Build unified timeline from transitions + step sign events
  const events: TimelineEvent[] = transitions.map((t) => {
    const relatedStep = steps?.find((s) => s.id === t.step_id);
    return {
      id: t.id,
      timestamp: t.created_at,
      action: t.to_status,
      fromStatus: t.from_status,
      toStatus: t.to_status,
      reason: t.reason,
      triggeredBy: t.triggered_by,
      stepId: t.step_id,
      ipAddress: relatedStep?.signed_at ? undefined : undefined,
    };
  });

  // Add step-level sign events
  if (steps) {
    for (const step of steps) {
      if (step.status === 'signed' && step.signed_at) {
        // Check if not already covered by a transition
        const alreadyIn = events.some(
          (e) => e.stepId === step.id && e.toStatus === 'signed'
        );
        if (!alreadyIn) {
          events.push({
            id: `step-${step.id}`,
            timestamp: step.signed_at,
            action: 'signed',
            toStatus: 'signed',
            stepId: step.id,
            documentHash: step.signature_hash ?? undefined,
          });
        }
      }
    }
  }

  // Sort chronologically
  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Aucun événement enregistré
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

        <div className="space-y-0">
          {events.map((event, idx) => {
            const icon = STATUS_ICONS[event.toStatus] ?? (
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            );
            const label = ACTION_LABELS[event.toStatus] ?? event.toStatus;
            const isLast = idx === events.length - 1;

            return (
              <div key={event.id} className={cn('relative flex gap-4 pb-4', isLast && 'pb-0')}>
                {/* Icon bubble */}
                <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background border border-border shadow-sm">
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      {event.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">
                          Raison : {event.reason}
                        </p>
                      )}
                      {event.documentHash && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <ShieldCheck className="h-3 w-3 text-green-500" />
                          <p className="text-xs text-muted-foreground font-mono">
                            Hash : {event.documentHash.slice(0, 16)}…
                          </p>
                        </div>
                      )}
                      {event.stepId && steps && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {steps.find((s) => s.id === event.stepId)?.signer_email
                            ? `Signataire : ${steps.find((s) => s.id === event.stepId)!.signer_email}`
                            : null}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground shrink-0 pt-0.5">
                      {format(new Date(event.timestamp), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </time>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
