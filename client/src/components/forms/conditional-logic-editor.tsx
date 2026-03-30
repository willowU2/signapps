"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2, Plus } from "lucide-react"
import type { FormField } from "@/lib/api/forms"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Operator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty"

export type LogicalOperator = "and" | "or"

export type ConditionAction =
  | { type: "show" }
  | { type: "hide" }
  | { type: "skip_to_page"; page: number }

export interface SingleCondition {
  field_id: string
  operator: Operator
  value: string
}

export interface ConditionGroup {
  logical: LogicalOperator
  conditions: SingleCondition[]
  action: ConditionAction
}

// Legacy flat condition shape (backward compat)
interface LegacyCondition {
  field_id: string
  operator: "equals" | "not_equals" | "contains"
  value: string
}

/** Extended field type that may carry conditional logic data */
type ConditionalFormField = FormField & { show_if?: unknown }

interface Props {
  field: ConditionalFormField
  allFields: FormField[]
  totalPages?: number
  onChange: (group: ConditionGroup | undefined) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: "égal à",
  not_equals: "différent de",
  contains: "contient",
  greater_than: "supérieur à",
  less_than: "inférieur à",
  is_empty: "est vide",
  is_not_empty: "n'est pas vide",
}

/** Operators that don't need a value input */
const NO_VALUE_OPERATORS: Operator[] = ["is_empty", "is_not_empty"]

const ELIGIBLE_FIELD_TYPES = [
  "SingleChoice", "MultipleChoice", "Text", "Email",
  "Number", "LongText", "Rating", "Date",
]

function defaultCondition(): SingleCondition {
  return { field_id: "", operator: "equals", value: "" }
}

function defaultGroup(): ConditionGroup {
  return {
    logical: "and",
    conditions: [defaultCondition()],
    action: { type: "show" },
  }
}

/** Migrate a legacy flat condition into the new group format */
function migrateCondition(raw: unknown): ConditionGroup | undefined {
  if (!raw) return undefined
  const r = raw as LegacyCondition | ConditionGroup
  if ("conditions" in r) return r as ConditionGroup
  const legacy = r as LegacyCondition
  return {
    logical: "and",
    conditions: [{ ...legacy }],
    action: { type: "show" },
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionalLogicEditor({ field, allFields, totalPages = 1, onChange }: Props) {
  const raw: unknown = field.show_if
  const group: ConditionGroup | undefined = migrateCondition(raw)

  const eligible = allFields.filter(
    f => f.id !== field.id && ELIGIBLE_FIELD_TYPES.includes(f.field_type)
  )

  // ── Group-level helpers ──────────────────────────────────────────────────

  const updateGroup = (patch: Partial<ConditionGroup>) => {
    const base = group ?? defaultGroup()
    onChange({ ...base, ...patch })
  }

  const updateCondition = (idx: number, patch: Partial<SingleCondition>) => {
    const base = group ?? defaultGroup()
    const conditions = base.conditions.map((c, i) =>
      i === idx ? { ...c, ...patch } : c
    )
    onChange({ ...base, conditions })
  }

  const addCondition = () => {
    const base = group ?? defaultGroup()
    onChange({ ...base, conditions: [...base.conditions, defaultCondition()] })
  }

  const removeCondition = (idx: number) => {
    if (!group) return
    const conditions = group.conditions.filter((_, i) => i !== idx)
    if (conditions.length === 0) {
      onChange(undefined)
    } else {
      onChange({ ...group, conditions })
    }
  }

  const updateAction = (patch: Partial<ConditionAction> & { type?: string }) => {
    const base = group ?? defaultGroup()
    const current = base.action
    const merged = { ...current, ...patch } as ConditionAction
    onChange({ ...base, action: merged })
  }

  // ── Initialise from scratch ──────────────────────────────────────────────

  if (eligible.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        Aucun champ éligible pour une condition.
      </p>
    )

  const g = group ?? defaultGroup()

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Logique conditionnelle</Label>
        <div className="flex items-center gap-2">
          {/* Logical operator (AND / OR) */}
          {g.conditions.length > 1 && (
            <Select
              value={g.logical}
              onValueChange={v => updateGroup({ logical: v as LogicalOperator })}
            >
              <SelectTrigger className="h-6 text-xs w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">ET</SelectItem>
                <SelectItem value="or">OU</SelectItem>
              </SelectContent>
            </Select>
          )}
          {group && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onChange(undefined)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Condition rows */}
      {g.conditions.map((cond, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
          {/* Field selector */}
          <Select
            value={cond.field_id}
            onValueChange={v => updateCondition(idx, { field_id: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Champ" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator selector */}
          <Select
            value={cond.operator}
            onValueChange={v => updateCondition(idx, { operator: v as Operator })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                <SelectItem key={op} value={op}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value input (hidden for is_empty / is_not_empty) */}
          {NO_VALUE_OPERATORS.includes(cond.operator) ? (
            <div />
          ) : (
            <Input
              className="h-8 text-xs"
              value={cond.value}
              placeholder="Valeur"
              onChange={e => updateCondition(idx, { value: e.target.value })}
            />
          )}

          {/* Remove condition */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={g.conditions.length === 1 && !group}
            onClick={() => removeCondition(idx)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add condition row */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={addCondition}
      >
        <Plus className="h-3 w-3" />
        Ajouter une condition
      </Button>

      {/* Action */}
      <div className="space-y-1.5 border-t pt-2">
        <Label className="text-xs text-muted-foreground">Action</Label>
        <div className="flex items-center gap-2">
          <Select
            value={g.action.type}
            onValueChange={v => updateAction({ type: v as ConditionAction["type"] })}
          >
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Afficher ce champ</SelectItem>
              <SelectItem value="hide">Masquer ce champ</SelectItem>
              {totalPages > 1 && (
                <SelectItem value="skip_to_page">Aller à la page</SelectItem>
              )}
            </SelectContent>
          </Select>

          {g.action.type === "skip_to_page" && totalPages > 1 && (
            <Select
              value={String(g.action.page ?? 2)}
              onValueChange={v =>
                updateAction({ type: "skip_to_page", page: Number(v) })
              }
            >
              <SelectTrigger className="h-8 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p > 1)
                  .map(p => (
                    <SelectItem key={p} value={String(p)}>Page {p}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </div>
  )
}
