"use client";

/**
 * Filter Builder Component
 *
 * UI for building complex filter conditions with AND/OR logic.
 */

import * as React from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  FilterGroup,
  FilterCondition,
  FilterOperator,
  FieldDefinition,
} from "./types";
import { FILTER_OPERATORS_BY_TYPE, OPERATOR_LABELS } from "./types";

// ============================================================================
// Types
// ============================================================================

interface FilterBuilderProps {
  fields: FieldDefinition[];
  value: FilterGroup;
  onChange: (value: FilterGroup) => void;
  maxDepth?: number;
  className?: string;
}

interface ConditionRowProps {
  condition: FilterCondition;
  fields: FieldDefinition[];
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
}

interface GroupRowProps {
  group: FilterGroup;
  fields: FieldDefinition[];
  depth: number;
  maxDepth: number;
  onChange: (group: FilterGroup) => void;
  onRemove: () => void;
}

// ============================================================================
// Condition Row
// ============================================================================

function ConditionRow({
  condition,
  fields,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const field = fields.find((f) => f.field === condition.field);
  const operators = field
    ? FILTER_OPERATORS_BY_TYPE[field.type]
    : FILTER_OPERATORS_BY_TYPE.string;

  const handleFieldChange = (fieldName: string) => {
    const newField = fields.find((f) => f.field === fieldName);
    if (!newField) return;

    const newOperators = FILTER_OPERATORS_BY_TYPE[newField.type];
    const newOperator = newOperators.includes(condition.operator)
      ? condition.operator
      : newOperators[0];

    onChange({
      ...condition,
      field: fieldName,
      operator: newOperator,
      valueType: newField.type,
      value: newField.type === "boolean" ? true : "",
    });
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    onChange({ ...condition, operator });
  };

  const handleValueChange = (value: unknown) => {
    onChange({ ...condition, value });
  };

  const needsValue = ![
    "is_empty",
    "is_not_empty",
    "is_true",
    "is_false",
    "this_week",
    "this_month",
    "this_year",
  ].includes(condition.operator);

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

      {/* Field Selector */}
      <Select value={condition.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Champ" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.field} value={f.field}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Selector */}
      <Select
        value={condition.operator}
        onValueChange={(v) => handleOperatorChange(v as FilterOperator)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Opérateur" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input */}
      {needsValue && (
        <>
          {field?.type === "select" && field.options ? (
            <Select
              value={String(condition.value)}
              onValueChange={handleValueChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Valeur" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field?.type === "number" ? (
            <Input
              type="number"
              value={String(condition.value)}
              onChange={(e) => handleValueChange(Number(e.target.value))}
              className="w-[120px]"
              placeholder="Valeur"
            />
          ) : field?.type === "date" || field?.type === "datetime" ? (
            <Input
              type={field.type === "datetime" ? "datetime-local" : "date"}
              value={String(condition.value)}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-[180px]"
            />
          ) : (
            <Input
              value={String(condition.value)}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-[160px]"
              placeholder="Valeur"
            />
          )}
        </>
      )}

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Group Row (Recursive)
// ============================================================================

function GroupRow({
  group,
  fields,
  depth,
  maxDepth,
  onChange,
  onRemove,
}: GroupRowProps) {
  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: crypto.randomUUID(),
      field: fields[0]?.field || "",
      operator: "equals",
      value: "",
      valueType: fields[0]?.type || "string",
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addGroup = () => {
    if (depth >= maxDepth) return;
    const newGroup: FilterGroup = {
      id: crypto.randomUUID(),
      logic: "and",
      conditions: [],
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const updateCondition = (
    index: number,
    updated: FilterCondition | FilterGroup,
  ) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onChange({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const toggleLogic = () => {
    onChange({
      ...group,
      logic: group.logic === "and" ? "or" : "and",
    });
  };

  const isGroup = (
    item: FilterCondition | FilterGroup,
  ): item is FilterGroup => {
    return "logic" in item;
  };

  return (
    <div
      className={cn(
        "space-y-2 p-3 rounded-lg border",
        depth === 0 ? "bg-background" : "bg-muted/30",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLogic}
            className="h-7 text-xs font-medium"
          >
            {group.logic === "and" ? "ET" : "OU"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {group.conditions.length} condition
            {group.conditions.length !== 1 ? "s" : ""}
          </span>
        </div>
        {depth > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        {group.conditions.map((item, index) => (
          <React.Fragment key={isGroup(item) ? item.id : item.id}>
            {index > 0 && (
              <div className="flex items-center justify-center py-1">
                <Badge variant="secondary" className="text-[10px]">
                  {group.logic === "and" ? "ET" : "OU"}
                </Badge>
              </div>
            )}
            {isGroup(item) ? (
              <GroupRow
                group={item}
                fields={fields}
                depth={depth + 1}
                maxDepth={maxDepth}
                onChange={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
              />
            ) : (
              <ConditionRow
                condition={item}
                fields={fields}
                onChange={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Add Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Condition
        </Button>
        {depth < maxDepth && (
          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Groupe
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Filter Builder Component
// ============================================================================

export function FilterBuilder({
  fields,
  value,
  onChange,
  maxDepth = 2,
  className,
}: FilterBuilderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <GroupRow
        group={value}
        fields={fields}
        depth={0}
        maxDepth={maxDepth}
        onChange={onChange}
        onRemove={() => {}}
      />
    </div>
  );
}

// ============================================================================
// Filter Summary Component
// ============================================================================

interface FilterSummaryProps {
  filters: FilterGroup;
  fields: FieldDefinition[];
  onClear?: () => void;
}

export function FilterSummary({
  filters,
  fields,
  onClear,
}: FilterSummaryProps) {
  const countConditions = (group: FilterGroup): number => {
    return group.conditions.reduce((count, item) => {
      if ("logic" in item) {
        return count + countConditions(item);
      }
      return count + 1;
    }, 0);
  };

  const count = countConditions(filters);

  if (count === 0) {
    return (
      <span className="text-sm text-muted-foreground">Aucun filtre actif</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">
        {count} filtre{count > 1 ? "s" : ""} actif{count > 1 ? "s" : ""}
      </Badge>
      {onClear && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={onClear}
        >
          Effacer
        </Button>
      )}
    </div>
  );
}
