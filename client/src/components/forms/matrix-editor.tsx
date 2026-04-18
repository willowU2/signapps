"use client";

/**
 * Editor panel for the "Matrice / Grille" (Matrix) field type.
 * Lets the creator define rows (questions) and columns (answer choices).
 * The respondent will see a grid of radio buttons — one per (row × column).
 */

import type { FormField } from "@/lib/api/forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronUp, ChevronDown, Grid3X3 } from "lucide-react";

interface MatrixEditorProps {
  field: FormField;
  onUpdate: (patch: Partial<FormField>) => void;
}

export function MatrixEditor({ field, onUpdate }: MatrixEditorProps) {
  const rows: string[] = field.settings?.rows || [];
  const columns: string[] = field.settings?.columns || [];

  const setRows = (next: string[]) =>
    onUpdate({ settings: { ...(field.settings || {}), rows: next } });
  const setColumns = (next: string[]) =>
    onUpdate({ settings: { ...(field.settings || {}), columns: next } });

  const move = (arr: string[], from: number, to: number) => {
    if (to < 0 || to >= arr.length) return arr;
    const next = [...arr];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  };

  return (
    <div className="space-y-4 mb-4 bg-muted/20 p-3 rounded-md border">
      <div className="flex items-center gap-1.5">
        <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Matrice de choix
        </Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Rows (questions) */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground">
            Lignes (questions) — {rows.length}
          </Label>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                className="h-8 text-xs bg-background flex-1"
                value={r}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = e.target.value;
                  setRows(next);
                }}
                placeholder={`Ligne ${i + 1}`}
              />
              <div className="flex rounded-md border bg-muted/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-6 rounded-none rounded-l-md"
                  disabled={i === 0}
                  onClick={() => setRows(move(rows, i, i - 1))}
                  aria-label="Monter"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-6 rounded-none border-l"
                  disabled={i === rows.length - 1}
                  onClick={() => setRows(move(rows, i, i + 1))}
                  aria-label="Descendre"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                aria-label="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs border-dashed h-7"
            onClick={() => setRows([...rows, `Ligne ${rows.length + 1}`])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter une ligne
          </Button>
        </div>

        {/* Columns (choices) */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground">
            Colonnes (choix) — {columns.length}
          </Label>
          {columns.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                className="h-8 text-xs bg-background flex-1"
                value={c}
                onChange={(e) => {
                  const next = [...columns];
                  next[i] = e.target.value;
                  setColumns(next);
                }}
                placeholder={`Colonne ${i + 1}`}
              />
              <div className="flex rounded-md border bg-muted/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-6 rounded-none rounded-l-md"
                  disabled={i === 0}
                  onClick={() => setColumns(move(columns, i, i - 1))}
                  aria-label="Monter"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-6 rounded-none border-l"
                  disabled={i === columns.length - 1}
                  onClick={() => setColumns(move(columns, i, i + 1))}
                  aria-label="Descendre"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                onClick={() =>
                  setColumns(columns.filter((_, idx) => idx !== i))
                }
                aria-label="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs border-dashed h-7"
            onClick={() =>
              setColumns([...columns, `Colonne ${columns.length + 1}`])
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Ajouter une colonne
          </Button>
        </div>
      </div>

      {/* Live mini-preview */}
      {rows.length > 0 && columns.length > 0 && (
        <div className="pt-2 border-t">
          <Label className="text-[10px] font-semibold text-muted-foreground mb-2 block">
            Aperçu ({rows.length} × {columns.length})
          </Label>
          <div className="overflow-x-auto bg-background rounded border p-2">
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="p-1 text-left"></th>
                  {columns.map((c, i) => (
                    <th key={i} className="p-1 text-center font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri} className="border-t">
                    <td className="p-1 text-left">{r}</td>
                    {columns.map((_, ci) => (
                      <td key={ci} className="p-1 text-center">
                        <input
                          type="radio"
                          disabled
                          className="h-3 w-3 opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(rows.length === 0 || columns.length === 0) && (
        <p className="text-[10px] text-muted-foreground italic text-center pt-2">
          Ajoute au moins une ligne et une colonne pour construire la grille.
        </p>
      )}
    </div>
  );
}
