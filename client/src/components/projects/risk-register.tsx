"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskLevel = 1 | 2 | 3 | 4 | 5;
type RiskStatus = "identified" | "mitigating" | "closed";

interface Risk {
  id: string;
  title: string;
  probability: RiskLevel; // 1-5
  impact: RiskLevel; // 1-5
  status: RiskStatus;
  owner: string;
  mitigation: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<RiskLevel, string> = {
  1: "Très faible",
  2: "Faible",
  3: "Moyen",
  4: "Élevé",
  5: "Critique",
};

const STATUS_STYLES: Record<RiskStatus, string> = {
  identified: "bg-red-100 text-red-800",
  mitigating: "bg-amber-100 text-amber-800",
  closed: "bg-green-100 text-green-800",
};

const STATUS_LABELS: Record<RiskStatus, string> = {
  identified: "Identifié",
  mitigating: "En atténuation",
  closed: "Clos",
};

const INITIAL_RISKS: Risk[] = [
  {
    id: "1",
    title: "Retard de livraison fournisseur",
    probability: 3,
    impact: 4,
    status: "identified",
    owner: "AL",
    mitigation: "Identifier fournisseurs alternatifs",
  },
  {
    id: "2",
    title: "Pénurie de ressources dev",
    probability: 2,
    impact: 5,
    status: "mitigating",
    owner: "JD",
    mitigation: "Recruter 2 devs supplémentaires",
  },
  {
    id: "3",
    title: "Changement de scope client",
    probability: 4,
    impact: 3,
    status: "identified",
    owner: "MR",
    mitigation: "Contrat figé avec clauses avenant",
  },
  {
    id: "4",
    title: "Faille sécurité API",
    probability: 2,
    impact: 5,
    status: "mitigating",
    owner: "AL",
    mitigation: "Audit sécurité planifié Q2",
  },
];

// ── Risk Matrix ────────────────────────────────────────────────────────────────

function getMatrixColor(score: number): string {
  if (score >= 16) return "bg-red-500 text-white";
  if (score >= 9) return "bg-orange-400 text-white";
  if (score >= 4) return "bg-yellow-300 text-foreground";
  return "bg-green-200 text-foreground";
}

function RiskMatrix({ risks }: { risks: Risk[] }) {
  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
        Matrice Probabilité × Impact
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="w-16 pb-1 text-left text-muted-foreground">P\I</th>
              {[1, 2, 3, 4, 5].map((i) => (
                <th
                  key={i}
                  className="w-12 text-center pb-1 text-muted-foreground"
                >
                  {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((p) => (
              <tr key={p}>
                <td className="text-muted-foreground pr-2">{p}</td>
                {[1, 2, 3, 4, 5].map((i) => {
                  const score = p * i;
                  const cellRisks = risks.filter(
                    (r) => r.probability === p && r.impact === i,
                  );
                  return (
                    <td
                      key={i}
                      className={cn(
                        "size-12 border text-center align-middle font-semibold relative",
                        getMatrixColor(score),
                      )}
                    >
                      {cellRisks.length > 0 && (
                        <span className="absolute top-0.5 right-0.5 size-4 bg-black/20 rounded-full flex items-center justify-center text-[10px]">
                          {cellRisks.length}
                        </span>
                      )}
                      <span className="text-[11px]">{score}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-green-200 inline-block" /> Faible
          (1-3)
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-yellow-300 inline-block" /> Moyen
          (4-8)
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-orange-400 inline-block" /> Élevé
          (9-15)
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-red-500 inline-block" /> Critique
          (16-25)
        </span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function RiskRegister() {
  const [risks, setRisks] = useState<Risk[]>(INITIAL_RISKS);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<Risk>>({
    probability: 3,
    impact: 3,
    status: "identified",
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...risks].sort(
        (a, b) => b.probability * b.impact - a.probability * a.impact,
      ),
    [risks],
  );

  const handleAdd = () => {
    if (!form.title?.trim()) return;
    const r: Risk = {
      id: crypto.randomUUID(),
      title: form.title,
      probability: form.probability ?? 3,
      impact: form.impact ?? 3,
      status: form.status ?? "identified",
      owner: form.owner ?? "",
      mitigation: form.mitigation ?? "",
    };
    setRisks((p) => [...p, r]);
    setForm({ probability: 3, impact: 3, status: "identified" });
    setAdding(false);
  };

  const handleUpdate = (id: string, key: keyof Risk, value: unknown) => {
    setRisks((p) => p.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle className="size-4" /> Registre des risques
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {risks.filter((r) => r.status !== "closed").length} actifs
          </Badge>
          <Button size="sm" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="size-4" /> Risque
          </Button>
        </div>
      </div>

      <RiskMatrix risks={risks} />

      {/* Risk list */}
      <div className="space-y-2">
        {sorted.map((r) => {
          const score = r.probability * r.impact;
          return (
            <div key={r.id} className="border rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div
                  className={cn(
                    "size-8 rounded font-bold text-xs flex items-center justify-center shrink-0",
                    getMatrixColor(score),
                  )}
                >
                  {score}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    P:{r.probability} × I:{r.impact} — {r.owner || "—"}
                  </p>
                </div>
                <Badge
                  className={cn("text-xs shrink-0", STATUS_STYLES[r.status])}
                >
                  {STATUS_LABELS[r.status]}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRisks((p) => p.filter((x) => x.id !== r.id));
                  }}
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>

              {expandedId === r.id && (
                <div className="border-t p-3 bg-muted/10 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Probabilité
                      </label>
                      <select
                        value={r.probability}
                        onChange={(e) =>
                          handleUpdate(
                            r.id,
                            "probability",
                            parseInt(e.target.value) as RiskLevel,
                          )
                        }
                        className="w-full h-7 rounded border text-xs px-1 bg-background"
                      >
                        {([1, 2, 3, 4, 5] as RiskLevel[]).map((v) => (
                          <option key={v} value={v}>
                            {v} - {LEVEL_LABELS[v]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Impact
                      </label>
                      <select
                        value={r.impact}
                        onChange={(e) =>
                          handleUpdate(
                            r.id,
                            "impact",
                            parseInt(e.target.value) as RiskLevel,
                          )
                        }
                        className="w-full h-7 rounded border text-xs px-1 bg-background"
                      >
                        {([1, 2, 3, 4, 5] as RiskLevel[]).map((v) => (
                          <option key={v} value={v}>
                            {v} - {LEVEL_LABELS[v]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Responsable
                      </label>
                      <Input
                        value={r.owner}
                        onChange={(e) =>
                          handleUpdate(r.id, "owner", e.target.value)
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Statut
                      </label>
                      <select
                        value={r.status}
                        onChange={(e) =>
                          handleUpdate(
                            r.id,
                            "status",
                            e.target.value as RiskStatus,
                          )
                        }
                        className="w-full h-7 rounded border text-xs px-1 bg-background"
                      >
                        {(
                          Object.entries(STATUS_LABELS) as [
                            RiskStatus,
                            string,
                          ][]
                        ).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Plan d'atténuation
                    </label>
                    <Input
                      value={r.mitigation}
                      onChange={(e) =>
                        handleUpdate(r.id, "mitigation", e.target.value)
                      }
                      placeholder="Mesures d'atténuation..."
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {adding && (
        <div className="border rounded-lg p-3 bg-muted/10 space-y-3">
          <p className="text-xs font-semibold">Nouveau risque</p>
          <Input
            placeholder="Titre du risque *"
            value={form.title ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Probabilité
              </label>
              <select
                value={form.probability}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    probability: parseInt(e.target.value) as RiskLevel,
                  }))
                }
                className="w-full h-8 rounded border text-xs px-1 bg-background"
              >
                {([1, 2, 3, 4, 5] as RiskLevel[]).map((v) => (
                  <option key={v} value={v}>
                    {v} - {LEVEL_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Impact</label>
              <select
                value={form.impact}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    impact: parseInt(e.target.value) as RiskLevel,
                  }))
                }
                className="w-full h-8 rounded border text-xs px-1 bg-background"
              >
                {([1, 2, 3, 4, 5] as RiskLevel[]).map((v) => (
                  <option key={v} value={v}>
                    {v} - {LEVEL_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            placeholder="Responsable"
            value={form.owner ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))}
          />
          <Input
            placeholder="Plan d'atténuation"
            value={form.mitigation ?? ""}
            onChange={(e) =>
              setForm((p) => ({ ...p, mitigation: e.target.value }))
            }
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleAdd}>
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
