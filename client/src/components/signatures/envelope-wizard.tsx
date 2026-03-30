'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Users,
  Send,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { signaturesApi } from '@/lib/api/crosslinks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { EnvelopeTemplate } from './template-manager';

// ---------------------------------------------------------------------------
// Step indicators
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: 'Document', icon: FileText },
  { id: 2, label: 'Signataires', icon: Users },
  { id: 3, label: 'Envoi', icon: Send },
];

interface StepIndicatorProps {
  current: number;
}

function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors',
                done && 'bg-green-500 text-white',
                active && 'bg-primary text-primary-foreground',
                !done && !active && 'bg-muted text-muted-foreground'
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                'text-sm',
                active ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signer row
// ---------------------------------------------------------------------------

interface Signer {
  id: string;
  email: string;
  name: string;
  action: 'sign' | 'approve' | 'witness' | 'acknowledge';
}

const ACTION_LABELS = {
  sign: 'Signer',
  approve: 'Approuver',
  witness: 'Témoin',
  acknowledge: 'Accuser réception',
};

// ---------------------------------------------------------------------------
// EnvelopeWizard
// ---------------------------------------------------------------------------

interface EnvelopeWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
  /** Pre-fill from a template */
  template?: EnvelopeTemplate;
}

export function EnvelopeWizard({ onSuccess, onCancel, template }: EnvelopeWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Document info
  const [title, setTitle] = useState(template?.name ?? '');
  const [documentId, setDocumentId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Step 2 — Signers
  const [signers, setSigners] = useState<Signer[]>(
    template
      ? Array.from({ length: template.signerCount }, (_, i) => ({
          id: crypto.randomUUID(),
          email: '',
          name: '',
          action: 'sign' as const,
        }))
      : [{ id: crypto.randomUUID(), email: '', name: '', action: 'sign' }]
  );

  const addSigner = () => {
    setSigners((prev) => [
      ...prev,
      { id: crypto.randomUUID(), email: '', name: '', action: 'sign' },
    ]);
  };

  const removeSigner = (id: string) => {
    if (signers.length <= 1) return;
    setSigners((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSigner = (id: string, field: keyof Signer, value: string) => {
    setSigners((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Step 1 validation
  const step1Valid = title.trim().length > 0 && documentId.trim().length > 0;

  // Step 2 validation
  const step2Valid =
    signers.length > 0 && signers.every((s) => s.email.trim().includes('@'));

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      // Create envelope
      const envelopeRes = await signaturesApi.create({
        title,
        document_id: documentId,
        expires_at: expiresAt || undefined,
      });
      const envelopeId = envelopeRes.data.id;

      // Add steps (signers)
      for (let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        await signaturesApi.addStep(envelopeId, {
          signer_email: signer.email,
          signer_name: signer.name || undefined,
          action: signer.action,
        });
      }

      // Send envelope
      await signaturesApi.send(envelopeId);

      toast.success('Enveloppe créée et envoyée aux signataires');
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [title, documentId, expiresAt, signers, onSuccess]);

  return (
    <div className="space-y-4">
      <StepIndicator current={step} />

      {/* Step 1 — Document */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="env-title">Titre de l&apos;enveloppe *</Label>
            <Input
              id="env-title"
              placeholder="Ex: Contrat de prestation Mars 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-doc">ID du document (Drive) *</Label>
            <Input
              id="env-doc"
              placeholder="UUID du document dans le Drive"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Collez l&apos;UUID du fichier depuis le module Drive
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-expires">Date d&apos;expiration (optionnel)</Label>
            <Input
              id="env-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 2 — Signers */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Les signataires seront notifiés dans l&apos;ordre indiqué ci-dessous.
          </p>
          <div className="space-y-3">
            {signers.map((signer, idx) => (
              <div
                key={signer.id}
                className="rounded-lg border bg-muted/30 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    Signataire {idx + 1}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    onClick={() => removeSigner(signer.id)}
                    disabled={signers.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email *</Label>
                    <Input
                      type="email"
                      placeholder="signataire@exemple.com"
                      value={signer.email}
                      onChange={(e) => updateSigner(signer.id, 'email', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nom (optionnel)</Label>
                    <Input
                      placeholder="Prénom Nom"
                      value={signer.name}
                      onChange={(e) => updateSigner(signer.id, 'name', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Action requise</Label>
                  <Select
                    value={signer.action}
                    onValueChange={(v) => updateSigner(signer.id, 'action', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addSigner} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un signataire
          </Button>
        </div>
      )}

      {/* Step 3 — Confirm & Send */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="font-medium text-sm">Résumé de l&apos;enveloppe</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Titre :</span> {title}
              </p>
              <p>
                <span className="font-medium text-foreground">Document :</span>{' '}
                <span className="font-mono text-xs">{documentId}</span>
              </p>
              {expiresAt && (
                <p>
                  <span className="font-medium text-foreground">Expire le :</span>{' '}
                  {new Date(expiresAt).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
            <div className="pt-2 space-y-1">
              <p className="text-xs font-medium text-foreground">Signataires :</p>
              {signers.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs h-4">
                    {i + 1}
                  </Badge>
                  <span>{s.email}</span>
                  {s.name && <span>({s.name})</span>}
                  <Badge variant="secondary" className="text-xs h-4 ml-auto">
                    {ACTION_LABELS[s.action]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
            Les signataires recevront une notification par email pour signer le document.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2 border-t">
        <Button
          variant="outline"
          onClick={step === 1 ? onCancel : () => setStep((s) => s - 1)}
        >
          {step === 1 ? (
            'Annuler'
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour
            </>
          )}
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 1 ? !step1Valid : !step2Valid}
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Créer et envoyer
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
