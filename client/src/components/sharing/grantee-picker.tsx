"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Search, User, Users, Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usersApi } from "@/lib/api/identity";
import { groupsApi } from "@/lib/api/identity";
import { orgApi } from "@/lib/api/org";
import type { SharingGranteeType } from "@/types/sharing";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GranteeOption {
  id: string;
  /** Display name shown in the list and in the trigger button. */
  label: string;
  /** Secondary info (email, description…). */
  sublabel?: string;
  type: SharingGranteeType;
}

export interface GranteePickerProps {
  granteeType: SharingGranteeType;
  /** Currently selected grantee id — null means nothing selected. */
  value: string | null;
  /** Called when the selection changes, with the id and human label. */
  onChange: (id: string | null, label: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ─── Icon helper ─────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: SharingGranteeType }) {
  const cls = "h-3.5 w-3.5 shrink-0 text-muted-foreground";
  switch (type) {
    case "user":
      return <User className={cls} />;
    case "group":
      return <Users className={cls} />;
    case "org_node":
      return <Building2 className={cls} />;
    default:
      return null;
  }
}

// ─── Data loaders ─────────────────────────────────────────────────────────────

async function loadUsers(): Promise<GranteeOption[]> {
  // Fetch up to 200 users for client-side filtering.
  // TODO: replace with a server-side search endpoint once available.
  const res = await usersApi.list(0, 200);
  const users = res.data?.users ?? [];
  return users.map((u) => ({
    id: u.id,
    label: u.display_name ?? u.username,
    sublabel: u.email,
    type: "user" as const,
  }));
}

async function loadGroups(): Promise<GranteeOption[]> {
  const res = await groupsApi.list();
  const groups = res.data ?? [];
  return groups.map((g) => ({
    id: g.id,
    label: g.name,
    sublabel: g.description,
    type: "group" as const,
  }));
}

async function loadOrgNodes(): Promise<GranteeOption[]> {
  // GET /workforce/org/tree returns the flat list of root org nodes.
  // We also fetch each node's descendants to get the full tree as a flat array.
  const res = await orgApi.trees.list();
  const nodes = res.data ?? [];
  return nodes.map((n) => ({
    id: n.id,
    label: n.name,
    sublabel: n.code ?? n.node_type,
    type: "org_node" as const,
  }));
}

// ─── GranteePicker component ─────────────────────────────────────────────────

export function GranteePicker({
  granteeType,
  value,
  onChange,
  disabled = false,
  placeholder,
}: GranteePickerProps) {
  // Hidden entirely when granteeType is "everyone"
  if (granteeType === "everyone") return null;

  return (
    <GranteePickerInner
      granteeType={granteeType}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

// Inner component — separated to avoid calling hooks conditionally
function GranteePickerInner({
  granteeType,
  value,
  onChange,
  disabled,
  placeholder,
}: Required<Omit<GranteePickerProps, "placeholder">> & {
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<GranteeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The human label for the currently selected value
  const selectedLabel = value
    ? (options.find((o) => o.id === value)?.label ?? value)
    : null;

  // Load options whenever the grantee type changes
  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      let data: GranteeOption[] = [];
      if (granteeType === "user") {
        data = await loadUsers();
      } else if (granteeType === "group") {
        data = await loadGroups();
      } else if (granteeType === "org_node") {
        data = await loadOrgNodes();
      }
      setOptions(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [granteeType]);

  useEffect(() => {
    loadOptions();
    // Reset selection when type changes
    onChange(null, "");
    setQuery("");
  }, [granteeType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Client-side filtering
  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.sublabel?.toLowerCase().includes(q) ?? false)
        );
      })
    : options;

  const defaultPlaceholder =
    granteeType === "user"
      ? "Rechercher un utilisateur…"
      : granteeType === "group"
        ? "Rechercher un groupe…"
        : "Rechercher un département…";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn(
            "h-8 flex-1 justify-start text-xs font-normal truncate",
            !selectedLabel && "text-muted-foreground",
          )}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 shrink-0" />
          ) : (
            <TypeIcon type={granteeType} />
          )}
          <span className="ml-1.5 truncate">
            {selectedLabel ?? placeholder ?? defaultPlaceholder}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-[280px]"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Search box */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder ?? defaultPlaceholder}
            className="h-7 border-0 p-0 text-xs shadow-none focus-visible:ring-0 bg-transparent"
          />
        </div>

        {/* Options list */}
        <div className="max-h-[220px] overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="px-3 py-4 text-xs text-center text-muted-foreground">
              Erreur de chargement.{" "}
              <button
                className="underline hover:text-foreground"
                onClick={() => loadOptions()}
              >
                Réessayer
              </button>
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-center text-muted-foreground">
              Aucun résultat
            </p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.id}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                  option.id === value && "bg-accent/50",
                )}
                onClick={() => {
                  onChange(option.id, option.label);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <TypeIcon type={option.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{option.label}</p>
                  {option.sublabel && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {option.sublabel}
                    </p>
                  )}
                </div>
                {option.id === value && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
