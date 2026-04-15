"use client";

import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  UserPlus,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Save,
  RefreshCw,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "failed";

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  value: string; // configurable value for this step
}

interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  steps: OnboardingStep[];
  createdAt: string;
}

interface RunState {
  templateId: string;
  employeeName: string;
  stepStatuses: Record<string, StepStatus>;
  currentStep: string | null;
  started: boolean;
  finished: boolean;
}

// ─── Default Steps ────────────────────────────────────────────────────────────

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "ad-account",
    label: "Creer compte AD",
    description:
      "Creer le compte Active Directory avec les groupes et OU configures",
    value:
      "OU=Employees,DC=company,DC=local | Groupes: Domain Users, VPN-Users",
  },
  {
    id: "assign-hardware",
    label: "Assigner materiel",
    description: "Attribuer le materiel depuis le stock",
    value: "Laptop depuis stock | Categorie: Standard Employee Kit",
  },
  {
    id: "install-software",
    label: "Installer logiciels",
    description: "Deployer la liste de packages depuis le catalogue",
    value: "Office 365, Chrome, Slack, VPN Client",
  },
  {
    id: "configure-email",
    label: "Configurer messagerie",
    description: "Creer le compte email et configurer la boite aux lettres",
    value: "Format: prenom.nom@company.com | Quota: 25 GB",
  },
  {
    id: "apply-policies",
    label: "Appliquer politiques",
    description: "Assigner les GPO et politiques de securite",
    value: "GPO: StandardUser, PasswordPolicy, ScreenLock",
  },
  {
    id: "welcome-email",
    label: "Envoyer email bienvenue",
    description: "Envoyer l'email de bienvenue avec les informations d'acces",
    value: "Template: Nouveau Collaborateur",
  },
];

const LS_KEY = "it.onboarding.templates";

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadTemplates(): OnboardingTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTemplates(templates: OnboardingTemplate[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(templates));
}

// ─── Step Status UI ───────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "running":
      return (
        <RefreshCw className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
      );
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

const STEP_STATUS_BADGE: Record<StepStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-500/10 text-blue-600",
  done: "bg-emerald-500/10 text-emerald-600",
  failed: "bg-red-500/10 text-red-600",
};

