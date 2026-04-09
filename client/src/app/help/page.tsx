"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HelpCircle,
  Keyboard,
  BookOpen,
  Server,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  ExternalLink,
  Zap,
  Shield,
  Users,
  HardDrive,
  Mail,
  FileText,
  Container,
  Brain,
  Star,
  Loader2,
  AlertTriangle,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { helpApi } from "@/lib/api/help";
import type { FaqItem, SupportTicket, TicketStatus } from "@/lib/api/help";

// ============================================================================
// Keyboard Shortcuts (static, no backend needed)
// ============================================================================

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const KEYBOARD_SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Navigation generale",
    shortcuts: [
      { keys: "Ctrl + K", description: "Recherche rapide (Command Palette)" },
      { keys: "Ctrl + /", description: "Afficher les raccourcis clavier" },
      { keys: "Ctrl + B", description: "Basculer la barre laterale" },
      { keys: "Alt + 1-9", description: "Naviguer vers le module N" },
      { keys: "Escape", description: "Fermer le panneau actif" },
    ],
  },
  {
    title: "Documents",
    shortcuts: [
      { keys: "Ctrl + N", description: "Nouveau document" },
      { keys: "Ctrl + S", description: "Sauvegarder" },
      { keys: "Ctrl + Z", description: "Annuler" },
      { keys: "Ctrl + Shift + Z", description: "Retablir" },
      { keys: "Ctrl + P", description: "Imprimer" },
    ],
  },
  {
    title: "Mail",
    shortcuts: [
      { keys: "C", description: "Nouveau message" },
      { keys: "R", description: "Repondre" },
      { keys: "A", description: "Repondre a tous" },
      { keys: "F", description: "Transferer" },
      { keys: "E", description: "Archiver" },
      { keys: "Delete", description: "Supprimer" },
    ],
  },
  {
    title: "Chat",
    shortcuts: [
      { keys: "Ctrl + Enter", description: "Envoyer le message" },
      { keys: "Ctrl + Shift + N", description: "Nouvelle conversation" },
      { keys: "Ctrl + F", description: "Rechercher dans la conversation" },
    ],
  },
  {
    title: "Taches",
    shortcuts: [
      { keys: "T", description: "Nouvelle tache" },
      { keys: "Space", description: "Marquer comme termine" },
      { keys: "D", description: "Definir une date limite" },
      { keys: "P", description: "Changer la priorite" },
    ],
  },
];

// ============================================================================
// Service Status (static, health checks done client-side)
// ============================================================================

interface ServiceInfo {
  name: string;
  port: number;
  icon: React.ReactNode;
  description: string;
}

const SERVICES: ServiceInfo[] = [
  {
    name: "Identity",
    port: 3001,
    icon: <Users className="h-4 w-4" />,
    description: "Authentification, LDAP, MFA, RBAC",
  },
  {
    name: "Containers",
    port: 3002,
    icon: <Container className="h-4 w-4" />,
    description: "Gestion des conteneurs Docker",
  },
  {
    name: "Proxy",
    port: 3003,
    icon: <Shield className="h-4 w-4" />,
    description: "Reverse proxy, TLS, SmartShield",
  },
  {
    name: "Storage",
    port: 3004,
    icon: <HardDrive className="h-4 w-4" />,
    description: "Stockage fichiers (local/S3)",
  },
  {
    name: "AI",
    port: 3005,
    icon: <Brain className="h-4 w-4" />,
    description: "RAG, LLM, embeddings, pgvector",
  },
  {
    name: "SecureLink",
    port: 3006,
    icon: <Shield className="h-4 w-4" />,
    description: "Tunnels web, DNS, ad-blocking",
  },
  {
    name: "Scheduler",
    port: 3007,
    icon: <Clock className="h-4 w-4" />,
    description: "Gestion des taches CRON",
  },
  {
    name: "Metrics",
    port: 3008,
    icon: <Zap className="h-4 w-4" />,
    description: "Monitoring, Prometheus, alertes",
  },
  {
    name: "Media",
    port: 3009,
    icon: <FileText className="h-4 w-4" />,
    description: "STT/TTS/OCR natif, pipeline voix",
  },
];

