"use client";

import { use, useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Receipt,
  Ticket,
  LogIn,
  Mail,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { billingApi, type Invoice } from "@/lib/api/billing";
import { storageApi } from "@/lib/api/storage";
import { itAssetsApi, type Ticket as ITTicket } from "@/lib/api/it-assets";

// ── Types ──
interface PortalDocument {
  key: string;
  size: number;
  last_modified: string | null;
  content_type: string | null;
}

// ── Status display helpers ──
const INVOICE_STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  sent: "bg-yellow-100 text-yellow-800",
  pending: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-800",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  paid: "Paye",
  sent: "Envoyee",
  pending: "En attente",
  overdue: "En retard",
  draft: "Brouillon",
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-orange-100 text-orange-800",
  waiting: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  waiting: "En attente",
  resolved: "Resolu",
  closed: "Ferme",
};

// ── Skeleton loaders ──
function TableSkeleton({
  rows = 3,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: cols }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: cols }).map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DocumentListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

// ── Error state ──
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-10 h-10 text-destructive mb-3" />
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5 mr-2" />
        Reessayer
      </Button>
    </div>
  );
}

// ── Empty state ──
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Login Form ──
function PortalLoginForm({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("sent");
    setTimeout(() => onLogin(email), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Portail Client</CardTitle>
          <CardDescription>
            Acces securise a vos factures, documents et tickets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="portal-email">Adresse email</Label>
                <Input
                  id="portal-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full">
                <Mail className="w-4 h-4 mr-2" />
                Recevoir le lien de connexion
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Nous enverrons un lien magique a votre adresse email. Aucun mot
                de passe requis.
              </p>
            </form>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-medium">Lien envoye !</p>
              <p className="text-sm text-muted-foreground">
                Verifiez votre boite mail <strong>{email}</strong> et cliquez
                sur le lien de connexion.
              </p>
              <p className="text-xs text-muted-foreground">
                Redirection automatique...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Invoices Tab ──
function InvoicesTab() {
  const {
    data: invoicesResp,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["portal", "invoices"],
    queryFn: () => billingApi.listInvoices(),
  });

  const invoices: Invoice[] = invoicesResp?.data ?? [];

  if (isLoading) {
    return <TableSkeleton rows={3} cols={6} />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Impossible de charger les factures."
        onRetry={() => refetch()}
      />
    );
  }

  if (invoices.length === 0) {
    return <EmptyState message="Aucune facture pour le moment." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Numero</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Echeance</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead className="text-center">Statut</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell className="font-medium">{inv.number}</TableCell>
            <TableCell>
              {inv.issued_at
                ? new Date(inv.issued_at).toLocaleDateString("fr-FR")
                : "-"}
            </TableCell>
            <TableCell>
              {inv.due_at || inv.due_date
                ? new Date((inv.due_at || inv.due_date)!).toLocaleDateString(
                    "fr-FR",
                  )
                : "-"}
            </TableCell>
            <TableCell className="text-right font-medium">
              {(inv.amount_cents / 100).toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
              })}{" "}
              {inv.currency}
            </TableCell>
            <TableCell className="text-center">
              <Badge
                className={
                  INVOICE_STATUS_COLORS[inv.status] ??
                  "bg-gray-100 text-gray-800"
                }
              >
                {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
              </Badge>
            </TableCell>
            <TableCell>
              {inv.download_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  aria-label={`Telecharger ${inv.number}`}
                >
                  <a
                    href={inv.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Documents Tab ──
function DocumentsTab() {
  const PORTAL_BUCKET = "portal-documents";

  const {
    data: docsResp,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["portal", "documents"],
    queryFn: () => storageApi.listFiles(PORTAL_BUCKET),
  });

  const documents: PortalDocument[] = (docsResp?.data?.objects ?? []).filter(
    (obj: PortalDocument) => !obj.key.endsWith("/"),
  );

  if (isLoading) {
    return <DocumentListSkeleton />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Impossible de charger les documents."
        onRetry={() => refetch()}
      />
    );
  }

  if (documents.length === 0) {
    return <EmptyState message="Aucun document partage pour le moment." />;
  }

  function formatSize(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  function getFilename(key: string): string {
    const parts = key.split("/");
    return parts[parts.length - 1] || key;
  }

  function getFileType(contentType: string | null, key: string): string {
    if (contentType?.includes("pdf")) return "PDF";
    if (contentType?.includes("spreadsheet") || key.endsWith(".xlsx"))
      return "Excel";
    if (contentType?.includes("document") || key.endsWith(".docx"))
      return "Word";
    if (contentType?.includes("image")) return "Image";
    return "Fichier";
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.key}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {getFilename(doc.key)}
            </div>
            <div className="text-xs text-muted-foreground">
              {getFileType(doc.content_type, doc.key)} · {formatSize(doc.size)}
              {doc.last_modified &&
                ` · Partage le ${new Date(doc.last_modified).toLocaleDateString("fr-FR")}`}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const blob = await storageApi.downloadFile(
                PORTAL_BUCKET,
                doc.key,
              );
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
            }}
            aria-label={`Ouvrir ${getFilename(doc.key)}`}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Ouvrir
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Tickets Tab ──
function TicketsTab() {
  const {
    data: ticketsResp,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["portal", "tickets"],
    queryFn: () => itAssetsApi.listTickets(),
  });

  const tickets: ITTicket[] = ticketsResp?.data ?? [];

  if (isLoading) {
    return <TableSkeleton rows={3} cols={6} />;
  }

  if (isError) {
    return (
      <ErrorState
        message="Impossible de charger les tickets."
        onRetry={() => refetch()}
      />
    );
  }

  if (tickets.length === 0) {
    return <EmptyState message="Aucun ticket de support pour le moment." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Titre</TableHead>
          <TableHead>Priorite</TableHead>
          <TableHead className="text-center">Statut</TableHead>
          <TableHead>Cree le</TableHead>
          <TableHead>Mis a jour</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell className="font-mono text-sm">
              #{ticket.number}
            </TableCell>
            <TableCell className="font-medium">{ticket.title}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  ticket.priority === "critical" || ticket.priority === "high"
                    ? "border-red-300 text-red-700"
                    : ticket.priority === "medium"
                      ? "border-orange-300 text-orange-700"
                      : "border-green-300 text-green-700"
                }
              >
                {ticket.priority === "critical"
                  ? "Critique"
                  : ticket.priority === "high"
                    ? "Haute"
                    : ticket.priority === "medium"
                      ? "Moyenne"
                      : "Basse"}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              <Badge
                className={
                  TICKET_STATUS_COLORS[ticket.status] ??
                  "bg-gray-100 text-gray-800"
                }
              >
                {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(ticket.updated_at).toLocaleDateString("fr-FR")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Portal Content ──
function PortalContent({
  tenantId,
  userEmail,
}: {
  tenantId: string;
  userEmail: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                S
              </span>
            </div>
            <div>
              <div className="font-semibold text-sm">SignApps</div>
              <div className="text-xs text-muted-foreground">
                Portail Client
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{userEmail}</span>
            <Badge variant="secondary" className="text-xs">
              Connecte
            </Badge>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Bienvenue sur votre portail</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tenant: {tenantId}
          </p>
        </div>

        <Tabs defaultValue="invoices">
          <TabsList className="mb-6">
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Factures
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Tickets
            </TabsTrigger>
          </TabsList>

          {/* Factures */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Mes Factures</CardTitle>
                <CardDescription>Historique de vos factures</CardDescription>
              </CardHeader>
              <CardContent>
                <InvoicesTab />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Mes Documents</CardTitle>
                <CardDescription>
                  Documents partages par votre gestionnaire de compte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentsTab />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets */}
          <TabsContent value="tickets">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mes Tickets</CardTitle>
                    <CardDescription>
                      Suivi de vos demandes de support
                    </CardDescription>
                  </div>
                  <Button size="sm">
                    <Ticket className="w-4 h-4 mr-2" />
                    Nouveau ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TicketsTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ── Main Page ──
export default function ClientPortalPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  // Next.js 15+ — params is a Promise.
  const { tenantId } = use(params);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Check for stored portal session
    const stored = sessionStorage.getItem(`portal-session-${tenantId}`);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setUserEmail(session.email);
        setIsAuthenticated(true);
      } catch {
        /* ignore */
      }
    }
  }, [tenantId]);

  const handleLogin = (email: string) => {
    sessionStorage.setItem(
      `portal-session-${tenantId}`,
      JSON.stringify({ email, loginAt: new Date().toISOString() }),
    );
    setUserEmail(email);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <PortalLoginForm onLogin={handleLogin} />;
  }

  return <PortalContent tenantId={tenantId} userEmail={userEmail} />;
}
