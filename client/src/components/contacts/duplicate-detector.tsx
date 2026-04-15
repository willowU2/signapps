"use client";

// CT2: Duplicate detection and merge — full-featured implementation
// Replaces the minimal stub that existed before

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { contactsApi, type Contact } from "@/lib/api/contacts";
import { toast } from "sonner";
import { Copy, Merge, Loader2, Search, CheckCircle } from "lucide-react";

// ── Levenshtein ───────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[la][lb];
}

function fullName(c: Contact) {
  return `${c.first_name} ${c.last_name}`.trim().toLowerCase();
}

// ── Duplicate grouping ────────────────────────────────────────────────────────

type DuplicateGroup = Contact[];

function detectDuplicates(contacts: Contact[]): DuplicateGroup[] {
  const visited = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (let i = 0; i < contacts.length; i++) {
    if (visited.has(contacts[i].id)) continue;
    const group: Contact[] = [contacts[i]];

    for (let j = i + 1; j < contacts.length; j++) {
      if (visited.has(contacts[j].id)) continue;

      const a = contacts[i];
      const b = contacts[j];

      // Same email (case-insensitive)
      const emailMatch =
        a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();

      // Similar names (Levenshtein < 3)
      const nameA = fullName(a);
      const nameB = fullName(b);
      const nameSimilar =
        nameA.length > 0 && nameB.length > 0 && levenshtein(nameA, nameB) < 3;

      if (emailMatch || nameSimilar) {
        group.push(contacts[j]);
        visited.add(contacts[j].id);
      }
    }

    if (group.length > 1) {
      visited.add(contacts[i].id);
      groups.push(group);
    }
  }

  return groups;
}

// ── Best-value picker ─────────────────────────────────────────────────────────

function bestValue(contacts: Contact[], key: keyof Contact): string {
  for (const c of contacts) {
    const v = c[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function buildMerged(group: Contact[]): Partial<Contact> {
  return {
    first_name: bestValue(group, "first_name"),
    last_name: bestValue(group, "last_name"),
    email: bestValue(group, "email"),
    phone: bestValue(group, "phone"),
    organization: bestValue(group, "organization"),
    job_title: bestValue(group, "job_title"),
  };
}

// ── Merge dialog ──────────────────────────────────────────────────────────────

const FIELD_LABELS: { key: keyof Contact; label: string }[] = [
  { key: "first_name", label: "Prénom" },
  { key: "last_name", label: "Nom" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "organization", label: "Entreprise" },
  { key: "job_title", label: "Poste" },
];

interface MergeDialogProps {
  group: DuplicateGroup;
  open: boolean;
  onClose: () => void;
  onMerged: (merged: Contact, deletedIds: string[]) => void;
}

function MergeDialog({ group, open, onClose, onMerged }: MergeDialogProps) {
  const [merging, setMerging] = useState(false);
  const merged = buildMerged(group);
  const primaryId = group[0].id;

  const handleMerge = async () => {
    setMerging(true);
    try {
      // Update primary contact with merged data
      const res = await contactsApi.update(primaryId, merged);
      const updated = res.data;

      // Delete all others
      const idsToDelete = group.slice(1).map((c) => c.id);
      await Promise.all(idsToDelete.map((id) => contactsApi.delete(id)));

      onMerged(updated, idsToDelete);
      toast.success("Contacts fusionnés avec succès.");
    } catch {
      toast.error("Erreur lors de la fusion.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Fusionner {group.length} contacts
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-24">
                  Champ
                </th>
                {group.map((c, i) => (
                  <th key={c.id} className="text-left py-2 px-2 font-medium">
                    {i === 0 ? (
                      <Badge variant="default" className="text-xs">
                        Principal
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Doublon {i}
                      </Badge>
                    )}
                  </th>
                ))}
                <th className="text-left py-2 pl-4 font-medium text-green-600">
                  Résultat
                </th>
              </tr>
            </thead>
            <tbody>
              {FIELD_LABELS.map(({ key, label }) => (
                <tr key={key} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                  {group.map((c) => (
                    <td key={c.id} className="py-2 px-2 text-xs">
                      {(c[key] as string) || (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-2 pl-4 font-medium text-green-700 dark:text-green-400 text-xs">
                    {(merged[key] as string) || (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          Le contact principal sera conservé et mis à jour. Les{" "}
          {group.length - 1} doublon{group.length - 1 > 1 ? "s" : ""} seront
          supprimé{group.length - 1 > 1 ? "s" : ""}.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={merging}>
            Annuler
          </Button>
          <Button onClick={handleMerge} disabled={merging} className="gap-2">
            {merging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Merge className="h-4 w-4" />
            )}
            Fusionner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DuplicateDetectorProps {
  onContactsChanged?: () => void;
}

export function DuplicateDetector({
  onContactsChanged,
}: DuplicateDetectorProps) {
  const [scanning, setScanning] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(
    null,
  );
  const [mergedIds, setMergedIds] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    setScanned(false);
    setGroups([]);
    setMergedIds(new Set());
    try {
      const res = await contactsApi.list();
      const contacts: Contact[] = res.data ?? [];
      const found = detectDuplicates(contacts);
      setGroups(found);
      setScanned(true);
      if (found.length === 0) {
        toast.success("Aucun doublon détecté.");
      } else {
        toast.info(
          `${found.length} groupe${found.length > 1 ? "s" : ""} de doublons trouvé${found.length > 1 ? "s" : ""}.`,
        );
      }
    } catch {
      toast.error("Erreur lors du scan.");
    } finally {
      setScanning(false);
    }
  };

  const handleMerged = (merged: Contact, deletedIds: string[]) => {
    setMergedIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.add(id));
      next.add(merged.id);
      return next;
    });
    setGroups((prev) => prev.filter((g) => g[0].id !== merged.id));
    setSelectedGroup(null);
    onContactsChanged?.();
  };

  const pendingGroups = groups.filter((g) => !mergedIds.has(g[0].id));

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleScan}
        disabled={scanning}
        className="gap-2"
      >
        {scanning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        {scanning ? "Scan en cours…" : "Détecter les doublons"}
      </Button>

      {scanned && pendingGroups.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          Aucun doublon détecté
        </div>
      )}

      {pendingGroups.length > 0 && (
        <ScrollArea className="max-h-80">
          <div className="space-y-2 pr-2">
            {pendingGroups.map((group, idx) => (
              <Card key={idx} className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Copy className="h-4 w-4 text-yellow-500" />
                    Groupe {idx + 1} — {group.length} contacts similaires
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  <div className="space-y-1">
                    {group.map((c, i) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        {i === 0 && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Principal
                          </Badge>
                        )}
                        <span className="font-medium">
                          {c.first_name} {c.last_name}
                        </span>
                        {c.email && (
                          <span className="text-muted-foreground text-xs">
                            {c.email}
                          </span>
                        )}
                        {c.organization && (
                          <span className="text-muted-foreground text-xs">
                            · {c.organization}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 h-7 text-xs mt-1"
                    onClick={() => setSelectedGroup(group)}
                  >
                    <Merge className="h-3 w-3" />
                    Fusionner
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {selectedGroup && (
        <MergeDialog
          group={selectedGroup}
          open={!!selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onMerged={handleMerged}
        />
      )}
    </div>
  );
}