// ============================================================================
// Ticket category options
// ============================================================================

const TICKET_CATEGORIES = [
  { value: "account", label: "Compte & Authentification" },
  { value: "documents", label: "Documents & Drive" },
  { value: "mail", label: "Messagerie" },
  { value: "calendar", label: "Calendrier" },
  { value: "storage", label: "Stockage" },
  { value: "ai", label: "Intelligence Artificielle" },
  { value: "security", label: "Securite" },
  { value: "admin", label: "Administration" },
  { value: "other", label: "Autre" },
];

// ============================================================================
// Status helpers
// ============================================================================

const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Resolu",
  closed: "Ferme",
};

const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-yellow-500/10 text-yellow-600",
  resolved: "bg-green-500/10 text-green-600",
  closed: "bg-muted text-muted-foreground",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ============================================================================
// Help Page
// ============================================================================

export default function HelpPage() {
  usePageTitle("Aide");
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqItems, setOpenFaqItems] = useState<Set<string>>(new Set());
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    description: "",
    category: "",
  });
  const [serviceStatuses, setServiceStatuses] = useState<
    Record<string, "online" | "offline" | "checking">
  >({});

  // ---------------------------------------------------------------------------
  // Data fetching — FAQ
  // ---------------------------------------------------------------------------
  const {
    data: faqData,
    isLoading: faqLoading,
    isError: faqError,
  } = useQuery({
    queryKey: ["help-faq"],
    queryFn: async () => {
      const res = await helpApi.listFaq();
      return res.data;
    },
    retry: 1,
  });

  // ---------------------------------------------------------------------------
  // Data fetching — Tickets
  // ---------------------------------------------------------------------------
  const {
    data: ticketsData,
    isLoading: ticketsLoading,
    isError: ticketsError,
  } = useQuery({
    queryKey: ["help-tickets"],
    queryFn: async () => {
      const res = await helpApi.listTickets();
      return res.data;
    },
    retry: 1,
  });

  const tickets: SupportTicket[] = ticketsData ?? [];

  // ---------------------------------------------------------------------------
  // Mutation — create ticket
  // ---------------------------------------------------------------------------
  const createTicket = useMutation({
    mutationFn: (data: {
      subject: string;
      description: string;
      category: string;
    }) => helpApi.createTicket(data),
    onSuccess: () => {
      toast.success(
        "Ticket cree avec succes. Nous vous repondrons dans les plus brefs delais.",
      );
      setTicketForm({ subject: "", description: "", category: "" });
      queryClient.invalidateQueries({ queryKey: ["help-tickets"] });
    },
    onError: () => {
      toast.error("Impossible de creer le ticket. Veuillez reessayer.");
    },
  });

  // ---------------------------------------------------------------------------
  // FAQ search & grouping
  // ---------------------------------------------------------------------------
  const filteredFaq = useMemo(() => {
    const items: FaqItem[] = faqData ?? [];
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [faqData, searchQuery]);

  const faqCategories = useMemo(
    () => [...new Set(filteredFaq.map((item) => item.category))],
    [filteredFaq],
  );

  const toggleFaq = (id: string) => {
    setOpenFaqItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Service health checks (client-side, kept as-is)
  // ---------------------------------------------------------------------------
  const checkServiceStatus = async (port: number, name: string) => {
    setServiceStatuses((prev) => ({ ...prev, [name]: "checking" }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      await fetch(`http://localhost:${port}/api/v1/health`, {
        signal: controller.signal,
        mode: "no-cors",
      });
      clearTimeout(timeout);
      setServiceStatuses((prev) => ({ ...prev, [name]: "online" }));
    } catch {
      setServiceStatuses((prev) => ({ ...prev, [name]: "offline" }));
    }
  };

  const checkAllServices = () => {
    SERVICES.forEach((service) =>
      checkServiceStatus(service.port, service.name),
    );
  };

  // ---------------------------------------------------------------------------
  // Ticket form submit
  // ---------------------------------------------------------------------------
  const handleTicketSubmit = () => {
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      toast.error("Veuillez remplir le sujet et le message");
      return;
    }
    if (!ticketForm.category) {
      toast.error("Veuillez selectionner une categorie");
      return;
    }
    createTicket.mutate({
      subject: ticketForm.subject.trim(),
      description: ticketForm.description.trim(),
      category: ticketForm.category,
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AppLayout>
      <div className="space-y-8 w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <HelpCircle className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Centre d&apos;aide</h1>
            <p className="text-sm text-muted-foreground">
              Documentation, raccourcis et support technique
            </p>
          </div>
        </div>

        {/* Quoi de neuf */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Quoi de neuf
            </CardTitle>
            <CardDescription>
              Dernières mises à jour et nouvelles fonctionnalités.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  icon: <Brain className="h-4 w-4 text-purple-500" />,
                  title: "AI Multimodal Gateway",
                  description:
                    "Génération d'images, vidéo, audio et 3D via une interface unifiée. Support multi-providers (OpenAI, Anthropic, Ollama, natif GGUF).",
                },
                {
                  icon: <Mail className="h-4 w-4 text-blue-500" />,
                  title: "Mail intégré",
                  description:
                    "Client email complet avec boîte de réception, composition, filtres et signatures personnalisées.",
                },
                {
                  icon: <FileText className="h-4 w-4 text-green-500" />,
                  title: "Import Excel",
                  description:
                    "Importation et prévisualisation de fichiers Excel (.xlsx) directement dans la plateforme.",
                },
                {
                  icon: <Zap className="h-4 w-4 text-orange-500" />,
                  title: "PWA Support",
                  description:
                    "Installez SignApps comme application native sur desktop et mobile avec support offline.",
                },
                {
                  icon: <Star className="h-4 w-4 text-yellow-500" />,
                  title: "50+ pages",
                  description:
                    "Plus de 50 pages et modules couvrant tous les besoins de collaboration : Drive, Chat, Calendrier, Tâches, IA, Monitoring et plus.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans l'aide..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <a
            href="#faq"
            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">FAQ</span>
          </a>
          <a
            href="#shortcuts"
            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <Keyboard className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Raccourcis</span>
          </a>
          <a
            href="#system"
            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <Server className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Systeme</span>
          </a>
          <a
            href="#contact"
            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">Contact</span>
          </a>
          <a
            href="#tickets"
            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <Ticket className="h-4 w-4 text-teal-500" />
            <span className="text-sm font-medium">Mes tickets</span>
          </a>
        </div>

        {/* FAQ Section */}
        <section id="faq">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                Foire aux questions
              </CardTitle>
              <CardDescription>
                Trouvez des reponses aux questions les plus frequentes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : faqError ? (
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <p className="text-sm">Impossible de charger la FAQ.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      queryClient.invalidateQueries({ queryKey: ["help-faq"] })
                    }
                  >
                    Reessayer
                  </Button>
                </div>
              ) : faqCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? (
                    <>Aucun resultat pour &quot;{searchQuery}&quot;</>
                  ) : (
                    "Aucun article FAQ disponible."
                  )}
                </p>
              ) : (
                faqCategories.map((category) => (
                  <div key={category} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </h3>
                    {filteredFaq
                      .filter((item) => item.category === category)
                      .map((item) => (
                        <Collapsible
                          key={item.id}
                          open={openFaqItems.has(item.id)}
                          onOpenChange={() => toggleFaq(item.id)}
                        >
                          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium pr-2">
                              {item.question}
                            </span>
                            {openFaqItems.has(item.id) ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 py-2 text-sm text-muted-foreground">
                            {item.answer}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        {/* Keyboard Shortcuts */}
        <section id="shortcuts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-green-500" />
                Raccourcis clavier
              </CardTitle>
              <CardDescription>
                Gagnez en productivite avec les raccourcis clavier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {KEYBOARD_SHORTCUTS.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <div className="space-y-1.5">
                      {group.shortcuts.map((shortcut) => (
                        <div
                          key={shortcut.keys}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-sm text-muted-foreground">
                            {shortcut.description}
                          </span>
                          <kbd className="inline-flex h-6 items-center rounded border bg-muted px-2 text-[11px] font-mono font-medium text-muted-foreground">
                            {shortcut.keys}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Info */}
        <section id="system">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-orange-500" />
                    Informations systeme
                  </CardTitle>
                  <CardDescription>
                    Version, services et etat du systeme.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={checkAllServices}>
                  Verifier les services
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Version Info */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="text-sm font-semibold">SignApps v0.1.0</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Frontend</p>
                  <p className="text-sm font-semibold">Next.js 16 + React 19</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Backend</p>
                  <p className="text-sm font-semibold">Rust (Axum/Tokio)</p>
                </div>
              </div>

              <Separator />

              {/* Services */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Services</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SERVICES.map((service) => {
                    const status = serviceStatuses[service.name];
                    return (
                      <div
                        key={service.name}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          {service.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {service.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              :{service.port}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {service.description}
                          </p>
                        </div>
                        {status === "online" && (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                        {status === "offline" && (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        {status === "checking" && (
                          <Clock className="h-4 w-4 text-yellow-500 animate-pulse shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Documentation Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-indigo-500" />
              Documentation
            </CardTitle>
            <CardDescription>
              Liens vers la documentation detaillee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  title: "Guide de demarrage",
                  description: "Premiers pas avec SignApps",
                  icon: <Zap className="h-4 w-4" />,
                },
                {
                  title: "Administration",
                  description: "Gestion des utilisateurs et parametres",
                  icon: <Shield className="h-4 w-4" />,
                },
                {
                  title: "API Reference",
                  description: "Documentation des APIs REST",
                  icon: <Server className="h-4 w-4" />,
                },
                {
                  title: "Securite",
                  description: "Bonnes pratiques de securite",
                  icon: <Shield className="h-4 w-4" />,
                },
                {
                  title: "Gestion des fichiers",
                  description: "Drive, stockage et partage",
                  icon: <HardDrive className="h-4 w-4" />,
                },
                {
                  title: "Intelligence artificielle",
                  description: "Utiliser les fonctionnalites IA",
                  icon: <Brain className="h-4 w-4" />,
                },
              ].map((doc) => (
                <div
                  key={doc.title}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                    {doc.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Support — Ticket Form */}
        <section id="contact">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                Contacter le support
              </CardTitle>
              <CardDescription>
                Besoin d&apos;aide supplementaire ? Creez un ticket de support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-subject">Sujet</Label>
                <Input
                  id="ticket-subject"
                  placeholder="Decrivez brievement votre probleme"
                  value={ticketForm.subject}
                  onChange={(e) =>
                    setTicketForm((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-category">Categorie</Label>
                <Select
                  value={ticketForm.category}
                  onValueChange={(value) =>
                    setTicketForm((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger id="ticket-category">
                    <SelectValue placeholder="Choisir une categorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-message">Message</Label>
                <Textarea
                  id="ticket-message"
                  placeholder="Decrivez votre probleme en detail..."
                  rows={5}
                  value={ticketForm.description}
                  onChange={(e) =>
                    setTicketForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <Button
                onClick={handleTicketSubmit}
                disabled={createTicket.isPending}
              >
                {createTicket.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {createTicket.isPending
                  ? "Envoi en cours..."
                  : "Envoyer le ticket"}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* My Tickets */}
        <section id="tickets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-teal-500" />
                Mes tickets
              </CardTitle>
              <CardDescription>
                Suivez l&apos;avancement de vos demandes de support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : ticketsError ? (
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <p className="text-sm">Impossible de charger vos tickets.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      queryClient.invalidateQueries({
                        queryKey: ["help-tickets"],
                      })
                    }
                  >
                    Reessayer
                  </Button>
                </div>
              ) : tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aucun ticket pour le moment.
                </p>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {ticket.subject}
                          </span>
                          <Badge
                            variant="secondary"
                            className={TICKET_STATUS_COLORS[ticket.status]}
                          >
                            {TICKET_STATUS_LABELS[ticket.status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {ticket.category}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(ticket.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </AppLayout>
  );
}
