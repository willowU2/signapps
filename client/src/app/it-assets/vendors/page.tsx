"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contractStart: string;
  contractEnd: string;
  supportLevel: "bronze" | "silver" | "gold" | "platinum" | "none";
  notes: string;
  createdAt: string;
}

const LS_KEY = "it.vendors";
const SUPPORT_LEVELS: Vendor["supportLevel"][] = [
  "none",
  "bronze",
  "silver",
  "gold",
  "platinum",
];

const SUPPORT_COLORS: Record<Vendor["supportLevel"], string> = {
  none: "bg-muted text-muted-foreground",
  bronze: "bg-orange-500/10 text-orange-700",
  silver: "bg-slate-500/10 text-slate-600",
  gold: "bg-yellow-500/10 text-yellow-700",
  platinum: "bg-blue-500/10 text-blue-700",
};

const EMPTY_VENDOR: Omit<Vendor, "id" | "createdAt"> = {
  name: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contractStart: "",
  contractEnd: "",
  supportLevel: "none",
  notes: "",
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadVendors(): Vendor[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveVendors(v: Vendor[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(v));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

function contractStatus(vendor: Vendor): { label: string; badge: string } {
  if (!vendor.contractEnd)
    return { label: "Indefini", badge: "bg-muted text-muted-foreground" };
  const days = daysUntil(vendor.contractEnd);
  if (days < 0) return { label: "Expire", badge: "bg-red-500/10 text-red-600" };
  if (days <= 30)
    return {
      label: `Expire dans ${days}j`,
      badge: "bg-orange-500/10 text-orange-600",
    };
  if (days <= 90)
    return {
      label: `Expire dans ${days}j`,
      badge: "bg-yellow-500/10 text-yellow-600",
    };
  return { label: "Actif", badge: "bg-emerald-500/10 text-emerald-600" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  usePageTitle("Fournisseurs IT");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] =
    useState<Omit<Vendor, "id" | "createdAt">>(EMPTY_VENDOR);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setVendors(loadVendors());
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_VENDOR });
    setShowDialog(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name,
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      contractStart: v.contractStart,
      contractEnd: v.contractEnd,
      supportLevel: v.supportLevel,
      notes: v.notes,
    });
    setShowDialog(true);
  }

  function save() {
    if (!form.name.trim()) {
      toast.error("Nom du fournisseur requis");
      return;
    }
    const updated = editing
      ? vendors.map((v) => (v.id === editing.id ? { ...v, ...form } : v))
      : [
          ...vendors,
          {
            id: `v-${Date.now()}`,
            ...form,
            createdAt: new Date().toISOString(),
          },
        ];
    setVendors(updated);
    saveVendors(updated);
    setShowDialog(false);
    toast.success(editing ? "Fournisseur mis a jour" : "Fournisseur ajoute");
  }

  function remove(id: string) {
    const updated = vendors.filter((v) => v.id !== id);
    setVendors(updated);
    saveVendors(updated);
    setDeleteId(null);
    toast.success("Fournisseur supprime");
  }

  const expiringSoon = vendors.filter((v) => {
    const d = daysUntil(v.contractEnd);
    return d >= 0 && d <= 90;
  });

  return (
    <AppLayout>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Building2 className="h-6 w-6 text-primary" />
              Fournisseurs IT
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestion des contrats et contacts fournisseurs
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter fournisseur
          </Button>
        </div>

        {/* Renewal alerts */}
        {expiringSoon.length > 0 && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-700">
                  {expiringSoon.length} contrat(s) expirant dans les 90
                  prochains jours
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {expiringSoon.map((v) => (
                    <Badge
                      key={v.id}
                      className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/20"
                    >
                      {v.name} — {daysUntil(v.contractEnd)}j
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {vendors.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">
              Aucun fournisseur enregistre. Cliquez sur &quot;Ajouter
              fournisseur&quot; pour commencer.
            </p>
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Contrat</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Support</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((v) => {
                  const status = contractStatus(v);
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{v.name}</p>
                          {v.notes && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {v.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {v.contactName && (
                            <p className="text-sm">{v.contactName}</p>
                          )}
                          {v.contactEmail && (
                            <a
                              href={`mailto:${v.contactEmail}`}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <Mail className="h-3 w-3" />
                              {v.contactEmail}
                            </a>
                          )}
                          {v.contactPhone && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {v.contactPhone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {v.contractStart && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              Debut:{" "}
                              {new Date(v.contractStart).toLocaleDateString()}
                            </p>
                          )}
                          {v.contractEnd && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              Fin:{" "}
                              {new Date(v.contractEnd).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${status.badge}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs capitalize ${SUPPORT_COLORS[v.supportLevel]}`}
                        >
                          {v.supportLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(v)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(v.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nom *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Acme Corp"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact</Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contactName: e.target.value }))
                    }
                    placeholder="Jean Martin"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Telephone</Label>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contactPhone: e.target.value }))
                    }
                    placeholder="+33 1 23 45 67 89"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Email contact</Label>
                <Input
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactEmail: e.target.value }))
                  }
                  placeholder="support@acme.com"
                  type="email"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Debut du contrat</Label>
                  <Input
                    value={form.contractStart}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contractStart: e.target.value }))
                    }
                    type="date"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Fin du contrat</Label>
                  <Input
                    value={form.contractEnd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contractEnd: e.target.value }))
                    }
                    type="date"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Niveau de support</Label>
                <Select
                  value={form.supportLevel}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      supportLevel: v as Vendor["supportLevel"],
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_LEVELS.map((l) => (
                      <SelectItem key={l} value={l} className="capitalize">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Informations supplementaires..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={save}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {editing ? "Mettre a jour" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        {deleteId && (
          <Dialog open onOpenChange={() => setDeleteId(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Confirmer la suppression</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Cette action est irreversible. Le fournisseur sera supprime
                definitivement.
              </p>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setDeleteId(null)}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={() => remove(deleteId)}>
                  Supprimer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
