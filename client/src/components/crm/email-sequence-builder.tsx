"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Mail,
  Plus,
  Trash2,
  Play,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SequenceStep {
  id: string;
  delayDays: number;
  subject: string;
  body: string;
  condition?: string;
}

interface EmailSequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  createdAt: string;
}

interface ActiveSequence {
  sequenceId: string;
  contactEmail: string;
  startedAt: string;
  currentStep: number;
  status: "active" | "completed" | "paused";
}

// ── Storage helpers ────────────────────────────────────────────────────────────

const SEQUENCES_KEY = "sequence_configs";
const ACTIVE_KEY = "sequence_active";

function loadSequences(): EmailSequence[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEQUENCES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSequences(data: EmailSequence[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEQUENCES_KEY, JSON.stringify(data));
}

function loadActive(): ActiveSequence[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveActive(data: ActiveSequence[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(data));
}

// ── Step Editor ───────────────────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: SequenceStep;
  index: number;
  onChange: (step: SequenceStep) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {step.subject || "Sans objet"}
          </p>
          <p className="text-xs text-muted-foreground">
            J+{step.delayDays}
            {step.condition && ` — Si: ${step.condition}`}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-destructive shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="size-3" />
        </Button>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-3 border-t">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Délai (jours)</Label>
              <Input
                type="number"
                min={0}
                value={step.delayDays}
                onChange={(e) =>
                  onChange({
                    ...step,
                    delayDays: parseInt(e.target.value) || 0,
                  })
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Condition (optionnel)</Label>
              <Input
                placeholder="ex: pas de réponse"
                value={step.condition ?? ""}
                onChange={(e) =>
                  onChange({ ...step, condition: e.target.value })
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objet de l&apos;email</Label>
            <Input
              placeholder="Objet..."
              value={step.subject}
              onChange={(e) => onChange({ ...step, subject: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corps de l&apos;email</Label>
            <Textarea
              placeholder="Bonjour {{prénom}},..."
              value={step.body}
              onChange={(e) => onChange({ ...step, body: e.target.value })}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Active Sequence Row ────────────────────────────────────────────────────────

function ActiveRow({
  active,
  sequences,
  onPause,
  onResume,
}: {
  active: ActiveSequence;
  sequences: EmailSequence[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const seq = sequences.find((s) => s.id === active.sequenceId);
  if (!seq) return null;

  const progress =
    seq.steps.length > 0 ? (active.currentStep / seq.steps.length) * 100 : 0;

  return (
    <div className="flex items-center gap-3 border rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{seq.name}</p>
        <p className="text-xs text-muted-foreground">
          {active.contactEmail} — Étape {active.currentStep}/{seq.steps.length}
        </p>
        <div className="w-full bg-muted rounded-full h-1 mt-1.5">
          <div
            className="bg-primary h-1 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <Badge
        variant={
          active.status === "completed"
            ? "default"
            : active.status === "paused"
              ? "secondary"
              : "outline"
        }
        className="shrink-0 text-xs"
      >
        {active.status === "completed"
          ? "Terminé"
          : active.status === "paused"
            ? "Pause"
            : "Actif"}
      </Badge>
      {active.status === "active" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs shrink-0"
          onClick={() => onPause(active.sequenceId + active.contactEmail)}
        >
          Pause
        </Button>
      )}
      {active.status === "paused" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs shrink-0"
          onClick={() => onResume(active.sequenceId + active.contactEmail)}
        >
          Reprendre
        </Button>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function EmailSequenceBuilder() {
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [activeSeqs, setActiveSeqs] = useState<ActiveSequence[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [launchEmail, setLaunchEmail] = useState("");
  const [launchTarget, setLaunchTarget] = useState("");

  useEffect(() => {
    setSequences(loadSequences());
    setActiveSeqs(loadActive());
  }, []);

  const addStep = () => {
    const step: SequenceStep = {
      id: crypto.randomUUID(),
      delayDays:
        steps.length === 0 ? 0 : (steps[steps.length - 1]?.delayDays ?? 0) + 3,
      subject: "",
      body: "",
    };
    setSteps((p) => [...p, step]);
  };

  const updateStep = (id: string, updated: SequenceStep) => {
    setSteps((p) => p.map((s) => (s.id === id ? updated : s)));
  };

  const removeStep = (id: string) => {
    setSteps((p) => p.filter((s) => s.id !== id));
  };

  const saveSequence = () => {
    if (!name.trim() || steps.length === 0) return;
    const seq: EmailSequence = {
      id: crypto.randomUUID(),
      name: name.trim(),
      steps,
      createdAt: new Date().toISOString(),
    };
    const updated = [...sequences, seq];
    saveSequences(updated);
    setSequences(updated);
    setName("");
    setSteps([]);
    setCreating(false);
    toast.success(
      `Séquence "${seq.name}" créée avec ${seq.steps.length} étapes.`,
    );
  };

  const deleteSequence = (id: string) => {
    const updated = sequences.filter((s) => s.id !== id);
    saveSequences(updated);
    setSequences(updated);
    toast.success("Séquence supprimée.");
  };

  const launchSequence = (seqId: string) => {
    if (!launchEmail.trim()) {
      toast.error("Saisissez l'email du contact.");
      return;
    }
    const active: ActiveSequence = {
      sequenceId: seqId,
      contactEmail: launchEmail.trim(),
      startedAt: new Date().toISOString(),
      currentStep: 1,
      status: "active",
    };
    const updated = [...activeSeqs, active];
    saveActive(updated);
    setActiveSeqs(updated);
    setLaunchEmail("");
    setLaunchTarget("");
    toast.success(`Séquence lancée pour ${active.contactEmail}.`);
  };

  const updateActiveStatus = (key: string, status: "active" | "paused") => {
    const updated = activeSeqs.map((a) =>
      a.sequenceId + a.contactEmail === key ? { ...a, status } : a,
    );
    saveActive(updated);
    setActiveSeqs(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="size-5 text-primary" />
          <h3 className="font-semibold">Séquences emails</h3>
          <Badge variant="outline">{sequences.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="gap-1">
          <Plus className="size-4" /> Nouvelle séquence
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Créer une séquence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Nom de la séquence</Label>
              <Input
                placeholder="Ex: Relance prospect froid"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Étapes ({steps.length})</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addStep}
                  className="gap-1 h-7"
                >
                  <Plus className="size-3" /> Étape
                </Button>
              </div>
              {steps.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                  Aucune étape — cliquez sur &quot;+ Étape&quot; pour commencer
                </p>
              )}
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    index={i}
                    onChange={(updated) => updateStep(step.id, updated)}
                    onRemove={() => removeStep(step.id)}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={saveSequence}
                disabled={!name.trim() || steps.length === 0}
              >
                Sauvegarder
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCreating(false)}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sequence list */}
      {sequences.length > 0 && (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <Card key={seq.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{seq.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {seq.steps.length} étape{seq.steps.length > 1 ? "s" : ""}{" "}
                      •{" "}
                      {seq.steps.length > 0
                        ? `Durée: ${seq.steps[seq.steps.length - 1].delayDays}j`
                        : ""}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive shrink-0"
                    onClick={() => deleteSequence(seq.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>

                {/* Steps summary */}
                <div className="flex gap-1 flex-wrap">
                  {seq.steps.map((step, i) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1"
                    >
                      <Clock className="size-3 text-muted-foreground" />
                      J+{step.delayDays}
                      {i < seq.steps.length - 1 && (
                        <span className="text-muted-foreground ml-1">→</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Launch */}
                {launchTarget === seq.id ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="email@contact.com"
                      value={launchEmail}
                      onChange={(e) => setLaunchEmail(e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => launchSequence(seq.id)}
                    >
                      <Play className="size-3" /> Lancer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLaunchTarget("")}
                    >
                      ×
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setLaunchTarget(seq.id)}
                  >
                    <Play className="size-3" /> Lancer la séquence
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sequences.length === 0 && !creating && (
        <div className="text-center py-10 text-muted-foreground">
          <Mail className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune séquence créée.</p>
          <p className="text-xs mt-1">
            Créez votre première campagne drip pour automatiser vos relances.
          </p>
        </div>
      )}

      {/* Active sequences */}
      {activeSeqs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <h4 className="font-medium text-sm">
              Séquences actives ({activeSeqs.length})
            </h4>
          </div>
          {activeSeqs.map((a) => (
            <ActiveRow
              key={a.sequenceId + a.contactEmail}
              active={a}
              sequences={sequences}
              onPause={(key) => updateActiveStatus(key, "paused")}
              onResume={(key) => updateActiveStatus(key, "active")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
