"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface VisibilitySelection {
  org_nodes: string[];
  groups: string[];
  roles: string[];
  users: string[];
}

interface Props {
  value: VisibilitySelection;
  onChange: (next: VisibilitySelection) => void;
}

/**
 * Reusable picker for org-aware visibility (org_nodes, groups, roles, users).
 *
 * MVP version: each list is a comma-separated input + a list of badges showing
 * what is selected. Click a badge to remove it, press Enter or "+" to add.
 * A future iteration adds search-as-you-type from /api/v1/org/... endpoints —
 * the API surface stays the same so callers do not change.
 */
export function VisibilityPicker({ value, onChange }: Props) {
  const update = (k: keyof VisibilitySelection, items: string[]) =>
    onChange({ ...value, [k]: items });

  return (
    <div className="space-y-4">
      <ListInput
        label="Filières / Départements (UUIDs des org_nodes)"
        items={value.org_nodes}
        onChange={(items) => update("org_nodes", items)}
        placeholder="d290f1ee-6c54-4b01-90e6-d701748f0851, ..."
      />
      <ListInput
        label="Groupes transverses (UUIDs)"
        items={value.groups}
        onChange={(items) => update("groups", items)}
        placeholder="UUID, UUID, ..."
      />
      <ListInput
        label="Rôles"
        items={value.roles}
        onChange={(items) => update("roles", items)}
        placeholder="admin, manager"
      />
      <ListInput
        label="Utilisateurs nominaux (UUIDs — override prioritaire)"
        items={value.users}
        onChange={(items) => update("users", items)}
        placeholder="UUID, UUID, ..."
      />
    </div>
  );
}

function ListInput({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");

  const add = () => {
    const additions = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (additions.length === 0) return;
    const merged = Array.from(new Set([...items, ...additions]));
    onChange(merged);
    setText("");
  };

  const remove = (item: string) => onChange(items.filter((i) => i !== item));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          +
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((i) => (
            <Badge
              key={i}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => remove(i)}
            >
              {i} ✕
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
