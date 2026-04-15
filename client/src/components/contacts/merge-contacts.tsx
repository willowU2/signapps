"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitMerge, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface MergeableContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tags: string[];
}

interface MergeContactsProps {
  contacts: MergeableContact[];
  onMerge: (keepId: string, removeId: string, merged: MergeableContact) => void;
}

// Simple duplicate detection: same email or very similar name
function findDuplicatePairs(
  contacts: MergeableContact[],
): [MergeableContact, MergeableContact][] {
  const pairs: [MergeableContact, MergeableContact][] = [];
  const seen = new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const a = contacts[i],
        b = contacts[j];
      const key = [a.id, b.id].sort().join("-");
      if (seen.has(key)) continue;

      const sameEmail =
        a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
      const similarName =
        a.name.toLowerCase().replace(/\s+/g, "") ===
        b.name.toLowerCase().replace(/\s+/g, "");

      if (sameEmail || similarName) {
        pairs.push([a, b]);
        seen.add(key);
      }
    }
  }
  return pairs;
}

interface FieldRowProps {
  label: string;
  aVal: string;
  bVal: string;
  chosen: "a" | "b" | "both";
  onChoose: (v: "a" | "b" | "both") => void;
}

function FieldRow({ label, aVal, bVal, chosen, onChoose }: FieldRowProps) {
  const same = aVal === bVal;
  return (
    <div className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center text-sm py-1 border-b last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <button
        onClick={() => !same && onChoose("a")}
        className={cn(
          "text-left rounded px-2 py-1 text-xs truncate transition-colors",
          same
            ? "text-muted-foreground"
            : chosen === "a"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
        )}
      >
        {aVal || "—"}
      </button>
      <button
        onClick={() => !same && onChoose("b")}
        className={cn(
          "text-left rounded px-2 py-1 text-xs truncate transition-colors",
          same
            ? "text-muted-foreground"
            : chosen === "b"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
        )}
      >
        {bVal || "—"}
      </button>
    </div>
  );
}

export function MergeContacts({ contacts, onMerge }: MergeContactsProps) {
  const pairs = useMemo(
    () => findDuplicatePairs(contacts as MergeableContact[]),
    [contacts],
  );
  const [pairIndex, setPairIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, "a" | "b" | "both">>(
    {},
  );

  if (pairs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <GitMerge className="size-8 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Aucun doublon détecté</p>
        <p className="text-xs mt-1">Les contacts semblent tous uniques.</p>
      </div>
    );
  }

  const [a, b] = pairs[pairIndex] ?? [];
  if (!a || !b) return null;

  const fields: { key: keyof MergeableContact; label: string }[] = [
    { key: "name", label: "Nom" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Tél." },
    { key: "company", label: "Société" },
  ];

  const getChoice = (key: string) => choices[key] ?? "a";

  const handleMerge = () => {
    const merged: MergeableContact = {
      id: a.id,
      name: String(getChoice("name") === "a" ? a.name : b.name),
      email: String(getChoice("email") === "a" ? a.email : b.email),
      phone: getChoice("phone") === "a" ? a.phone : b.phone,
      company: getChoice("company") === "a" ? a.company : b.company,
      tags: [...new Set([...a.tags, ...b.tags])],
    };
    onMerge(a.id, b.id, merged);
    toast.success("Contacts fusionnés.");
    if (pairIndex >= pairs.length - 1) setPairIndex(0);
  };

  const handleSkip = () => {
    setPairIndex((p) => Math.min(p + 1, pairs.length - 1));
    setChoices({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2 text-sm">
          <GitMerge className="size-4" />
          Doublon {pairIndex + 1} / {pairs.length}
        </h4>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pairIndex === 0}
            onClick={() => {
              setPairIndex((p) => p - 1);
              setChoices({});
            }}
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={pairIndex === pairs.length - 1}
            onClick={() => {
              setPairIndex((p) => p + 1);
              setChoices({});
            }}
          >
            →
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-1">
        {/* Column headers */}
        <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-xs font-semibold text-muted-foreground pb-1 border-b">
          <span />
          <span className="flex items-center gap-1">
            Contact A{" "}
            <Badge variant="outline" className="text-xs">
              conserver
            </Badge>
          </span>
          <span>Contact B</span>
        </div>

        {fields.map(({ key, label }) => (
          <FieldRow
            key={key}
            label={label}
            aVal={String(a[key] ?? "")}
            bVal={String(b[key] ?? "")}
            chosen={getChoice(key) as "a" | "b" | "both"}
            onChoose={(v) => setChoices((p) => ({ ...p, [key]: v }))}
          />
        ))}

        {/* Tags */}
        <div className="grid grid-cols-[80px_1fr_1fr] gap-2 items-start text-sm py-1">
          <span className="text-xs font-medium text-muted-foreground pt-1">
            Tags
          </span>
          <div className="flex gap-1 flex-wrap">
            {a.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {b.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Cliquez sur les valeurs pour choisir. Les tags sont automatiquement
        fusionnés.
      </p>

      <div className="flex gap-2">
        <Button onClick={handleMerge} className="flex-1 gap-1">
          <Check className="size-4" /> Fusionner
        </Button>
        <Button variant="outline" onClick={handleSkip} className="flex-1 gap-1">
          <X className="size-4" /> Ignorer
        </Button>
      </div>
    </div>
  );
}
