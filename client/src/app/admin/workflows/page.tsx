"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Zap,
  Plus,
  Trash2,
  Pencil,
  Play,
  Pause,
  ArrowRight,
  Mail,
  FileText,
  UserPlus,
  FolderOpen,
  Bell,
  CheckSquare,
  Clock,
  Filter,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkflowTrigger {
  type: string;
  label: string;
  icon: string;
}

interface WorkflowCondition {
  field: string;
  operator:
    | "contains"
    | "equals"
    | "starts_with"
    | "ends_with"
    | "is_type"
    | "greater_than";
  value: string;
}

interface WorkflowAction {
  type: string;
  label: string;
  config: Record<string, string>;
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TRIGGERS: WorkflowTrigger[] = [
  { type: "email_received", label: "Quand un email arrive", icon: "Mail" },
  {
    type: "document_created",
    label: "Quand un document est cr\u00e9\u00e9",
    icon: "FileText",
  },
  {
    type: "contact_added",
    label: "Quand un contact est ajout\u00e9",
    icon: "UserPlus",
  },
  {
    type: "file_uploaded",
    label: "Quand un fichier est upload\u00e9",
    icon: "FolderOpen",
  },
  {
    type: "task_completed",
    label: "Quand une t\u00e2che est termin\u00e9e",
    icon: "CheckSquare",
  },
  { type: "schedule", label: "Selon un horaire (cron)", icon: "Clock" },
];

const CONDITION_FIELDS = [
  { value: "subject", label: "Le sujet" },
  { value: "sender", label: "L'exp\u00e9diteur" },
  { value: "type", label: "Le type" },
  { value: "name", label: "Le nom" },
  { value: "size", label: "La taille" },
  { value: "label", label: "Le libell\u00e9" },
];

const CONDITION_OPERATORS = [
  { value: "contains", label: "contient" },
  { value: "equals", label: "\u00e9gal \u00e0" },
  { value: "starts_with", label: "commence par" },
  { value: "ends_with", label: "se termine par" },
  { value: "is_type", label: "est de type" },
  { value: "greater_than", label: "est sup\u00e9rieur \u00e0" },
];

const ACTION_TYPES = [
  {
    type: "move_to_folder",
    label: "D\u00e9placer vers un dossier",
    icon: "FolderOpen",
  },
  { type: "notify_user", label: "Notifier l'utilisateur", icon: "Bell" },
  {
    type: "create_task",
    label: "Cr\u00e9er une t\u00e2che",
    icon: "CheckSquare",
  },
  { type: "send_email", label: "Envoyer un email", icon: "Mail" },
  { type: "add_label", label: "Ajouter un libell\u00e9", icon: "Filter" },
  { type: "archive", label: "Archiver", icon: "FolderOpen" },
];

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "signapps-workflow-rules";

function loadRules(): WorkflowRule[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : getDefaultRules();
  } catch {
    return getDefaultRules();
  }
}

