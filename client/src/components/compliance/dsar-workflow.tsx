"use client";

// IDEA-282: Data subject access request workflow — DSAR form + fulfillment

import { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Eye,
  Download,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

type DsarType =
  | "access"
  | "erasure"
  | "portability"
  | "rectification"
  | "restriction"
  | "object";
type DsarStatus =
  | "received"
  | "verifying"
  | "processing"
  | "fulfilled"
  | "rejected"
  | "extended";

const DSAR_TYPES: Record<DsarType, string> = {
  access: "Subject Access Request (SAR)",
  erasure: "Right to Erasure",
  portability: "Data Portability",
  rectification: "Rectification",
  restriction: "Restriction of Processing",
  object: "Right to Object",
};

const STATUS_CONFIG: Record<DsarStatus, { label: string; color: string }> = {
  received: { label: "Received", color: "bg-blue-500" },
  verifying: { label: "Verifying Identity", color: "bg-yellow-500" },
  processing: { label: "Processing", color: "bg-orange-500" },
  fulfilled: { label: "Fulfilled", color: "bg-green-500" },
  rejected: { label: "Rejected", color: "bg-red-500" },
  extended: { label: "Extended (30 days)", color: "bg-purple-500" },
};

const LEGAL_DEADLINE_DAYS = 30;

interface DsarRequest {
  id: string;
  type: DsarType;
  status: DsarStatus;
  subject_name: string;
  subject_email: string;
  description: string;
  received_at: string;
  deadline_at: string;
  fulfilled_at?: string;
  notes?: string;
  reference: string;
}

export function DsarWorkflow() {
  const [requests, setRequests] = useState<DsarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<DsarRequest | null>(null);
  const [form, setForm] = useState({
    type: "access" as DsarType,
    subject_name: "",
    subject_email: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/dsar");
      const data = await res.json();
      setRequests(data.data ?? []);
    } catch {
      toast.error("Impossible de charger les demandes");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.subject_email || !form.subject_name) {
      toast.error("Les détails du sujet sont requis");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/compliance/dsar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const created = await res.json();
      setRequests((prev) => [created, ...prev]);
      setCreateOpen(false);
      toast.success(`DSAR created · Ref: ${created.reference}`);
    } catch {
      toast.error("Impossible de créer request");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: DsarStatus, notes?: string) {
    try {
      const res = await fetch(`/api/compliance/dsar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      const updated = await res.json();
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setSelectedReq(updated);
      toast.success(`Status updated: ${STATUS_CONFIG[status].label}`);
    } catch {
      toast.error("Impossible de mettre à jour");
    }
  }

  async function exportData(id: string) {
    try {
      const res = await fetch(`/api/compliance/dsar/${id}/export`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DSAR_${id}.zip`;
      a.click();
    } catch {
      toast.error("Export failed");
    }
  }

  function getDaysLeft(req: DsarRequest) {
    if (req.status === "fulfilled" || req.status === "rejected") return null;
    return (
      LEGAL_DEADLINE_DAYS -
      differenceInDays(new Date(), new Date(req.received_at))
    );
  }

  const NEXT_STATUSES: Record<DsarStatus, DsarStatus[]> = {
    received: ["verifying", "rejected"],
    verifying: ["processing", "rejected"],
    processing: ["fulfilled", "extended", "rejected"],
    fulfilled: [],
    rejected: [],
    extended: ["fulfilled", "rejected"],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> DSAR Management
        </h2>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Request
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {(
          ["received", "processing", "fulfilled", "rejected"] as DsarStatus[]
        ).map((s) => (
          <div key={s} className="text-center rounded-md border p-2">
            <p className="text-xl font-bold">
              {requests.filter((r) => r.status === s).length}
            </p>
            <p className="text-xs text-muted-foreground">
              {STATUS_CONFIG[s].label}
            </p>
          </div>
        ))}
      </div>

      <ScrollArea className="h-72">
        {loading && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Loading…
          </p>
        )}
        {requests.map((req) => {
          const daysLeft = getDaysLeft(req);
          const urgent = daysLeft !== null && daysLeft <= 7;
          return (
            <div
              key={req.id}
              className={cn(
                "flex items-start justify-between px-3 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/30",
                urgent && "bg-orange-50/50 dark:bg-orange-950/10",
              )}
              onClick={() => setSelectedReq(req)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-muted-foreground">
                    {req.reference}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {DSAR_TYPES[req.type]}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{req.subject_name}</p>
                <p className="text-xs text-muted-foreground">
                  {req.subject_email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Received {format(new Date(req.received_at), "MMM d, yyyy")}
                  {daysLeft !== null && (
                    <span
                      className={cn(
                        "ml-2",
                        urgent ? "text-orange-600 font-medium" : "",
                      )}
                    >
                      · {daysLeft}d left
                    </span>
                  )}
                </p>
              </div>
              <div className="ml-3 flex-shrink-0">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full mt-2",
                    STATUS_CONFIG[req.status].color,
                  )}
                />
              </div>
            </div>
          );
        })}
        {!loading && requests.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No DSAR requests
          </p>
        )}
      </ScrollArea>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New DSAR Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Request type</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, type: v as DsarType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DSAR_TYPES) as DsarType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {DSAR_TYPES[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Subject name</Label>
                <Input
                  value={form.subject_name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, subject_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subject email</Label>
                <Input
                  value={form.subject_email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, subject_email: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description / details</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {selectedReq && (
        <Dialog open={!!selectedReq} onOpenChange={() => setSelectedReq(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-4 w-4" /> {selectedReq.reference}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    STATUS_CONFIG[selectedReq.status].color,
                  )}
                />
                <span className="text-sm font-medium">
                  {STATUS_CONFIG[selectedReq.status].label}
                </span>
              </div>
              <p className="text-sm">
                <span className="font-medium">{selectedReq.subject_name}</span>{" "}
                · {selectedReq.subject_email}
              </p>
              <p className="text-xs text-muted-foreground">
                {DSAR_TYPES[selectedReq.type]}
              </p>
              {selectedReq.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedReq.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Deadline:{" "}
                {format(new Date(selectedReq.deadline_at), "MMM d, yyyy")}
              </p>

              {/* Status transitions */}
              {NEXT_STATUSES[selectedReq.status].length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {NEXT_STATUSES[selectedReq.status].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(selectedReq.id, s)}
                    >
                      → {STATUS_CONFIG[s].label}
                    </Button>
                  ))}
                </div>
              )}

              {selectedReq.type === "access" ||
              selectedReq.type === "portability" ? (
                <Button size="sm" onClick={() => exportData(selectedReq.id)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export Subject Data
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
