"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ticket as TicketIcon,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Timer,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  itAssetsApi,
  Ticket,
  TicketStats,
  CreateTicketRequest,
  HardwareAsset,
} from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
] as const;
const PRIORITIES = ["critical", "high", "medium", "low"] as const;
const CATEGORIES = [
  "hardware",
  "software",
  "network",
  "access",
  "security",
  "other",
];

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-yellow-500/10 text-yellow-600",
  waiting: "bg-purple-500/10 text-purple-600",
  resolved: "bg-emerald-500/10 text-emerald-600",
  closed: "bg-slate-500/10 text-slate-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600",
  high: "bg-orange-500/10 text-orange-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-emerald-500/10 text-emerald-600",
};

// ─── SLA countdown ────────────────────────────────────────────────────────────

function SlaCountdown({ due }: { due?: string }) {
  if (!due) return <span className="text-muted-foreground text-xs">—</span>;
  const now = Date.now();
  const dueMs = new Date(due).getTime();
  const diffMs = dueMs - now;
  if (diffMs <= 0)
    return <span className="text-red-600 text-xs font-semibold">OVERDUE</span>;
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);
  const color =
    diffH < 2
      ? "text-red-600"
      : diffH < 8
        ? "text-yellow-600"
        : "text-emerald-600";
  return (
    <span className={`${color} text-xs font-semibold`}>
      {diffH}h {diffM}m
    </span>
  );
}

// ─── Ticket Card (Kanban) ─────────────────────────────────────────────────────

