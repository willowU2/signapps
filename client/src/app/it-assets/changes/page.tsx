"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GitBranch, Plus, ChevronRight } from "lucide-react";
import {
  itAssetsApi,
  ChangeRequest,
  CreateChangeRequestInput,
} from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

const STATUSES = [
  "submitted",
  "reviewed",
  "approved",
  "implemented",
  "verified",
];
const RISK_LEVELS = ["low", "medium", "high", "critical"];

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-600",
  reviewed: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  implemented: "bg-purple-500/10 text-purple-600",
  verified: "bg-green-500/10 text-green-600",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  high: "bg-orange-500/10 text-orange-600",
  critical: "bg-red-500/10 text-red-600",
};

const NEXT_STATUS: Record<string, string | null> = {
  submitted: "reviewed",
  reviewed: "approved",
  approved: "implemented",
  implemented: "verified",
  verified: null,
};

const NEXT_LABEL: Record<string, string> = {
  reviewed: "Mark Reviewed",
  approved: "Approve",
  implemented: "Mark Implemented",
  verified: "Verify",
};

export default function ChangesPage() {
  usePageTitle("Change Management");
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<ChangeRequest | null>(null);
  const [form, setForm] = useState<CreateChangeRequestInput>({
    title: "",
    description: "",
    impact_analysis: "",
    risk_level: "low",
  });

  const { data: changes = [] } = useQuery<ChangeRequest[]>({
    queryKey: ["change-requests"],
    queryFn: () => itAssetsApi.listChangeRequests().then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => itAssetsApi.createChangeRequest(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-requests"] });
      setShowCreate(false);
      setForm({
        title: "",
        description: "",
        impact_analysis: "",
        risk_level: "low",
      });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      itAssetsApi.updateChangeStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["change-requests"] });
      setSelected(null);
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-primary" />
              Change Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              RFC workflow: submit → review → approve → implement → verify
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New RFC
          </Button>
        </div>

        {/* Kanban-style status strip */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUSES.map((s) => {
            const count = changes.filter((c) => c.status === s).length;
            return (
              <div key={s} className="flex-1 min-w-28 text-center">
                <div
                  className={`text-xs font-semibold py-1 px-2 rounded-lg ${STATUS_COLORS[s] ?? "bg-muted text-muted-foreground"}`}
                >
                  {s} ({count})
                </div>
              </div>
            );
          })}
        </div>

        {/* Changes table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <GitBranch className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">
                          Aucune demande de changement
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          Soumettez une RFC pour suivre les changements
                          d'infrastructure.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {changes.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell className="font-medium max-w-xs truncate">
                      {c.title}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[c.risk_level ?? "low"] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {c.risk_level ?? "low"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status ?? "submitted"] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {c.status ?? "submitted"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.submitted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create RFC dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Request for Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="Brief description of the change"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Detailed description..."
                rows={3}
              />
            </div>
            <div>
              <Label>Impact Analysis</Label>
              <Textarea
                value={form.impact_analysis ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, impact_analysis: e.target.value }))
                }
                placeholder="Which systems / users are affected?"
                rows={2}
              />
            </div>
            <div>
              <Label>Risk Level</Label>
              <Select
                value={form.risk_level ?? "low"}
                onValueChange={(v) => setForm((p) => ({ ...p, risk_level: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LEVELS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.title || createMut.isPending}
            >
              Submit RFC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change detail dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status ?? "submitted"]}`}
                >
                  {selected.status}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[selected.risk_level ?? "low"]}`}
                >
                  {selected.risk_level} risk
                </span>
              </div>
              {selected.description && (
                <div>
                  <p className="font-medium text-muted-foreground">
                    Description
                  </p>
                  <p>{selected.description}</p>
                </div>
              )}
              {selected.impact_analysis && (
                <div>
                  <p className="font-medium text-muted-foreground">
                    Impact Analysis
                  </p>
                  <p>{selected.impact_analysis}</p>
                </div>
              )}
              {/* Status timeline */}
              <div className="pt-2">
                <p className="font-medium text-muted-foreground mb-2">
                  Timeline
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "Submitted", ts: selected.submitted_at },
                    { label: "Reviewed", ts: selected.reviewed_at },
                    { label: "Approved", ts: selected.approved_at },
                    { label: "Implemented", ts: selected.implemented_at },
                    { label: "Verified", ts: selected.verified_at },
                  ].map(
                    ({ label, ts }) =>
                      ts && (
                        <div
                          key={label}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground">
                            {new Date(ts).toLocaleString()}
                          </span>
                        </div>
                      ),
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              {NEXT_STATUS[selected.status ?? "submitted"] && (
                <Button
                  onClick={() =>
                    statusMut.mutate({
                      id: selected.id,
                      status: NEXT_STATUS[selected.status ?? "submitted"]!,
                    })
                  }
                  disabled={statusMut.isPending}
                >
                  {NEXT_LABEL[NEXT_STATUS[selected.status ?? "submitted"]!]}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
