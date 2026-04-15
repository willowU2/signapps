"use client";

// IDEA-276: Document expiry and renewal alerts — track validity dates

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Bell,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  format,
  differenceInDays,
  isPast,
  isWithinInterval,
  addDays,
} from "date-fns";

interface DocExpiryRecord {
  id: string;
  doc_id?: string;
  doc_title: string;
  expiry_date: string;
  renewal_reminder_days: number; // alert this many days before expiry
  category: string; // "contract", "certificate", "license", etc.
  notes?: string;
  auto_renew: boolean;
  notified: boolean;
}

type ExpiryStatus = "expired" | "critical" | "warning" | "ok";

function getStatus(expiryDate: string, reminderDays: number): ExpiryStatus {
  const exp = new Date(expiryDate);
  if (isPast(exp)) return "expired";
  const daysLeft = differenceInDays(exp, new Date());
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= reminderDays) return "warning";
  return "ok";
}

const STATUS_CONFIG: Record<
  ExpiryStatus,
  {
    label: string;
    variant: "destructive" | "default" | "secondary" | "outline";
    icon: React.ReactNode;
  }
> = {
  expired: {
    label: "Expired",
    variant: "destructive",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  critical: {
    label: "Critical",
    variant: "destructive",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  warning: {
    label: "Expiring soon",
    variant: "default",
    icon: <Bell className="h-3.5 w-3.5" />,
  },
  ok: {
    label: "Valid",
    variant: "secondary",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
};

export function DocExpiryAlerts() {
  const [records, setRecords] = useState<DocExpiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    doc_title: "",
    expiry_date: "",
    renewal_reminder_days: 30,
    category: "contract",
    notes: "",
    auto_renew: false,
  });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ExpiryStatus | "all">("all");

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    try {
      const res = await fetch("/api/docs/expiry");
      const data = await res.json();
      setRecords(data.data ?? []);
    } catch {
      toast.error("Impossible de charger les alertes d'expiration");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.doc_title || !form.expiry_date) {
      toast.error("Le titre et la date d'expiration sont requis");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/docs/expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const created = await res.json();
      setRecords((prev) => [...prev, created]);
      setDialogOpen(false);
      toast.success("Suivi d'expiration ajouté");
    } catch {
      toast.error("Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(id: string) {
    try {
      await fetch(`/api/docs/expiry/${id}`, { method: "DELETE" });
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Retiré");
    } catch {
      toast.error("Impossible de supprimer");
    }
  }

  const filtered = records.filter(
    (r) =>
      filter === "all" ||
      getStatus(r.expiry_date, r.renewal_reminder_days) === filter,
  );

  const counts = {
    expired: records.filter(
      (r) => getStatus(r.expiry_date, r.renewal_reminder_days) === "expired",
    ).length,
    critical: records.filter(
      (r) => getStatus(r.expiry_date, r.renewal_reminder_days) === "critical",
    ).length,
    warning: records.filter(
      (r) => getStatus(r.expiry_date, r.renewal_reminder_days) === "warning",
    ).length,
    ok: records.filter(
      (r) => getStatus(r.expiry_date, r.renewal_reminder_days) === "ok",
    ).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Document Expiry Tracker
        </h2>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {(["all", "expired", "critical", "warning", "ok"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-2 py-1 rounded-md text-xs font-medium border transition-colors",
              filter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted",
            )}
          >
            {s === "all"
              ? `All (${records.length})`
              : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
          </button>
        ))}
      </div>

      <ScrollArea className="h-72">
        {loading && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Loading…
          </p>
        )}
        {filtered.map((r) => {
          const status = getStatus(r.expiry_date, r.renewal_reminder_days);
          const conf = STATUS_CONFIG[status];
          const daysLeft = differenceInDays(
            new Date(r.expiry_date),
            new Date(),
          );
          return (
            <div
              key={r.id}
              className="flex items-start justify-between border-b py-3 px-1 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">{r.doc_title}</p>
                  <Badge
                    variant={conf.variant}
                    className="text-xs gap-1 flex-shrink-0"
                  >
                    {conf.icon}
                    {conf.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires: {format(new Date(r.expiry_date), "MMM d, yyyy")}
                  {status !== "expired" && ` · ${daysLeft}d left`}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {r.category}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 flex-shrink-0 ml-2 text-destructive"
                onClick={() => deleteRecord(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No records
          </p>
        )}
      </ScrollArea>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Track Document Expiry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Document title</Label>
              <Input
                value={form.doc_title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, doc_title: e.target.value }))
                }
                placeholder="NDA with ACME Corp"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, expiry_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alert before (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.renewal_reminder_days}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      renewal_reminder_days: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Input
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
                placeholder="contract / license / certificate…"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-renew alert</Label>
              <Switch
                checked={form.auto_renew}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, auto_renew: v }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
