"use client";

import { useState, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Ticket,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Filter,
  HelpCircle,
} from "lucide-react";
import { AiChatbot } from "@/components/helpdesk/ai-chatbot";

// ── Types ──
export interface HelpdeskTicket {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "resolved" | "closed";
  category: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  slaDeadline: string;
  csatScore?: number;
  csatComment?: string;
}

const STORAGE_KEY = "signapps-helpdesk-tickets";

const CATEGORIES = [
  { value: "bug", label: "Bug / Anomalie" },
  { value: "feature", label: "Demande de fonctionnalite" },
  { value: "billing", label: "Facturation" },
  { value: "account", label: "Compte et acces" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Autre" },
];

const PRIORITIES = [
  { value: "low", label: "Basse", slaHours: 72 },
  { value: "medium", label: "Moyenne", slaHours: 24 },
  { value: "high", label: "Haute", slaHours: 8 },
  { value: "urgent", label: "Urgente", slaHours: 2 },
];

const AGENTS = [
  { id: "agent1", name: "Sophie Durand" },
  { id: "agent2", name: "Marc Petit" },
  { id: "agent3", name: "Julie Bernard" },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  open: {
    label: "Ouvert",
    color: "bg-blue-100 text-blue-800",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  "in-progress": {
    label: "En cours",
    color: "bg-orange-100 text-orange-800",
    icon: <Clock className="w-3 h-3" />,
  },
  resolved: {
    label: "Resolu",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  closed: {
    label: "Ferme",
    color: "bg-gray-100 text-gray-700",
    icon: <CheckCircle className="w-3 h-3" />,
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Basse", color: "bg-green-100 text-green-800" },
  medium: { label: "Moyenne", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "Haute", color: "bg-orange-100 text-orange-800" },
  urgent: { label: "Urgente", color: "bg-red-100 text-red-800" },
};

function generateId() {
  return `TKT-${Date.now().toString(36).toUpperCase()}`;
}

function computeSlaDeadline(priority: string): string {
  const hours = PRIORITIES.find((p) => p.value === priority)?.slaHours ?? 24;
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function SlaTimer({ ticket }: { ticket: HelpdeskTicket }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const deadline = new Date(ticket.slaDeadline).getTime();
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setRemaining("Expire");
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}m`);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [ticket.slaDeadline]);

  const isOverdue = new Date(ticket.slaDeadline) < new Date();
  const isWarning =
    !isOverdue && new Date(ticket.slaDeadline).getTime() - Date.now() < 3600000;

  if (ticket.status === "resolved" || ticket.status === "closed") {
    return <span className="text-xs text-green-600">Resolu</span>;
  }

  return (
    <div
      className={`flex items-center gap-1 text-xs font-medium ${
        isOverdue
          ? "text-red-600"
          : isWarning
            ? "text-orange-500"
            : "text-muted-foreground"
      }`}
    >
      <Clock className="w-3 h-3" />
      {remaining}
    </div>
  );
}

// ── Create Ticket Dialog ──
function CreateTicketDialog({
  onCreated,
}: {
  onCreated: (ticket: HelpdeskTicket) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Le titre est requis";
    if (!description.trim()) e.description = "La description est requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const ticket: HelpdeskTicket = {
      id: generateId(),
      title: title.trim(),
      description: description.trim(),
      priority: priority as HelpdeskTicket["priority"],
      status: "open",
      category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaDeadline: computeSlaDeadline(priority),
    };

    setTimeout(() => {
      onCreated(ticket);
      setSubmitting(false);
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("other");
      setErrors({});
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Creer un ticket de support</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-title">Titre *</Label>
            <Input
              id="ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Decrivez brievement le probleme"
              aria-describedby={errors.title ? "title-error" : undefined}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <p id="title-error" className="text-xs text-red-600" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-priority">Priorite</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="ticket-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label} (SLA: {p.slaHours}h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-category">Categorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="ticket-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-description">Description *</Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Decrivez le probleme en detail: etapes de reproduction, comportement attendu, comportement observe..."
              rows={5}
              aria-describedby={
                errors.description ? "description-error" : undefined
              }
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p
                id="description-error"
                className="text-xs text-red-600"
                role="alert"
              >
                {errors.description}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creation..." : "Creer le ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── CSAT Survey inline ──
function CsatSurvey({
  ticket,
  onRate,
}: {
  ticket: HelpdeskTicket;
  onRate: (score: number, comment: string) => void;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(!!ticket.csatScore);

  if (submitted || ticket.csatScore) {
    return (
      <div className="text-xs text-green-600 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        CSAT: {ticket.csatScore}/5
      </div>
    );
  }

  if (ticket.status !== "resolved") return null;

  return (
    <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
      <p className="text-xs font-medium mb-2">
        Comment evaluez-vous la resolution ?
      </p>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setScore(s)}
            className={`text-lg transition-all hover:scale-110 ${score && s <= score ? "opacity-100" : "opacity-30"}`}
            aria-label={`${s} etoile${s > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      {score && (
        <div className="space-y-2">
          <Input
            placeholder="Commentaire optionnel..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="text-xs h-7"
          />
          <Button
            size="sm"
            className="h-6 text-xs"
            onClick={() => {
              onRate(score, comment);
              setSubmitted(true);
            }}
          >
            Envoyer
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function HelpdeskPage() {
  usePageTitle("Helpdesk");
  const [tickets, setTickets] = useState<HelpdeskTicket[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTickets(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((updated: HelpdeskTicket[]) => {
    setTickets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  }, []);

  const handleCreate = (ticket: HelpdeskTicket) => {
    persist([ticket, ...tickets]);
  };

  const handleStatusChange = (id: string, status: HelpdeskTicket["status"]) => {
    const updated = tickets.map((t) =>
      t.id === id
        ? {
            ...t,
            status,
            updatedAt: new Date().toISOString(),
            resolvedAt:
              status === "resolved" ? new Date().toISOString() : t.resolvedAt,
            firstResponseAt:
              !t.firstResponseAt && status !== "open"
                ? new Date().toISOString()
                : t.firstResponseAt,
          }
        : t,
    );
    persist(updated);
  };

  const handleAssign = (id: string, assignee: string) => {
    const updated = tickets.map((t) =>
      t.id === id ? { ...t, assignee, updatedAt: new Date().toISOString() } : t,
    );
    persist(updated);
  };

  const handleCsat = (id: string, score: number, comment: string) => {
    const updated = tickets.map((t) =>
      t.id === id ? { ...t, csatScore: score, csatComment: comment } : t,
    );
    persist(updated);
  };

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  // Stats
  const stats = {
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in-progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    overdue: tickets.filter(
      (t) =>
        new Date(t.slaDeadline) < new Date() &&
        t.status !== "resolved" &&
        t.status !== "closed",
    ).length,
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" id="main-content">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ticket className="w-6 h-6 text-primary" />
              Helpdesk
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestion des tickets de support avec SLA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/helpdesk/faq">
                <HelpCircle className="w-4 h-4 mr-2" />
                FAQ
              </a>
            </Button>
            <CreateTicketDialog onCreated={handleCreate} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">
                {stats.open}
              </div>
              <div className="text-xs text-muted-foreground">Ouverts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-500">
                {stats.inProgress}
              </div>
              <div className="text-xs text-muted-foreground">En cours</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {stats.resolved}
              </div>
              <div className="text-xs text-muted-foreground">Resolus</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">
                {stats.overdue}
              </div>
              <div className="text-xs text-muted-foreground">SLA depassees</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40" aria-label="Filtrer par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-40" aria-label="Filtrer par priorite">
              <SelectValue placeholder="Priorite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les priorites</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ticket list */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets ({filteredTickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTickets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun ticket pour le moment</p>
                <p className="text-sm mt-1">
                  Cliquez sur "Nouveau ticket" pour commencer
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Priorite</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>SLA restant</TableHead>
                    <TableHead>Cree le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => {
                    const statusCfg = STATUS_CONFIG[ticket.status];
                    const priorityCfg = PRIORITY_CONFIG[ticket.priority];
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-xs">
                          {ticket.id}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm max-w-xs">
                            {ticket.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {
                              CATEGORIES.find(
                                (c) => c.value === ticket.category,
                              )?.label
                            }
                          </div>
                          <CsatSurvey
                            ticket={ticket}
                            onRate={(s, c) => handleCsat(ticket.id, s, c)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityCfg.color}>
                            {priorityCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusCfg.color}>
                            <span className="flex items-center gap-1">
                              {statusCfg.icon}
                              {statusCfg.label}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ticket.assignee ?? ""}
                            onValueChange={(v) => handleAssign(ticket.id, v)}
                          >
                            <SelectTrigger
                              className="h-7 text-xs w-36"
                              aria-label={`Assigner le ticket ${ticket.id}`}
                            >
                              <SelectValue placeholder="Non assigne" />
                            </SelectTrigger>
                            <SelectContent>
                              {AGENTS.map((a) => (
                                <SelectItem key={a.id} value={a.name}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <SlaTimer ticket={ticket} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(ticket.createdAt).toLocaleDateString(
                            "fr-FR",
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ticket.status}
                            onValueChange={(v) =>
                              handleStatusChange(
                                ticket.id,
                                v as HelpdeskTicket["status"],
                              )
                            }
                          >
                            <SelectTrigger
                              className="h-7 text-xs w-32"
                              aria-label={`Changer statut du ticket ${ticket.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <SelectItem key={k} value={k}>
                                  {v.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI chatbot */}
      <AiChatbot />
    </AppLayout>
  );
}
