"use client";

/**
 * RACI matrix tab — visible on focus nodes (`attributes.axis_type === "project"`).
 *
 * Grille Personne x Rôle (R / A / C / I / none). Un clic sur un radio
 * toggle le rôle ; le handler applique immédiatement via `bulkSet`.
 * La contrainte "un seul accountable par projet" est enforced par le
 * backend ; on intercepte le `409` pour afficher un toast.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { orgApi } from "@/lib/api/org";
import type { OrgRaci, OrgRaciRole } from "@/lib/api/org";
import type { Person } from "@/types/org";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Download, Users } from "lucide-react";
import { personFullName } from "./avatar-helpers";

const ROLES: { key: OrgRaciRole; label: string; color: string }[] = [
  {
    key: "responsible",
    label: "R",
    color: "bg-blue-500 text-white",
  },
  {
    key: "accountable",
    label: "A",
    color: "bg-red-500 text-white",
  },
  {
    key: "consulted",
    label: "C",
    color: "bg-amber-500 text-white",
  },
  {
    key: "informed",
    label: "I",
    color: "bg-slate-500 text-white",
  },
];

export interface RaciMatrixTabProps {
  projectId: string;
  projectName: string;
  persons: Person[];
}

export function RaciMatrixTab({
  projectId,
  projectName,
  persons,
}: RaciMatrixTabProps) {
  const [rows, setRows] = useState<OrgRaci[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.raci.list(projectId);
      setRows(res.data ?? []);
    } catch (e) {
      console.error("raci list failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Index by (person_id, role).
  const rolesByPerson = useMemo(() => {
    const map: Record<string, Set<OrgRaciRole>> = {};
    for (const r of rows) {
      if (!map[r.person_id]) map[r.person_id] = new Set();
      map[r.person_id].add(r.role);
    }
    return map;
  }, [rows]);

  const filteredPersons = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return persons;
    return persons.filter((p) =>
      personFullName(p).toLowerCase().includes(needle),
    );
  }, [persons, search]);

  const toggleRole = async (personId: string, role: OrgRaciRole) => {
    const current = rolesByPerson[personId] ?? new Set<OrgRaciRole>();
    const next = new Set(current);
    if (next.has(role)) {
      next.delete(role);
    } else {
      next.add(role);
    }
    setSaving(personId);
    try {
      await orgApi.raci.bulkSet([
        {
          project_id: projectId,
          person_id: personId,
          roles: Array.from(next),
        },
      ]);
      await load();
    } catch (e) {
      const msg = extractError(e);
      if (msg.toLowerCase().includes("accountable")) {
        toast.error("Un seul A par projet");
      } else {
        toast.error(`Erreur: ${msg}`);
      }
    } finally {
      setSaving(null);
    }
  };

  const exportCsv = () => {
    const lines = ["Nom,Email,Rôles"];
    for (const p of persons) {
      const rs = Array.from(rolesByPerson[p.id] ?? [])
        .map((r) => r.charAt(0).toUpperCase())
        .sort()
        .join("");
      if (!rs) continue;
      lines.push(
        [personFullName(p), p.email ?? "", rs]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raci_${projectName.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">RACI — {projectName}</h3>
          <Badge variant="outline" className="text-[10px]">
            {rows.length} assignations
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filtrer par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-40 text-xs"
          />
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={exportCsv}
            data-testid="raci-export-csv"
          >
            <Download className="h-3 w-3 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Personne</th>
                {ROLES.map((r) => (
                  <th
                    key={r.key}
                    className="px-2 py-2 text-center font-medium"
                    title={r.key}
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPersons.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-muted-foreground"
                  >
                    Aucune personne trouvée
                  </td>
                </tr>
              )}
              {filteredPersons.map((p) => {
                const current = rolesByPerson[p.id] ?? new Set<OrgRaciRole>();
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-t border-border",
                      saving === p.id && "opacity-60",
                    )}
                    data-testid={`raci-row-${p.id}`}
                  >
                    <td className="px-3 py-1.5 font-medium">
                      {personFullName(p)}
                      {p.email && (
                        <span className="text-muted-foreground ml-1">
                          · {p.email}
                        </span>
                      )}
                    </td>
                    {ROLES.map((r) => {
                      const active = current.has(r.key);
                      return (
                        <td key={r.key} className="text-center">
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-semibold mx-auto my-0.5",
                              active
                                ? r.color
                                : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                            )}
                            onClick={() => toggleRole(p.id, r.key)}
                            disabled={saving === p.id}
                            data-testid={`raci-cell-${p.id}-${r.key}`}
                            aria-label={`${r.key} ${personFullName(p)}`}
                          >
                            {r.label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function extractError(e: unknown): string {
  if (!e) return "unknown";
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const err = e as {
      response?: { data?: { detail?: string } };
      message?: string;
    };
    return err.response?.data?.detail ?? err.message ?? "unknown";
  }
  return "unknown";
}
