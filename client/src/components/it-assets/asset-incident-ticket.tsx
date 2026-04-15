"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  Plus,
  Ticket,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { HardwareAsset } from "@/lib/api/it-assets";

interface IncidentTicket {
  id: string;
  asset_id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  resolved_at?: string;
}

interface Props {
  asset: HardwareAsset;
}

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  critical: "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_ICON = {
  open: AlertTriangle,
  in_progress: Clock,
  resolved: CheckCircle,
  closed: XCircle,
};

export function AssetIncidentTickets({ asset }: Props) {
  const [tickets, setTickets] = useState<IncidentTicket[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium",
  });

  const openCount = tickets.filter(
    (t) => t.status === "open" || t.status === "in_progress",
  ).length;

  const handleCreate = () => {
    if (!form.title.trim()) return;
    const ticket: IncidentTicket = {
      id: `INC-${Date.now().toString().slice(-6)}`,
      asset_id: asset.id,
      title: form.title,
      description: form.description,
      severity: form.severity as IncidentTicket["severity"],
      status: "open",
      created_at: new Date().toISOString(),
    };
    setTickets((t) => [ticket, ...t]);
    setForm({ title: "", description: "", severity: "medium" });
    setDialogOpen(false);
  };

  const updateStatus = (id: string, status: IncidentTicket["status"]) => {
    setTickets((t) =>
      t.map((ticket) =>
        ticket.id === id
          ? {
              ...ticket,
              status,
              resolved_at:
                status === "resolved"
                  ? new Date().toISOString()
                  : ticket.resolved_at,
            }
          : ticket,
      ),
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Ticket className="h-4 w-4 text-red-500" />
          Incident Tickets
          {openCount > 0 && (
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
              {openCount} open
            </Badge>
          )}
        </CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Ticket
        </Button>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No incident tickets</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const Icon = STATUS_ICON[ticket.status];
              return (
                <div
                  key={ticket.id}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {ticket.title}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs border ${SEVERITY_COLOR[ticket.severity]}`}
                    >
                      {ticket.severity}
                    </span>
                  </div>
                  {ticket.description && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {ticket.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pl-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{ticket.id}</span>
                      <span>
                        {format(new Date(ticket.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                    {ticket.status === "open" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={() => updateStatus(ticket.id, "in_progress")}
                        >
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={() => updateStatus(ticket.id, "resolved")}
                        >
                          Resolve
                        </Button>
                      </div>
                    )}
                    {ticket.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2"
                        onClick={() => updateStatus(ticket.id, "resolved")}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Incident Ticket — {asset.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Screen flickering"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                placeholder="Describe the issue…"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={!form.title.trim()}>
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
