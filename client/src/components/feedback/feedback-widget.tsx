'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, X, CheckCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──
interface FeedbackWidgetProps {
  /** Tenant or product identifier for targeting feedback */
  tenantId?: string;
  /** Endpoint to POST feedback to (defaults to /api/feedback) */
  endpoint?: string;
  /** Auto-show after N seconds (optional) */
  autoShowAfter?: number;
  /** Label shown in the bubble */
  label?: string;
}

interface FeedbackData {
  nps: number | null;
  comment: string;
  tenantId?: string;
  url: string;
  userAgent: string;
  submittedAt: string;
}

const NPS_LABELS: Record<number, string> = {
  0: '😡', 1: '😠', 2: '😕', 3: '😟', 4: '🙁',
  5: '😐', 6: '🙂', 7: '😊', 8: '😄', 9: '😁', 10: '🤩',
};

const NPS_CATEGORY = (score: number) => {
  if (score <= 6) return { label: 'Detracteur', color: 'text-red-500' };
  if (score <= 8) return { label: 'Passif', color: 'text-orange-500' };
  return { label: 'Promoteur', color: 'text-green-600' };
};

/**
 * FeedbackWidget — embeddable NPS feedback widget.
 *
 * Can be used inline in a page:
 *   <FeedbackWidget tenantId="acme" />
 *
 * Or embedded via script tag (see standalone export below).
 */
export function FeedbackWidget({
  tenantId,
  endpoint = '/api/feedback',
  autoShowAfter,
  label = 'Feedback',
}: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [nps, setNps] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<'nps' | 'comment' | 'done'>('nps');
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (autoShowAfter && !dismissed) {
      const t = setTimeout(() => setIsOpen(true), autoShowAfter * 1000);
      return () => clearTimeout(t);
    }
  }, [autoShowAfter, dismissed]);

  const handleNpsSelect = (score: number) => {
    setNps(score);
    setStep('comment');
  };

  const handleSubmit = async () => {
    if (nps === null) return;
    setSubmitting(true);

    const payload: FeedbackData = {
      nps,
      comment: comment.trim(),
      tenantId,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      submittedAt: new Date().toISOString(),
    };

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Fail silently — feedback should never break UX
    } finally {
      setSubmitting(false);
      setStep('done');
      setTimeout(() => {
        setIsOpen(false);
        setDismissed(true);
      }, 2500);
    }
  };

  const handleReset = () => {
    setNps(null);
    setComment('');
    setStep('nps');
  };

  if (dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" role="complementary" aria-label="Widget feedback">
      {/* Popup */}
      {isOpen && (
        <Card className="w-80 shadow-2xl border-2 border-primary/20 animate-in slide-in-from-bottom-3 duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                {step === 'done' ? 'Merci !' : 'Votre avis'}
              </CardTitle>
              <button
                onClick={() => { setIsOpen(false); setDismissed(true); }}
                className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-0.5"
                aria-label="Fermer le widget feedback"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {step === 'nps' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Quelle est la probabilite que vous recommandiez SignApps a un collegue ?
                </p>
                <div className="flex items-center justify-between gap-1">
                  {Array.from({ length: 11 }, (_, i) => i).map((score) => (
                    <button
                      key={score}
                      onClick={() => handleNpsSelect(score)}
                      className={cn(
                        'w-7 h-7 rounded text-xs font-bold transition-all hover:scale-110',
                        score <= 6
                          ? 'bg-red-100 hover:bg-red-200 text-red-700'
                          : score <= 8
                          ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                          : 'bg-green-100 hover:bg-green-200 text-green-700',
                      )}
                      aria-label={`Note ${score} sur 10`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Pas du tout</span>
                  <span>Certainement</span>
                </div>
              </div>
            )}

            {step === 'comment' && nps !== null && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" role="img" aria-label={`Note ${nps}`}>{NPS_LABELS[nps]}</span>
                  <div>
                    <div className="font-semibold">Note: {nps}/10</div>
                    <div className={`text-xs ${NPS_CATEGORY(nps).color}`}>
                      {NPS_CATEGORY(nps).label}
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Modifier
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="feedback-comment" className="text-sm font-medium">
                    Un commentaire ? (optionnel)
                  </label>
                  <Textarea
                    id="feedback-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Qu'est-ce qui pourrait etre ameliore ?"
                    rows={3}
                    className="text-sm resize-none"
                    maxLength={500}
                  />
                  <div className="text-xs text-muted-foreground text-right">{comment.length}/500</div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full"
                  size="sm"
                >
                  <Send className="w-3 h-3 mr-2" />
                  {submitting ? 'Envoi...' : 'Envoyer mon avis'}
                </Button>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center py-4 space-y-2">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                <p className="font-medium">Merci pour votre retour !</p>
                <p className="text-sm text-muted-foreground">
                  Votre avis nous aide a ameliorer SignApps.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bubble trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 font-medium text-sm"
          aria-label="Ouvrir le formulaire de feedback"
        >
          <MessageSquare className="w-4 h-4" />
          {label}
          <Badge className="bg-primary-foreground/20 text-primary-foreground text-xs px-1.5 py-0">
            NPS
          </Badge>
        </button>
      )}
    </div>
  );
}

/**
 * Standalone script-tag compatible export.
 * Usage: window.SignAppsFeedback?.init({ tenantId: 'xxx' })
 */
export function initFeedbackWidget(config: FeedbackWidgetProps) {
  if (typeof window === 'undefined') return;
  const root = document.getElementById('signapps-feedback-root');
  if (!root) {
    const div = document.createElement('div');
    div.id = 'signapps-feedback-root';
    document.body.appendChild(div);
  }
  // In production: dynamically import React + render FeedbackWidget here
  console.info('[SignApps Feedback] Widget initialized', config);
}
