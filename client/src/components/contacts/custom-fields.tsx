"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Settings2, GripVertical } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "url"
  | "email"
  | "boolean";

export interface CustomFieldDef {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
}

export interface CustomFieldValue {
  fieldId: string;
  value: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  url: "URL",
  email: "Email",
  boolean: "Oui/Non",
};

const TYPE_COLORS: Record<FieldType, string> = {
  text: "bg-slate-100 text-slate-700",
  number: "bg-blue-100 text-blue-700",
  date: "bg-purple-100 text-purple-700",
  url: "bg-cyan-100 text-cyan-700",
  email: "bg-green-100 text-green-700",
  boolean: "bg-orange-100 text-orange-700",
};

const DEFAULT_FIELDS: CustomFieldDef[] = [
  {
    id: "f1",
    name: "Anniversaire",
    type: "date",
    required: false,
    placeholder: "JJ/MM/AAAA",
  },
  {
    id: "f2",
    name: "LinkedIn",
    type: "url",
    required: false,
    placeholder: "https://linkedin.com/in/...",
  },
  {
    id: "f3",
    name: "Chiffre d'affaires",
    type: "number",
    required: false,
    placeholder: "0",
  },
];

// ── Field Admin Panel ─────────────────────────────────────────────────────────

interface CustomFieldsAdminProps {
  fields: CustomFieldDef[];
  onChange: (fields: CustomFieldDef[]) => void;
}

export function CustomFieldsAdmin({
  fields,
  onChange,
}: CustomFieldsAdminProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newRequired, setNewRequired] = useState(false);
  const [newPlaceholder, setNewPlaceholder] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    const f: CustomFieldDef = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      type: newType,
      required: newRequired,
      placeholder: newPlaceholder || undefined,
    };
    onChange([...fields, f]);
    setNewName("");
    setNewType("text");
    setNewRequired(false);
    setNewPlaceholder("");
    setAdding(false);
    toast.success(`Champ "${f.name}" ajouté.`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="size-4" /> Champs personnalisés
        </h4>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1">
          <Plus className="size-4" /> Ajouter champ
        </Button>
      </div>

      <div className="space-y-2">
        {fields.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-2 border rounded-lg px-3 py-2"
          >
            <GripVertical className="size-4 text-muted-foreground cursor-grab" />
            <span className="flex-1 text-sm font-medium">{f.name}</span>
            <Badge className={`text-xs ${TYPE_COLORS[f.type]}`}>
              {TYPE_LABELS[f.type]}
            </Badge>
            {f.required && (
              <Badge variant="outline" className="text-xs">
                Requis
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(fields.filter((x) => x.id !== f.id))}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun champ personnalisé.
          </p>
        )}
      </div>

      {adding && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
          <p className="text-xs font-semibold">Nouveau champ</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Nom du champ *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as FieldType)}
              className="h-8 rounded-md border text-sm px-2 bg-background"
            >
              {(Object.entries(TYPE_LABELS) as [FieldType, string][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </div>
          <Input
            placeholder="Placeholder (optionnel)"
            value={newPlaceholder}
            onChange={(e) => setNewPlaceholder(e.target.value)}
            className="h-8 text-sm"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={newRequired}
              onChange={(e) => setNewRequired(e.target.checked)}
              className="rounded"
            />
            Champ requis
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleAdd}
              disabled={!newName.trim()}
            >
              Ajouter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setAdding(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Field Renderer (for contact form) ─────────────────────────────────────────

interface CustomFieldFormProps {
  fields: CustomFieldDef[];
  values: CustomFieldValue[];
  onChange: (values: CustomFieldValue[]) => void;
}

export function CustomFieldForm({
  fields,
  values,
  onChange,
}: CustomFieldFormProps) {
  const getValue = (fieldId: string) =>
    values.find((v) => v.fieldId === fieldId)?.value ?? "";

  const handleChange = (fieldId: string, value: string) => {
    const existing = values.find((v) => v.fieldId === fieldId);
    if (existing) {
      onChange(
        values.map((v) => (v.fieldId === fieldId ? { ...v, value } : v)),
      );
    } else {
      onChange([...values, { fieldId, value }]);
    }
  };

  if (fields.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.id} className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {f.name} {f.required && <span className="text-destructive">*</span>}
          </label>
          {f.type === "boolean" ? (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={getValue(f.id) === "true"}
                onChange={(e) =>
                  handleChange(f.id, e.target.checked ? "true" : "false")
                }
                className="rounded"
              />
              <span>{f.name}</span>
            </label>
          ) : (
            <Input
              type={
                f.type === "number"
                  ? "number"
                  : f.type === "date"
                    ? "date"
                    : f.type === "email"
                      ? "email"
                      : f.type === "url"
                        ? "url"
                        : "text"
              }
              placeholder={f.placeholder}
              value={getValue(f.id)}
              onChange={(e) => handleChange(f.id, e.target.value)}
              required={f.required}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Export default fields for initial state
export { DEFAULT_FIELDS };