const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pending: "En attente",
  running: "En cours",
  done: "Termine",
  failed: "Echec",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  usePageTitle("Onboarding IT");

  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<OnboardingTemplate | null>(
    null,
  );
  const [runState, setRunState] = useState<RunState | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // New template form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSteps, setFormSteps] = useState<OnboardingStep[]>(
    DEFAULT_STEPS.map((s) => ({ ...s })),
  );

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  // ── Template CRUD ─────────────────────────────────────────────────────────

  function openCreate() {
    setFormName("");
    setFormDesc("");
    setFormSteps(DEFAULT_STEPS.map((s) => ({ ...s })));
    setEditTemplate(null);
    setShowCreate(true);
  }

  function openEdit(t: OnboardingTemplate) {
    setFormName(t.name);
    setFormDesc(t.description);
    setFormSteps(t.steps.map((s) => ({ ...s })));
    setEditTemplate(t);
    setShowCreate(true);
  }

  function saveTemplate() {
    if (!formName.trim()) {
      toast.error("Nom requis");
      return;
    }
    const updated = editTemplate
      ? templates.map((t) =>
          t.id === editTemplate.id
            ? { ...t, name: formName, description: formDesc, steps: formSteps }
            : t,
        )
      : [
          ...templates,
          {
            id: `tpl-${Date.now()}`,
            name: formName,
            description: formDesc,
            steps: formSteps,
            createdAt: new Date().toISOString(),
          },
        ];
    setTemplates(updated);
    saveTemplates(updated);
    setShowCreate(false);
    toast.success(editTemplate ? "Template mis a jour" : "Template cree");
  }

  function deleteTemplate(id: string) {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    toast.success("Template supprime");
  }

  // ── Run execution ─────────────────────────────────────────────────────────

  function startRun(template: OnboardingTemplate) {
    if (!employeeName.trim()) {
      toast.error("Nom de l'employe requis");
      return;
    }
    const statuses: Record<string, StepStatus> = {};
    template.steps.forEach((s) => {
      statuses[s.id] = "pending";
    });
    setRunState({
      templateId: template.id,
      employeeName,
      stepStatuses: statuses,
      currentStep: template.steps[0]?.id ?? null,
      started: true,
      finished: false,
    });
    executeStep(template, template.steps[0]?.id ?? null, statuses);
  }

  const executeStep = useCallback(
    async (
      template: OnboardingTemplate,
      stepId: string | null,
      statuses: Record<string, StepStatus>,
    ) => {
      if (!stepId) return;

      const updated = { ...statuses, [stepId]: "running" as StepStatus };
      setRunState((prev) =>
        prev ? { ...prev, stepStatuses: updated, currentStep: stepId } : prev,
      );

      // Simulate async step execution (1-2 seconds)
      await new Promise((resolve) =>
        setTimeout(resolve, 1200 + Math.random() * 800),
      );

      const done = { ...updated, [stepId]: "done" as StepStatus };
      const currentIdx = template.steps.findIndex((s) => s.id === stepId);
      const nextStep = template.steps[currentIdx + 1];

      if (nextStep) {
        setRunState((prev) =>
          prev
            ? { ...prev, stepStatuses: done, currentStep: nextStep.id }
            : prev,
        );
        executeStep(template, nextStep.id, done);
      } else {
        setRunState((prev) =>
          prev
            ? { ...prev, stepStatuses: done, currentStep: null, finished: true }
            : prev,
        );
        toast.success(`Onboarding termine pour ${employeeName}`);
      }
    },
    [employeeName],
  );

  const activeTemplate = runState
    ? templates.find((t) => t.id === runState.templateId)
    : null;

  return (
    <AppLayout>
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <UserPlus className="h-6 w-6 text-primary" />
              Onboarding IT
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Templates de mise en service pour nouveaux employes
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau template
          </Button>
        </div>

        {/* Employee name + run trigger */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Employe a integrer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label htmlFor="emp-name">Nom complet</Label>
                <Input
                  id="emp-name"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground pb-2">
                Choisissez un template ci-dessous puis cliquez Execute
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Template list */}
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">
              Aucun template. Creez-en un pour commencer.
            </p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Creer un template
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(t)}
                      >
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => startRun(t)}
                        disabled={!!runState && !runState.finished}
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Executer
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteTemplate(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {t.steps.map((step, idx) => {
                      const status =
                        runState?.templateId === t.id
                          ? (runState.stepStatuses[step.id] ?? "pending")
                          : "pending";
                      const isExpanded = expandedStep === `${t.id}-${step.id}`;

                      return (
                        <div key={step.id} className="rounded-lg border">
                          <button
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                            onClick={() =>
                              setExpandedStep(
                                isExpanded ? null : `${t.id}-${step.id}`,
                              )
                            }
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {idx + 1}
                            </span>
                            {runState?.templateId === t.id ? (
                              <StepStatusIcon status={status} />
                            ) : null}
                            <span className="flex-1 text-sm font-medium">
                              {step.label}
                            </span>
                            {runState?.templateId === t.id && (
                              <Badge
                                className={`text-xs ${STEP_STATUS_BADGE[status]}`}
                              >
                                {STEP_STATUS_LABEL[status]}
                              </Badge>
                            )}
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
                              <p className="text-xs text-muted-foreground">
                                {step.description}
                              </p>
                              <p className="text-xs font-mono bg-background rounded px-2 py-1 border">
                                {step.value}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {runState?.templateId === t.id && runState.finished && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm text-emerald-700 font-medium">
                        Onboarding termine pour {runState.employeeName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 text-xs"
                        onClick={() => setRunState(null)}
                      >
                        Reinitialiser
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editTemplate
                  ? "Modifier le template"
                  : "Nouveau template d'onboarding"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom du template</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Standard Employee Onboarding"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Onboarding standard pour nouveaux employes..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>Etapes</Label>
                <div className="mt-2 space-y-3">
                  {formSteps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                          {idx + 1}
                        </span>
                        <Input
                          value={step.label}
                          onChange={(e) =>
                            setFormSteps((steps) =>
                              steps.map((s, i) =>
                                i === idx ? { ...s, label: e.target.value } : s,
                              ),
                            )
                          }
                          placeholder="Nom de l'etape"
                          className="h-7 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() =>
                            setFormSteps((steps) =>
                              steps.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        value={step.value}
                        onChange={(e) =>
                          setFormSteps((steps) =>
                            steps.map((s, i) =>
                              i === idx ? { ...s, value: e.target.value } : s,
                            ),
                          )
                        }
                        placeholder="Configuration / valeurs..."
                        className="text-xs font-mono"
                        rows={2}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      setFormSteps((steps) => [
                        ...steps,
                        {
                          id: `step-${Date.now()}`,
                          label: "",
                          description: "",
                          value: "",
                        },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Ajouter une etape
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button onClick={saveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
