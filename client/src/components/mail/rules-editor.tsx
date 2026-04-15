"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RuleCondition {
  field: "from" | "subject" | "body";
  operator: "contains" | "equals" | "starts_with";
  value: string;
}

type RuleAction =
  | { type: "move_to"; folder: string }
  | { type: "label"; tag: string }
  | { type: "forward"; email: string }
  | { type: "delete" }
  | { type: "mark_read" };

interface MailRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
}

const CONDITION_FIELDS = [
  { value: "from", label: "De" },
  { value: "subject", label: "Objet" },
  { value: "body", label: "Corps" },
];

const CONDITION_OPERATORS = [
  { value: "contains", label: "contient" },
  { value: "equals", label: "égal à" },
  { value: "starts_with", label: "commence par" },
];

const ACTION_TYPES = [
  { value: "move_to", label: "Déplacer vers" },
  { value: "label", label: "Étiqueter" },
  { value: "forward", label: "Transférer à" },
  { value: "mark_read", label: "Marquer lu" },
  { value: "delete", label: "Supprimer" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionLabel(action: RuleAction): string {
  switch (action.type) {
    case "move_to":
      return `Déplacer → ${action.folder}`;
    case "label":
      return `Étiquette: ${action.tag}`;
    case "forward":
      return `Transférer → ${action.email}`;
    case "mark_read":
      return "Marquer lu";
    case "delete":
      return "Supprimer";
  }
}

function emptyCondition(): RuleCondition {
  return { field: "from", operator: "contains", value: "" };
}

function emptyAction(): RuleAction {
  return { type: "move_to", folder: "Inbox" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionEditor({
  action,
  onChange,
}: {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Select
        value={action.type}
        onValueChange={(v) => {
          const type = v as RuleAction["type"];
          if (type === "move_to") onChange({ type, folder: "" });
          else if (type === "label") onChange({ type, tag: "" });
          else if (type === "forward") onChange({ type, email: "" });
          else onChange({ type } as RuleAction);
        }}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {action.type === "move_to" && (
        <Input
          placeholder="Dossier"
          value={action.folder}
          onChange={(e) => onChange({ ...action, folder: e.target.value })}
          className="w-[160px]"
        />
      )}
      {action.type === "label" && (
        <Input
          placeholder="Étiquette"
          value={action.tag}
          onChange={(e) => onChange({ ...action, tag: e.target.value })}
          className="w-[160px]"
        />
      )}
      {action.type === "forward" && (
        <Input
          type="email"
          placeholder="email@example.com"
          value={action.email}
          onChange={(e) => onChange({ ...action, email: e.target.value })}
          className="w-[200px]"
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RulesEditor() {
  const [rules, setRules] = useState<MailRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newConditions, setNewConditions] = useState<RuleCondition[]>([
    emptyCondition(),
  ]);
  const [newActions, setNewActions] = useState<RuleAction[]>([emptyAction()]);

  useEffect(() => {
    fetch("/api/mail/rules")
      .then((r) => r.json())
      .then(setRules)
      .catch(() => toast.error("Impossible de charger les règles"))
      .finally(() => setLoading(false));
  }, []);

  const toggleRule = async (rule: MailRule) => {
    try {
      const res = await fetch(`/api/mail/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error();
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
      );
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await fetch(`/api/mail/rules/${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Règle supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const saveRule = async () => {
    if (!newName.trim()) {
      toast.error("Nom requis");
      return;
    }
    try {
      const res = await fetch("/api/mail/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          conditions: newConditions,
          actions: newActions,
        }),
      });
      const created: MailRule = await res.json();
      setRules((prev) => [...prev, created]);
      setCreating(false);
      setNewName("");
      setNewConditions([emptyCondition()]);
      setNewActions([emptyAction()]);
      toast.success("Règle créée");
    } catch {
      toast.error("Erreur création règle");
    }
  };

  if (loading)
    return <div className="p-4 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Règles de messagerie</h3>
        <Button size="sm" onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle règle
        </Button>
      </div>

      {/* Existing rules */}
      {rules.map((rule) => (
        <Card key={rule.id}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{rule.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={rule.enabled ? "default" : "secondary"}>
                  {rule.enabled ? "Active" : "Inactive"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => toggleRule(rule)}
                >
                  {rule.enabled ? (
                    <ToggleRight className="h-4 w-4 text-primary" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteRule(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-4 text-xs text-muted-foreground space-y-1">
            <p>
              Conditions :{" "}
              {rule.conditions
                .map((c) => `${c.field} ${c.operator} "${c.value}"`)
                .join(", ")}
            </p>
            <p>Actions : {rule.actions.map(actionLabel).join(", ")}</p>
          </CardContent>
        </Card>
      ))}

      {rules.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucune règle configurée
        </p>
      )}

      {/* Create form */}
      {creating && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Nom de la règle</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ma règle"
              />
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Conditions</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setNewConditions((p) => [...p, emptyCondition()])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>
              {newConditions.map((cond, i) => (
                <div key={i} className="flex gap-2 flex-wrap">
                  <Select
                    value={cond.field}
                    onValueChange={(v) => {
                      setNewConditions((p) =>
                        p.map((c, idx) =>
                          idx === i
                            ? { ...c, field: v as RuleCondition["field"] }
                            : c,
                        ),
                      );
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
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
                    onValueChange={(v) => {
                      setNewConditions((p) =>
                        p.map((c, idx) =>
                          idx === i
                            ? { ...c, operator: v as RuleCondition["operator"] }
                            : c,
                        ),
                      );
                    }}
                  >
                    <SelectTrigger className="w-[130px]">
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
                    className="w-[160px]"
                    value={cond.value}
                    onChange={(e) => {
                      setNewConditions((p) =>
                        p.map((c, idx) =>
                          idx === i ? { ...c, value: e.target.value } : c,
                        ),
                      );
                    }}
                    placeholder="valeur"
                  />
                  {newConditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setNewConditions((p) => p.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Actions</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewActions((p) => [...p, emptyAction()])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>
              {newActions.map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ActionEditor
                    action={action}
                    onChange={(a) =>
                      setNewActions((p) =>
                        p.map((x, idx) => (idx === i ? a : x)),
                      )
                    }
                  />
                  {newActions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setNewActions((p) => p.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                  setNewConditions([emptyCondition()]);
                  setNewActions([emptyAction()]);
                }}
              >
                Annuler
              </Button>
              <Button onClick={saveRule}>
                <Save className="h-4 w-4 mr-1" /> Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
