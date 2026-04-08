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
import {
  FileText,
  Receipt,
  Ticket,
  LogIn,
  Mail,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

// ── Types ──
interface PortalInvoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "overdue";
}

interface PortalDocument {
  id: string;
  name: string;
  type: string;
  sharedAt: string;
  size: string;
  url?: string;
}

interface PortalTicket {
  id: string;
  title: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  priority: "high" | "medium" | "low";
}

// ── Mock data for client portal ──
const MOCK_INVOICES: PortalInvoice[] = [
  {
    id: "1",
    number: "INV-2025-001",
    date: "2025-01-15",
    dueDate: "2025-02-15",
    amount: 1200,
    currency: "EUR",
    status: "paid",
  },
  {
    id: "2",
    number: "INV-2025-002",
    date: "2025-02-15",
    dueDate: "2025-03-15",
    amount: 850,
    currency: "EUR",
    status: "pending",
  },
  {
    id: "3",
    number: "INV-2025-003",
    date: "2025-03-01",
    dueDate: "2025-03-31",
    amount: 2300,
    currency: "EUR",
    status: "overdue",
  },
];

const MOCK_DOCUMENTS: PortalDocument[] = [
  {
    id: "1",
    name: "Contrat de service 2025.pdf",
    type: "PDF",
    sharedAt: "2025-01-10",
    size: "2.3 MB",
  },
  {
    id: "2",
    name: "Conditions generales.pdf",
    type: "PDF",
    sharedAt: "2025-01-10",
    size: "450 KB",
  },
  {
    id: "3",
    name: "Rapport mensuel Fevrier.xlsx",
    type: "Excel",
    sharedAt: "2025-03-01",
    size: "1.1 MB",
  },
];

const MOCK_TICKETS: PortalTicket[] = [
  {
    id: "TKT-001",
    title: "Probleme de connexion",
    status: "resolved",
    createdAt: "2025-02-20",
    updatedAt: "2025-02-22",
    priority: "high",
  },
  {
    id: "TKT-002",
    title: "Demande d'information facturation",
    status: "in-progress",
    createdAt: "2025-03-10",
    updatedAt: "2025-03-12",
    priority: "medium",
  },
  {
    id: "TKT-003",
    title: "Nouvelle fonctionnalite requise",
    status: "open",
    createdAt: "2025-03-25",
    updatedAt: "2025-03-25",
    priority: "low",
  },
];

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-800",
  open: "bg-blue-100 text-blue-800",
  "in-progress": "bg-orange-100 text-orange-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Paye",
  pending: "En attente",
  overdue: "En retard",
  open: "Ouvert",
  "in-progress": "En cours",
  resolved: "Resolu",
  closed: "Ferme",
};

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
                    {MOCK_INVOICES.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.number}
                        </TableCell>
                        <TableCell>
                          {new Date(inv.date).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {inv.amount.toLocaleString("fr-FR")} {inv.currency}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={STATUS_COLORS[inv.status]}>
                            {STATUS_LABELS[inv.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Telecharger ${inv.number}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <div className="space-y-3">
                  {MOCK_DOCUMENTS.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {doc.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {doc.type} · {doc.size} · Partage le{" "}
                          {new Date(doc.sharedAt).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Ouvrir ${doc.name}`}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Ouvrir
                      </Button>
                    </div>
                  ))}
                </div>
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
                    {MOCK_TICKETS.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-sm">
                          {ticket.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {ticket.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              ticket.priority === "high"
                                ? "border-red-300 text-red-700"
                                : ticket.priority === "medium"
                                  ? "border-orange-300 text-orange-700"
                                  : "border-green-300 text-green-700"
                            }
                          >
                            {ticket.priority === "high"
                              ? "Haute"
                              : ticket.priority === "medium"
                                ? "Moyenne"
                                : "Basse"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={STATUS_COLORS[ticket.status]}>
                            {STATUS_LABELS[ticket.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(ticket.createdAt).toLocaleDateString(
                            "fr-FR",
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(ticket.updatedAt).toLocaleDateString(
                            "fr-FR",
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