function TicketCard({
  ticket,
  onClick,
}: {
  ticket: Ticket;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs text-muted-foreground">#{ticket.number}</span>
        <Badge
          className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[ticket.priority]}`}
        >
          {ticket.priority}
        </Badge>
      </div>
      <p className="text-sm font-medium line-clamp-2 mb-2">{ticket.title}</p>
      {ticket.category && (
        <span className="text-[11px] text-muted-foreground">
          {ticket.category}
        </span>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Timer className="h-3 w-3" />
          <SlaCountdown due={ticket.sla_resolution_due} />
        </div>
        {ticket.requester_name && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
            {ticket.requester_name}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Kanban View ─────────────────────────────────────────────────────────────

function KanbanView({
  tickets,
  onSelect,
}: {
  tickets: Ticket[];
  onSelect: (t: Ticket) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-3 min-h-[400px]">
      {STATUSES.map((status) => {
        const cols = tickets.filter((t) => t.status === status);
        return (
          <div key={status} className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
              <Badge variant="secondary" className="text-xs">
                {cols.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-2">
              {cols.map((t) => (
                <TicketCard key={t.id} ticket={t} onClick={() => onSelect(t)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ticket Detail Panel ──────────────────────────────────────────────────────

function TicketDetailPanel({
  ticket,
  onClose,
  onUpdate,
}: {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeDesc, setTimeDesc] = useState("");

  const { data: detail } = useQuery({
    queryKey: ["ticket", ticket.id],
    queryFn: () => itAssetsApi.getTicket(ticket.id).then((r) => r.data),
  });

  const commentMut = useMutation({
    mutationFn: () =>
      itAssetsApi.addTicketComment(ticket.id, {
        content: comment,
        is_internal: isInternal,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      setComment("");
      toast.success("Comment added");
    },
  });

  const timeMut = useMutation({
    mutationFn: () =>
      itAssetsApi.logTicketTime(ticket.id, {
        duration_minutes: parseInt(timeMinutes) || 0,
        description: timeDesc,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      setTimeMinutes("");
      setTimeDesc("");
      toast.success("Time logged");
    },
  });

  const updateMut = useMutation({
    mutationFn: (status: string) =>
      itAssetsApi.updateTicket(ticket.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      onUpdate();
      toast.success("Ticket updated");
    },
  });

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">
              #{ticket.number}
            </span>
            <Badge className={STATUS_COLORS[ticket.status]}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
            <Badge className={PRIORITY_COLORS[ticket.priority]}>
              {ticket.priority}
            </Badge>
          </div>
          <h2 className="font-semibold text-base line-clamp-2">
            {ticket.title}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </div>

      {/* SLA + meta */}
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Response SLA: </span>
          <SlaCountdown due={ticket.sla_response_due} />
        </div>
        <div>
          <span className="text-muted-foreground">Resolution SLA: </span>
          <SlaCountdown due={ticket.sla_resolution_due} />
        </div>
      </div>

      {/* Status actions */}
      <div className="px-4 py-2 border-b flex gap-2 flex-wrap">
        {STATUSES.filter((s) => s !== ticket.status).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            onClick={() => updateMut.mutate(s)}
          >
            → {STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      <Tabs
        defaultValue="comments"
        className="flex-1 overflow-hidden flex flex-col"
      >
        <TabsList className="mx-4 mt-2">
          <TabsTrigger value="comments">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Comments ({detail?.comments.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="time">
            <Clock className="h-3.5 w-3.5 mr-1" />
            Time ({detail?.time_entries.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Comments tab */}
        <TabsContent
          value="comments"
          className="flex-1 overflow-auto flex flex-col px-4 gap-3 pb-2"
        >
          <div className="flex-1 overflow-auto space-y-3 pt-2">
            {detail?.comments.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg p-3 text-sm ${c.is_internal ? "bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20" : "bg-muted/40"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">
                    {c.author_name ?? "Anonyme"}
                  </span>
                  {c.is_internal && (
                    <Badge className="text-[10px] px-1 py-0 bg-yellow-200 text-yellow-800">
                      Internal
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                />
                Internal note
              </label>
              <Button
                size="sm"
                disabled={!comment.trim() || commentMut.isPending}
                onClick={() => commentMut.mutate()}
              >
                Send
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Time entries */}
        <TabsContent
          value="time"
          className="flex-1 overflow-auto flex flex-col px-4 gap-3 pb-2"
        >
          <div className="flex-1 overflow-auto space-y-2 pt-2">
            {detail?.time_entries.map((e) => (
              <div key={e.id} className="bg-muted/40 rounded-lg p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{e.duration_minutes} min</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString()}
                  </span>
                </div>
                {e.description && (
                  <p className="text-muted-foreground">{e.description}</p>
                )}
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Minutes"
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
                className="w-24"
              />
              <Input
                placeholder="Description"
                value={timeDesc}
                onChange={(e) => setTimeDesc(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={!timeMinutes || timeMut.isPending}
              onClick={() => timeMut.mutate()}
            >
              Log Time
            </Button>
          </div>
        </TabsContent>

        {/* Details tab */}
        <TabsContent
          value="details"
          className="flex-1 overflow-auto px-4 py-2 text-sm space-y-3"
        >
          {ticket.description && (
            <div>
              <h4 className="font-medium mb-1">Description</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              <span>{ticket.category ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Requester:</span>{" "}
              <span>{ticket.requester_name ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>{" "}
              <span>{ticket.requester_email ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(ticket.created_at).toLocaleString()}</span>
            </div>
            {ticket.resolved_at && (
              <div>
                <span className="text-muted-foreground">Resolved:</span>{" "}
                <span>{new Date(ticket.resolved_at).toLocaleString()}</span>
              </div>
            )}
          </div>
          {ticket.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {ticket.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  usePageTitle("IT Tickets");
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateTicketRequest>({
    title: "",
    description: "",
    priority: "medium",
    category: "",
    requester_name: "",
    requester_email: "",
  });

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["tickets"],
    queryFn: () => itAssetsApi.listTickets().then((r) => r.data),
  });

  const { data: stats } = useQuery<TicketStats>({
    queryKey: ["ticket-stats"],
    queryFn: () => itAssetsApi.getTicketStats().then((r) => r.data),
  });

  const { data: hardware = [] } = useQuery<HardwareAsset[]>({
    queryKey: ["hardware"],
    queryFn: () => itAssetsApi.listHardware().then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: () => itAssetsApi.createTicket(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket-stats"] });
      setShowCreate(false);
      setForm({
        title: "",
        description: "",
        priority: "medium",
        category: "",
        requester_name: "",
        requester_email: "",
      });
      toast.success("Ticket created");
    },
    onError: () => toast.error("Failed to create ticket"),
  });

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority)
        return false;
      return true;
    });
  }, [tickets, filterStatus, filterPriority]);

  const avgResHours = stats?.avg_resolution_minutes
    ? `${(stats.avg_resolution_minutes / 60).toFixed(1)}h`
    : "—";

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">IT Tickets</h1>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Ticket
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {stats?.total_open ?? "—"}
              </div>
              <div className="text-sm text-muted-foreground">Open tickets</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">
                {stats?.overdue_count ?? "—"}
              </div>
              <div className="text-sm text-muted-foreground">Overdue</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{avgResHours}</div>
              <div className="text-sm text-muted-foreground">
                Avg resolution
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div
                className={`text-2xl font-bold ${(stats?.sla_compliance_pct ?? 100) < 80 ? "text-red-600" : "text-emerald-600"}`}
              >
                {stats ? `${stats.sla_compliance_pct.toFixed(1)}%` : "—"}
              </div>
              <div className="text-sm text-muted-foreground">
                SLA compliance
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + view toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant={view === "kanban" ? "default" : "outline"}
              onClick={() => setView("kanban")}
            >
              Kanban
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "default" : "outline"}
              onClick={() => setView("list")}
            >
              List
            </Button>
          </div>
        </div>

        {/* Kanban or List view */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">
            Loading tickets...
          </div>
        ) : view === "kanban" ? (
          <KanbanView tickets={filtered} onSelect={setSelected} />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(t)}
                  >
                    <TableCell className="text-muted-foreground">
                      #{t.number}
                    </TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${PRIORITY_COLORS[t.priority]}`}
                      >
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{t.category ?? "—"}</TableCell>
                    <TableCell>{t.requester_name ?? "—"}</TableCell>
                    <TableCell>
                      <SlaCountdown due={t.sla_resolution_due} />
                    </TableCell>
                    <TableCell>
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <TicketIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">Aucun ticket</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          {tickets.length === 0
                            ? "Aucun ticket ouvert pour le moment."
                            : "Aucun ticket ne correspond aux filtres actuels."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <TicketDetailPanel
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdate={() => {
            qc.invalidateQueries({ queryKey: ["tickets"] });
            setSelected(null);
          }}
        />
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Brief description of the issue"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                placeholder="Detailed description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select
                  value={form.priority ?? "medium"}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category ?? ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Requester name</Label>
                <Input
                  value={form.requester_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, requester_name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Requester email</Label>
                <Input
                  type="email"
                  value={form.requester_email ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, requester_email: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Linked device</Label>
              <Select
                value={form.hardware_id ?? ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, hardware_id: v || undefined }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {hardware.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
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
              disabled={!form.title.trim() || createMut.isPending}
            >
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