function saveRules(rules: WorkflowRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

function getDefaultRules(): WorkflowRule[] {
  return [
    {
      id: "1",
      name: "Emails urgents",
      description: "D\u00e9placer les emails urgents et notifier",
      trigger: {
        type: "email_received",
        label: "Quand un email arrive",
        icon: "Mail",
      },
      conditions: [{ field: "subject", operator: "contains", value: "urgent" }],
      actions: [
        {
          type: "move_to_folder",
          label: "D\u00e9placer vers un dossier",
          config: { folder: "Urgent" },
        },
        {
          type: "notify_user",
          label: "Notifier l'utilisateur",
          config: { message: "Email urgent re\u00e7u !" },
        },
      ],
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 12,
    },
    {
      id: "2",
      name: "Nouveaux PDF",
      description: "Classer automatiquement les documents PDF",
      trigger: {
        type: "file_uploaded",
        label: "Quand un fichier est upload\u00e9",
        icon: "FolderOpen",
      },
      conditions: [{ field: "type", operator: "is_type", value: "PDF" }],
      actions: [
        {
          type: "move_to_folder",
          label: "D\u00e9placer vers un dossier",
          config: { folder: "Documents PDF" },
        },
        {
          type: "add_label",
          label: "Ajouter un libell\u00e9",
          config: { label: "PDF" },
        },
      ],
      enabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 45,
    },
    {
      id: "3",
      name: "Nouveau contact CRM",
      description:
        "Cr\u00e9er une t\u00e2che de suivi pour les nouveaux contacts",
      trigger: {
        type: "contact_added",
        label: "Quand un contact est ajout\u00e9",
        icon: "UserPlus",
      },
      conditions: [],
      actions: [
        {
          type: "create_task",
          label: "Cr\u00e9er une t\u00e2che",
          config: { title: "Suivre le nouveau contact", priority: "haute" },
        },
        {
          type: "notify_user",
          label: "Notifier l'utilisateur",
          config: { message: "Nouveau contact ajout\u00e9 au CRM" },
        },
      ],
      enabled: false,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    },
  ];
}

// ── Icon Map ─────────────────────────────────────────────────────────────────

function TriggerIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    Mail: <Mail className={className} />,
    FileText: <FileText className={className} />,
    UserPlus: <UserPlus className={className} />,
    FolderOpen: <FolderOpen className={className} />,
    CheckSquare: <CheckSquare className={className} />,
    Clock: <Clock className={className} />,
    Bell: <Bell className={className} />,
    Filter: <Filter className={className} />,
  };
  return <>{icons[name] || <Zap className={className} />}</>;
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  usePageTitle("Workflows");
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTrigger, setFormTrigger] = useState<WorkflowTrigger>(TRIGGERS[0]);
  const [formConditions, setFormConditions] = useState<WorkflowCondition[]>([]);
  const [formActions, setFormActions] = useState<WorkflowAction[]>([]);

  useEffect(() => {
    setRules(loadRules());
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTrigger(TRIGGERS[0]);
    setFormConditions([]);
    setFormActions([]);
    setEditingRule(null);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (rule: WorkflowRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description);
    setFormTrigger(rule.trigger);
    setFormConditions([...rule.conditions]);
    setFormActions([...rule.actions]);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error("Le nom de la r\u00e8gle est requis");
      return;
    }
    if (formActions.length === 0) {
      toast.error("Ajoutez au moins une action");
      return;
    }

    const updatedRules = editingRule
      ? rules.map((r) =>
          r.id === editingRule.id
            ? {
                ...r,
                name: formName,
                description: formDescription,
                trigger: formTrigger,
                conditions: formConditions,
                actions: formActions,
              }
            : r,
        )
      : [
          ...rules,
          {
            id: crypto.randomUUID(),
            name: formName,
            description: formDescription,
            trigger: formTrigger,
            conditions: formConditions,
            actions: formActions,
            enabled: true,
            createdAt: new Date().toISOString(),
            triggerCount: 0,
          },
        ];

    setRules(updatedRules);
    saveRules(updatedRules);
    setIsDialogOpen(false);
    resetForm();
    toast.success(
      editingRule
        ? "R\u00e8gle mise \u00e0 jour"
        : "R\u00e8gle cr\u00e9\u00e9e",
    );
  };

  const toggleRule = (id: string) => {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    setRules(updated);
    saveRules(updated);
  };

  const deleteRule = () => {
    if (!deleteTarget) return;
    const updated = rules.filter((r) => r.id !== deleteTarget);
    setRules(updated);
    saveRules(updated);
    setDeleteTarget(null);
    toast.success("R\u00e8gle supprim\u00e9e");
  };

  const addCondition = () => {
    setFormConditions([
      ...formConditions,
      { field: "subject", operator: "contains", value: "" },
    ]);
  };

  const updateCondition = (
    index: number,
    updates: Partial<WorkflowCondition>,
  ) => {
    const updated = formConditions.map((c, i) =>
      i === index ? { ...c, ...updates } : c,
    );
    setFormConditions(updated);
  };

  const removeCondition = (index: number) => {
    setFormConditions(formConditions.filter((_, i) => i !== index));
  };

  const addAction = (actionType: (typeof ACTION_TYPES)[0]) => {
    setFormActions([
      ...formActions,
      { type: actionType.type, label: actionType.label, config: {} },
    ]);
  };

  const updateActionConfig = (index: number, key: string, value: string) => {
    const updated = formActions.map((a, i) =>
      i === index ? { ...a, config: { ...a.config, [key]: value } } : a,
    );
    setFormActions(updated);
  };

  const removeAction = (index: number) => {
    setFormActions(formActions.filter((_, i) => i !== index));
  };

  const activeCount = rules.filter((r) => r.enabled).length;
  const totalTriggers = rules.reduce((sum, r) => sum + r.triggerCount, 0);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <PageHeader
          title="Automatisations"
          description="Définissez des règles pour automatiser les actions répétitives"
          icon={<Zap className="h-5 w-5 text-primary" />}
          actions={
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle règle
            </Button>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                R\u00e8gles actives
              </CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">
                sur {rules.length} au total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ex\u00e9cutions totales
              </CardTitle>
              <Zap className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTriggers}</div>
              <p className="text-xs text-muted-foreground">
                depuis la cr\u00e9ation
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                D\u00e9clencheurs
              </CardTitle>
              <Filter className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{TRIGGERS.length}</div>
              <p className="text-xs text-muted-foreground">types disponibles</p>
            </CardContent>
          </Card>
        </div>

        {/* Rules List */}
        <div className="space-y-3">
          {rules.length === 0 ? (
            <Card className="p-12 text-center">
              <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Aucune r\u00e8gle d'automatisation
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Cr\u00e9ez votre premi\u00e8re r\u00e8gle pour commencer
              </p>
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Nouvelle r\u00e8gle
              </Button>
            </Card>
          ) : (
            rules.map((rule) => (
              <Card
                key={rule.id}
                className={`transition-all ${!rule.enabled ? "opacity-60" : ""}`}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-500/10 shrink-0">
                    <TriggerIcon
                      name={rule.trigger.icon}
                      className="h-5 w-5 text-amber-600"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{rule.name}</h3>
                      {rule.enabled ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-600 text-[10px]"
                        >
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactif
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {rule.description || rule.trigger.label}
                    </p>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TriggerIcon
                          name={rule.trigger.icon}
                          className="h-3 w-3"
                        />
                        {rule.trigger.label}
                      </span>
                      {rule.conditions.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Filter className="h-3 w-3" />
                          {rule.conditions.length} condition
                          {rule.conditions.length > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {rule.actions.length} action
                        {rule.actions.length > 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {rule.triggerCount} ex\u00e9cution
                        {rule.triggerCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleRule(rule.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(v) => {
          if (!v) {
            setIsDialogOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule
                ? "Modifier la r\u00e8gle"
                : "Nouvelle r\u00e8gle d'automatisation"}
            </DialogTitle>
            <DialogDescription>
              D\u00e9finissez le d\u00e9clencheur, les conditions et les
              actions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Name & Description */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nom de la r\u00e8gle</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Emails urgents"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ex: D\u00e9placer et notifier pour les emails urgents"
                />
              </div>
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> D\u00e9clencheur
              </Label>
              <Select
                value={formTrigger.type}
                onValueChange={(v) => {
                  const t = TRIGGERS.find((t) => t.type === v);
                  if (t) setFormTrigger(t);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-500" /> Conditions
                (optionnel)
              </Label>
              {formConditions.map((cond, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border"
                >
                  <Select
                    value={cond.field}
                    onValueChange={(v) => updateCondition(i, { field: v })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={cond.operator}
                    onValueChange={(v) =>
                      updateCondition(i, {
                        operator: v as WorkflowCondition["operator"],
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={cond.value}
                    onChange={(e) =>
                      updateCondition(i, { value: e.target.value })
                    }
                    placeholder="Valeur..."
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeCondition(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addCondition}
                className="gap-1"
              >
                <Plus className="h-3 w-3" /> Ajouter une condition
              </Button>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-green-500" /> Actions
              </Label>
              {formActions.map((action, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-muted/30 border space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <TriggerIcon
                        name={
                          ACTION_TYPES.find((a) => a.type === action.type)
                            ?.icon || "Zap"
                        }
                        className="h-4 w-4 text-green-600"
                      />
                      {action.label}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeAction(i)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  {/* Config fields based on action type */}
                  {action.type === "move_to_folder" && (
                    <Input
                      value={action.config.folder || ""}
                      onChange={(e) =>
                        updateActionConfig(i, "folder", e.target.value)
                      }
                      placeholder="Nom du dossier..."
                      className="h-8 text-sm"
                    />
                  )}
                  {action.type === "notify_user" && (
                    <Input
                      value={action.config.message || ""}
                      onChange={(e) =>
                        updateActionConfig(i, "message", e.target.value)
                      }
                      placeholder="Message de notification..."
                      className="h-8 text-sm"
                    />
                  )}
                  {action.type === "create_task" && (
                    <Input
                      value={action.config.title || ""}
                      onChange={(e) =>
                        updateActionConfig(i, "title", e.target.value)
                      }
                      placeholder="Titre de la t\u00e2che..."
                      className="h-8 text-sm"
                    />
                  )}
                  {action.type === "send_email" && (
                    <Input
                      value={action.config.to || ""}
                      onChange={(e) =>
                        updateActionConfig(i, "to", e.target.value)
                      }
                      placeholder="Adresse email destinataire..."
                      className="h-8 text-sm"
                    />
                  )}
                  {action.type === "add_label" && (
                    <Input
                      value={action.config.label || ""}
                      onChange={(e) =>
                        updateActionConfig(i, "label", e.target.value)
                      }
                      placeholder="Nom du libell\u00e9..."
                      className="h-8 text-sm"
                    />
                  )}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {ACTION_TYPES.map((at) => (
                  <Button
                    key={at.type}
                    variant="outline"
                    size="sm"
                    onClick={() => addAction(at)}
                    className="gap-1 text-xs"
                  >
                    <TriggerIcon name={at.icon} className="h-3 w-3" />
                    {at.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleSave}>
              {editingRule ? "Mettre \u00e0 jour" : "Cr\u00e9er la r\u00e8gle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette r\u00e8gle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irr\u00e9versible. La r\u00e8gle d'automatisation
              sera supprim\u00e9e.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
