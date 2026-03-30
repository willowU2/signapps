'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { signaturesApi } from '@/lib/api/crosslinks';
import type { SignatureEnvelope, EnvelopeStep } from '@/types/crosslinks';
import { AuditTrail } from './audit-trail';
import {
  CheckCircle2,
  Clock,
  Send,
  Users,
  Loader2,
  PenLine,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  voided: 'bg-gray-100 text-gray-400',
  expired: 'bg-orange-100 text-orange-700',
};

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'En attente', color: 'bg-gray-100 text-gray-600', icon: <Clock className="h-3 w-3" /> },
  notified: { label: 'Notifié', color: 'bg-blue-100 text-blue-600', icon: <Send className="h-3 w-3" /> },
  viewed: { label: 'Consulté', color: 'bg-purple-100 text-purple-600', icon: <PenLine className="h-3 w-3" /> },
  signed: { label: 'Signé', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  declined: { label: 'Refusé', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
  expired: { label: 'Expiré', color: 'bg-orange-100 text-orange-600', icon: <Clock className="h-3 w-3" /> },
};

interface EnvelopeDetailProps {
  envelope: SignatureEnvelope;
  onRefresh: () => void;
}

export function EnvelopeDetail({ envelope, onRefresh }: EnvelopeDetailProps) {
  const [steps, setSteps] = useState<EnvelopeStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [signingStep, setSigningStep] = useState<string | null>(null);

  const fetchSteps = useCallback(async () => {
    setLoadingSteps(true);
    try {
      const res = await signaturesApi.getSteps(envelope.id);
      setSteps(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Silently fail
    } finally {
      setLoadingSteps(false);
    }
  }, [envelope.id]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const handleSign = async (stepId: string) => {
    setSigningStep(stepId);
    try {
      await signaturesApi.signStep(envelope.id, stepId);
      toast.success('Étape signée');
      fetchSteps();
      onRefresh();
    } catch {
      toast.error('Impossible de signer cette étape');
    } finally {
      setSigningStep(null);
    }
  };

  const handleDecline = async (stepId: string) => {
    setSigningStep(stepId);
    try {
      await signaturesApi.declineStep(envelope.id, stepId);
      toast.success('Étape refusée');
      fetchSteps();
      onRefresh();
    } catch {
      toast.error('Impossible de refuser cette étape');
    } finally {
      setSigningStep(null);
    }
  };

  const statusColor = STATUS_COLORS[envelope.status] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg truncate">{envelope.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            ID: {envelope.id}
          </p>
        </div>
        <Badge className={`shrink-0 border-0 ${statusColor}`}>
          {envelope.status}
        </Badge>
      </div>

      <Separator />

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Créé le</p>
          <p className="font-medium">
            {format(new Date(envelope.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
          </p>
        </div>
        {envelope.expires_at && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Expire le</p>
            <p className="font-medium">
              {format(new Date(envelope.expires_at), 'dd MMM yyyy HH:mm', { locale: fr })}
            </p>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground mb-0.5">Document ID</p>
          <p className="font-mono text-xs bg-muted px-2 py-1 rounded truncate">
            {envelope.document_id}
          </p>
        </div>
      </div>

      <Separator />

      {/* Tabs: Signers + Audit */}
      <Tabs defaultValue="signers">
        <TabsList className="w-full">
          <TabsTrigger value="signers" className="flex-1 gap-2">
            <Users className="h-4 w-4" />
            Signataires
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Piste d&apos;audit
          </TabsTrigger>
        </TabsList>

        {/* Signers tab */}
        <TabsContent value="signers">
          {loadingSteps ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : steps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun signataire ajouté
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              {steps
                .sort((a, b) => a.step_order - b.step_order)
                .map((step) => {
                  const cfg = STEP_STATUS_CONFIG[step.status] ?? STEP_STATUS_CONFIG.pending;
                  const isLoading = signingStep === step.id;
                  return (
                    <div
                      key={step.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {step.step_order}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{step.signer_email}</p>
                          {step.signer_name && (
                            <p className="text-xs text-muted-foreground">{step.signer_name}</p>
                          )}
                          {step.signed_at && (
                            <p className="text-xs text-muted-foreground">
                              Signé le{' '}
                              {format(new Date(step.signed_at), 'dd MMM HH:mm', { locale: fr })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="secondary"
                          className={`flex items-center gap-1 text-xs border-0 ${cfg.color}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                        {step.status === 'pending' && envelope.status !== 'voided' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={isLoading}
                              onClick={() => handleSign(step.id)}
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Signer'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-600 hover:bg-red-50"
                              disabled={isLoading}
                              onClick={() => handleDecline(step.id)}
                            >
                              Refuser
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* Audit trail tab */}
        <TabsContent value="audit">
          <div className="mt-3">
            <AuditTrail
              envelopeId={envelope.id}
              steps={steps}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
