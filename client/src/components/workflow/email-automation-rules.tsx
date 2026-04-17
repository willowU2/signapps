"use client";

// IDEA-127: Email automation rules — if sender X → move to folder Y, label Z, forward to W

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Zap, Mail } from "lucide-react";
import { toast } from "sonner";
import { rulesApi } from "@/lib/api-mail";

export type RuleConditionField = "from" | "to" | "subject" | "body";
export type RuleConditionOp =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with";
export type RuleActionType =
  | "move_folder"
  | "add_label"
  | "forward"
  | "mark_read"
  | "archive";

export interface RuleCondition {
  field: RuleConditionField;
  op: RuleConditionOp;
  value: string;
}

export interface RuleAction {
  type: RuleActionType;
  value?: string;
}

export interface EmailRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
}

// localStorage fallback removed — all persistence goes through rulesApi → backend

const CONDITION_FIELDS: { value: RuleConditionField; label: string }[] = [
  { value: "from", label: "Expéditeur" },
  { value: "to", label: "Destinataire" },
  { value: "subject", label: "Sujet" },
  { value: "body", label: "Corps" },
];

const CONDITION_OPS: { value: RuleConditionOp; label: string }[] = [
  { value: "contains", label: "contient" },
  { value: "equals", label: "est égal à" },
  { value: "starts_with", label: "commence par" },
  { value: "ends_with", label: "se termine par" },
];

const ACTION_TYPES: {
  value: RuleActionType;
  label: string;
  hasValue: boolean;
  placeholder?: string;
}[] = [
  {
    value: "move_folder",
    label: "Déplacer vers dossier",
    hasValue: true,
    placeholder: "Nom du dossier",
  },
  {
    value: "add_label",
    label: "Ajouter un label",
    hasValue: true,
    placeholder: "Nom du label",
  },
  {
    value: "forward",
    label: "Transférer à",
    hasValue: true,
    placeholder: "email@exemple.com",
  },
  { value: "mark_read", label: "Marquer comme lu", hasValue: false },
  { value: "archive", label: "Archiver", hasValue: false },
];

function newRule(): EmailRule {
  return {
    id: `rule_${Date.now()}`,
    name: "Nouvelle règle",
    enabled: true,
    conditions: [{ field: "from", op: "contains", value: "" }],
    actions: [{ type: "move_folder", value: "" }],
    createdAt: new Date().toISOString(),
  };
}

interface EmailRuleEditorProps {
  rule: EmailRule;
  onChange: (rule: EmailRule) => void;
  onDelete: () => void;
}

function EmailRuleEditor({ rule, onChange, onDelete }: EmailRuleEditorProps) {
  const update = (patch: Partial<EmailRule>) => onChange({ ...rule, ...patch });

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Input
            value={rule.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-7 text-sm font-semibold border-0 shadow-none px-0 focus-visible:ring-0 flex-1"
            placeholder="Nom de la règle…"
          />
          <Switch
            checked={rule.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
            className="flex-shrink-0"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
            onClick={onDelete}
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Conditions */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Si
          </Label>
          {rule.conditions.map((cond, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={cond.field}
                onValueChange={(v) => {
                  const cs = [...rule.conditions];
                  cs[i] = { ...cs[i], field: v as RuleConditionField };
                  update({ conditions: cs });
                }}
              >
                <SelectTrigger className="h-7 text-xs w-28 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_FIELDS.map((f) => (
                    <SelectItem
                      key={f.value}
                      value={f.value}
                      className="text-xs"
                    >
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={cond.op}
                onValueChange={(v) => {
                  const cs = [...rule.conditions];
                  cs[i] = { ...cs[i], op: v as RuleConditionOp };
                  update({ conditions: cs });
                }}
              >
                <SelectTrigger className="h-7 text-xs w-28 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPS.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-xs"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={cond.value}
                onChange={(e) => {
                  const cs = [...rule.conditions];
                  cs[i] = { ...cs[i], value: e.target.value };
                  update({ conditions: cs });
                }}
                className="h-7 text-xs flex-1"
                placeholder="Valeur…"
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Alors
          </Label>
          {rule.actions.map((action, i) => {
            const actionDef = ACTION_TYPES.find((a) => a.value === action.type);
            return (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={action.type}
                  onValueChange={(v) => {
                    const acts = [...rule.actions];
                    acts[i] = { type: v as RuleActionType, value: "" };
                    update({ actions: acts });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem
                        key={a.value}
                        value={a.value}
                        className="text-xs"
                      >
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {actionDef?.hasValue && (
                  <Input
                    value={action.value ?? ""}
                    onChange={(e) => {
                      const acts = [...rule.actions];
                      acts[i] = { ...acts[i], value: e.target.value };
                      update({ actions: acts });
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder={actionDef.placeholder}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Map a backend MailRule to the UI EmailRule shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function backendToUiRule(r: any): EmailRule {
  return {
    id: r.id,
    name: r.name ?? "Règle",
    enabled: r.enabled ?? true,
    conditions: Array.isArray(r.conditions) ? r.conditions : [],
    actions: Array.isArray(r.actions) ? r.actions : [],
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

export function EmailAutomationRules() {
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRulesFromApi = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rulesApi.list();
      setRules(data.map(backendToUiRule));
    } catch {
      toast.error("Impossible de charger les règles.");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRulesFromApi();
  }, [loadRulesFromApi]);

  const updateRule = async (id: string, updated: EmailRule) => {
    // Optimistic UI update
    setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    try {
      await rulesApi.update(id, {
        name: updated.name,
        enabled: updated.enabled,
        conditions: updated.conditions,
        actions: updated.actions,
      });
    } catch {
      toast.error("Impossible de mettre à jour la règle.");
      await loadRulesFromApi();
    }
  };

  const deleteRule = async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    try {
      await rulesApi.delete(id);
    } catch {
      toast.error("Impossible de supprimer la règle.");
      await loadRulesFromApi();
    }
  };

  const addRule = async () => {
    const draft = newRule();
    setRules((prev) => [...prev, draft]);
    try {
      const created = await rulesApi.create({
        name: draft.name,
        conditions: draft.conditions,
        actions: draft.actions,
        enabled: draft.enabled,
      });
      // Replace optimistic entry with server-assigned id
      setRules((prev) =>
        prev.map((r) => (r.id === draft.id ? backendToUiRule(created) : r)),
      );
    } catch {
      toast.error("Impossible de créer la règle.");
      setRules((prev) => prev.filter((r) => r.id !== draft.id));
    }
  };

  const handleSave = () => {
    toast.success("Règles sauvegardées");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">
              Règles d&apos;automatisation email
            </h2>
            <p className="text-xs text-muted-foreground">
              {rules.filter((r) => r.enabled).length} règle(s) active(s) sur{" "}
              {rules.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addRule}
            disabled={saving || loading}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-xl">
          <p className="text-sm">Chargement des règles…</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-xl">
          <Mail className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucune règle</p>
          <p className="text-xs mt-1">
            Créez votre première règle d&apos;automatisation
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={addRule}>
            <Plus className="h-4 w-4" />
            Créer une règle
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3 pr-2">
            {rules.map((rule) => (
              <EmailRuleEditor
                key={rule.id}
                rule={rule}
                onChange={(updated) => updateRule(rule.id, updated)}
                onDelete={() => deleteRule(rule.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
