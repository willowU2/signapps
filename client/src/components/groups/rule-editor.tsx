"use client";

/**
 * Visual editor for an `org_groups.rule_json` DSL.
 *
 * Renders a tree of blocks : root `and/or` + leaves (`skill`, `email_domain`,
 * `title_contains`, `node_path_startswith`). Emits the serialised JSON on
 * change so the parent can POST it verbatim.
 *
 * Keep it simple : one root operator picker + N leaf rows with a typed
 * value input. Advanced features (nested and/or, NOT) can be added later
 * via "add group" buttons that wrap rows into a sub-block.
 */
import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

type LeafKind =
  | "skill"
  | "email_domain"
  | "title_contains"
  | "node_path_startswith"
  | "site_id";

interface SkillLeaf {
  kind: "skill";
  slug: string;
  level_min?: number;
}

interface TextLeaf {
  kind: Exclude<LeafKind, "skill">;
  value: string;
}

export type RuleLeaf = SkillLeaf | TextLeaf;

export interface RuleEditorValue {
  operator: "and" | "or";
  leaves: RuleLeaf[];
}

export interface RuleEditorProps {
  value: RuleEditorValue;
  onChange: (value: RuleEditorValue) => void;
}

const LEAF_LABELS: Record<LeafKind, string> = {
  skill: "Compétence",
  email_domain: "Domaine email",
  title_contains: "Titre contient",
  node_path_startswith: "Sous-arbre (path)",
  site_id: "Site (UUID)",
};

function emptyLeaf(kind: LeafKind): RuleLeaf {
  if (kind === "skill") {
    return { kind: "skill", slug: "" };
  }
  return { kind, value: "" };
}

export function RuleEditor({ value, onChange }: RuleEditorProps) {
  const setLeaf = useCallback(
    (idx: number, next: RuleLeaf) => {
      const leaves = [...value.leaves];
      leaves[idx] = next;
      onChange({ ...value, leaves });
    },
    [value, onChange],
  );

  const removeLeaf = useCallback(
    (idx: number) => {
      const leaves = value.leaves.filter((_, i) => i !== idx);
      onChange({ ...value, leaves });
    },
    [value, onChange],
  );

  const addLeaf = useCallback(
    (kind: LeafKind) => {
      onChange({ ...value, leaves: [...value.leaves, emptyLeaf(kind)] });
    },
    [value, onChange],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Règle : la personne matche
        </span>
        <Select
          value={value.operator}
          onValueChange={(op) =>
            onChange({ ...value, operator: op as "and" | "or" })
          }
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">TOUTES</SelectItem>
            <SelectItem value="or">AU MOINS UNE</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">des conditions :</span>
      </div>

      <div className="space-y-2">
        {value.leaves.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            Aucune condition. Ajoute-en une via le menu ci-dessous.
          </p>
        ) : (
          value.leaves.map((leaf, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-md border bg-muted/30 p-2"
            >
              <Select
                value={leaf.kind}
                onValueChange={(newKind) => {
                  setLeaf(idx, emptyLeaf(newKind as LeafKind));
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAF_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LeafInput leaf={leaf} onChange={(l) => setLeaf(idx, l)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLeaf(idx)}
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addLeaf("skill")}
        >
          <Plus className="h-3 w-3 mr-1" />
          Compétence
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addLeaf("email_domain")}
        >
          <Plus className="h-3 w-3 mr-1" />
          Domaine email
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addLeaf("title_contains")}
        >
          <Plus className="h-3 w-3 mr-1" />
          Titre
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addLeaf("node_path_startswith")}
        >
          <Plus className="h-3 w-3 mr-1" />
          Sous-arbre
        </Button>
      </div>
    </div>
  );
}

function LeafInput({
  leaf,
  onChange,
}: {
  leaf: RuleLeaf;
  onChange: (leaf: RuleLeaf) => void;
}) {
  if (leaf.kind === "skill") {
    return (
      <>
        <Input
          value={leaf.slug}
          onChange={(e) => onChange({ ...leaf, slug: e.target.value })}
          placeholder="slug (ex: python)"
          className="flex-1"
        />
        <Input
          type="number"
          min={1}
          max={5}
          value={leaf.level_min ?? ""}
          onChange={(e) =>
            onChange({
              ...leaf,
              level_min: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="min 1-5"
          className="w-28"
        />
      </>
    );
  }
  const placeholders: Record<string, string> = {
    email_domain: "nexus.corp",
    title_contains: "Lead",
    node_path_startswith: "nexus_industries.engineering",
    site_id: "<uuid>",
  };
  return (
    <Input
      value={leaf.value}
      onChange={(e) => onChange({ ...leaf, value: e.target.value })}
      placeholder={placeholders[leaf.kind] ?? ""}
      className="flex-1"
    />
  );
}

/**
 * Serialise an editor value into the backend JSON DSL.
 */
export function serializeRule(value: RuleEditorValue): Record<string, unknown> {
  if (value.leaves.length === 0) {
    return {};
  }
  const toObject = (leaf: RuleLeaf): Record<string, unknown> => {
    if (leaf.kind === "skill") {
      const payload: Record<string, unknown> = { slug: leaf.slug };
      if (typeof leaf.level_min === "number") {
        payload.level_min = leaf.level_min;
      }
      return { skill: payload };
    }
    return { [leaf.kind]: leaf.value };
  };
  if (value.leaves.length === 1) {
    return toObject(value.leaves[0]);
  }
  return { [value.operator]: value.leaves.map(toObject) };
}

/**
 * Parse a stored rule JSON back into an editor value. Unknown / nested
 * rules collapse to an empty editor so the user can rebuild from scratch.
 */
export function deserializeRule(
  rule: Record<string, unknown> | null | undefined,
): RuleEditorValue {
  if (!rule || Object.keys(rule).length === 0) {
    return { operator: "and", leaves: [] };
  }
  const keys = Object.keys(rule);
  if (keys.length === 1 && (keys[0] === "and" || keys[0] === "or")) {
    const op = keys[0] as "and" | "or";
    const items = (rule[op] as unknown[]) ?? [];
    const leaves: RuleLeaf[] = [];
    for (const item of items) {
      if (typeof item === "object" && item !== null) {
        const leaf = objectToLeaf(item as Record<string, unknown>);
        if (leaf) leaves.push(leaf);
      }
    }
    return { operator: op, leaves };
  }
  const leaf = objectToLeaf(rule);
  return { operator: "and", leaves: leaf ? [leaf] : [] };
}

function objectToLeaf(obj: Record<string, unknown>): RuleLeaf | null {
  const keys = Object.keys(obj);
  if (keys.length !== 1) return null;
  const key = keys[0] as LeafKind;
  const val = obj[key];
  if (key === "skill") {
    if (typeof val !== "object" || val === null) return null;
    const v = val as Record<string, unknown>;
    return {
      kind: "skill",
      slug: typeof v.slug === "string" ? v.slug : "",
      level_min: typeof v.level_min === "number" ? v.level_min : undefined,
    };
  }
  if (
    key === "email_domain" ||
    key === "title_contains" ||
    key === "node_path_startswith" ||
    key === "site_id"
  ) {
    return { kind: key, value: typeof val === "string" ? val : "" };
  }
  return null;
}
