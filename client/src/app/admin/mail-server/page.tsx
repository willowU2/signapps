"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { getClient, ServiceName } from "@/lib/api/factory";
import { toast } from "sonner";
import {
  Server,
  Globe,
  Users,
  Mail,
  Shield,
  Clock,
  Trash2,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileText,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Domain {
  id: string;
  name: string;
  dkim_enabled: boolean;
  verified: boolean;
  created_at: string;
}

interface DnsRecord {
  record_type: string;
  name: string;
  value: string;
  priority?: number;
}

interface Account {
  id: string;
  domain_id: string;
  address: string;
  display_name: string;
  created_at: string;
}

interface AccountQuota {
  used_bytes: number;
  total_bytes: number;
}

interface QueueStats {
  total: number;
  pending: number;
  deferred: number;
  failed: number;
  delivered: number;
}

interface QueueEntry {
  id: string;
  from: string;
  to: string;
  subject: string;
  status: string;
  created_at: string;
  next_retry?: string;
}

interface SieveScript {
  name: string;
  active: boolean;
  content?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const api = () => getClient(ServiceName.MAIL);

// --- Domains ---
async function fetchDomains(): Promise<Domain[]> {
  const { data } = await api().get("/mailserver/domains");
  return data.domains ?? data ?? [];
}

async function createDomain(name: string): Promise<Domain> {
  const { data } = await api().post("/mailserver/domains", { name });
  return data;
}

async function deleteDomain(id: string): Promise<void> {
  await api().delete(`/mailserver/domains/${id}`);
}

async function fetchDnsRecords(domainId: string): Promise<DnsRecord[]> {
  const { data } = await api().get(
    `/mailserver/domains/${domainId}/dns-records`,
  );
  return data.records ?? data ?? [];
}

async function verifyDns(
  domainId: string,
): Promise<{ verified: boolean; results?: Record<string, boolean> }> {
  const { data } = await api().post(
    `/mailserver/domains/${domainId}/verify-dns`,
  );
  return data;
}

// --- Accounts ---
async function fetchAccounts(): Promise<Account[]> {
  const { data } = await api().get("/mailserver/accounts");
  return data.accounts ?? data ?? [];
}

async function createAccount(payload: {
  domain_id: string;
  address: string;
  display_name: string;
  password: string;
}): Promise<Account> {
  const { data } = await api().post("/mailserver/accounts", payload);
  return data;
}

async function deleteAccount(id: string): Promise<void> {
  await api().delete(`/mailserver/accounts/${id}`);
}

async function fetchAccountQuota(id: string): Promise<AccountQuota> {
  const { data } = await api().get(`/mailserver/accounts/${id}/quota`);
  return data;
}

// --- Queue ---
async function fetchQueueStats(): Promise<QueueStats> {
  const { data } = await api().get("/mailserver/queue/stats");
  return data;
}

async function fetchQueue(): Promise<QueueEntry[]> {
  const { data } = await api().get("/mailserver/queue");
  return data.entries ?? data ?? [];
}

async function retryQueueEntry(id: string): Promise<void> {
  await api().post(`/mailserver/queue/${id}/retry`);
}

// --- Sieve ---
async function fetchSieveScripts(accountId: string): Promise<SieveScript[]> {
  const { data } = await api().get(`/mailserver/sieve/${accountId}`);
  return data.scripts ?? data ?? [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MailServerPage() {
  usePageTitle("Serveur Mail");

  // State
  const [domains, setDomains] = useState<Domain[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [quotas, setQuotas] = useState<Record<string, AccountQuota>>({});
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Domain dialog
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [creatingDomain, setCreatingDomain] = useState(false);

  // DNS records expand
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<Record<string, DnsRecord[]>>({});
  const [verifyingDns, setVerifyingDns] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Account dialog
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [newAccountAddress, setNewAccountAddress] = useState("");
  const [newAccountDisplayName, setNewAccountDisplayName] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountDomainId, setNewAccountDomainId] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Sieve
  const [sieveOpen, setSieveOpen] = useState(false);
  const [sieveAccountId, setSieveAccountId] = useState("");
  const [sieveScripts, setSieveScripts] = useState<SieveScript[]>([]);
  const [loadingSieve, setLoadingSieve] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a, qs, q] = await Promise.all([
        fetchDomains().catch(() => []),
        fetchAccounts().catch(() => []),
        fetchQueueStats().catch(() => null),
        fetchQueue().catch(() => []),
      ]);
      setDomains(d);
      setAccounts(a);
      setQueueStats(qs);
      setQueueEntries(q);

      // Fetch quotas for all accounts
      const quotaMap: Record<string, AccountQuota> = {};
      await Promise.all(
        a.map(async (acc) => {
          try {
            quotaMap[acc.id] = await fetchAccountQuota(acc.id);
          } catch {
            // quota not available
          }
        }),
      );
      setQuotas(quotaMap);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de chargement";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreateDomain = async () => {
    if (!newDomainName.trim()) return;
    setCreatingDomain(true);
    try {
      await createDomain(newDomainName.trim());
      toast.success(`Domaine "${newDomainName.trim()}" ajouté avec succès`);
      setNewDomainName("");
      setDomainDialogOpen(false);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création";
      toast.error(msg);
    } finally {
      setCreatingDomain(false);
    }
  };

  const handleDeleteDomain = async (domain: Domain) => {
    if (!confirm(`Supprimer le domaine "${domain.name}" et tous ses comptes ?`))
      return;
    try {
      await deleteDomain(domain.id);
      toast.success(`Domaine "${domain.name}" supprimé`);
      await refresh();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Erreur lors de la suppression";
      toast.error(msg);
    }
  };

  const handleToggleDns = async (domainId: string) => {
    if (expandedDomain === domainId) {
      setExpandedDomain(null);
      return;
    }
    setExpandedDomain(domainId);
    if (!dnsRecords[domainId]) {
      try {
        const records = await fetchDnsRecords(domainId);
        setDnsRecords((prev) => ({ ...prev, [domainId]: records }));
      } catch {
        toast.error("Impossible de charger les enregistrements DNS");
      }
    }
  };

  const handleVerifyDns = async (domainId: string) => {
    setVerifyingDns(domainId);
    try {
      const result = await verifyDns(domainId);
      if (result.verified) {
        toast.success("DNS vérifié avec succès !");
      } else {
        toast.error(
          "La vérification DNS a échoué. Vérifiez vos enregistrements.",
        );
      }
      await refresh();
    } catch {
      toast.error("Erreur lors de la vérification DNS");
    } finally {
      setVerifyingDns(null);
    }
  };

  const handleCopyDns = async (value: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Impossible de copier dans le presse-papiers");
    }
  };

  const handleCreateAccount = async () => {
    if (
      !newAccountAddress.trim() ||
      !newAccountPassword.trim() ||
      !newAccountDomainId
    )
      return;
    setCreatingAccount(true);
    try {
      await createAccount({
        domain_id: newAccountDomainId,
        address: newAccountAddress.trim(),
        display_name: newAccountDisplayName.trim() || newAccountAddress.trim(),
        password: newAccountPassword,
      });
      toast.success(`Compte "${newAccountAddress.trim()}" créé avec succès`);
      setNewAccountAddress("");
      setNewAccountDisplayName("");
      setNewAccountPassword("");
      setNewAccountDomainId("");
      setAccountDialogOpen(false);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création";
      toast.error(msg);
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    if (!confirm(`Supprimer le compte "${account.address}" ?`)) return;
    try {
      await deleteAccount(account.id);
      toast.success(`Compte "${account.address}" supprimé`);
      await refresh();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Erreur lors de la suppression";
      toast.error(msg);
    }
  };

  const handleRetryQueue = async (entryId: string) => {
    try {
      await retryQueueEntry(entryId);
      toast.success("Relance programmée");
      await refresh();
    } catch {
      toast.error("Erreur lors de la relance");
    }
  };

  const handleLoadSieve = async (accountId: string) => {
    if (!accountId) return;
    setSieveAccountId(accountId);
    setLoadingSieve(true);
    try {
      const scripts = await fetchSieveScripts(accountId);
      setSieveScripts(scripts);
    } catch {
      toast.error("Impossible de charger les scripts Sieve");
      setSieveScripts([]);
    } finally {
      setLoadingSieve(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Ports config
  // ---------------------------------------------------------------------------

  const ports = [
    { name: "SMTP", port: 25, icon: Mail },
    { name: "Submission", port: 587, icon: Mail },
    { name: "IMAP", port: 993, icon: Mail },
    { name: "JMAP", port: 3012, icon: Server },
    { name: "ManageSieve", port: 4190, icon: Shield },
    { name: "CalDAV", port: 8443, icon: Clock },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <PageHeader
          title="Serveur Mail Interne"
          description="Gestion du serveur mail natif SignApps"
          icon={<Mail className="h-5 w-5" />}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
          }
        />

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* 1. Server Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Statut du serveur
            </CardTitle>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Actif
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-sm">
              {ports.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <p.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{p.name}</p>
                    <p className="font-mono text-xs font-medium">{p.port}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 2. Domains Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              Domaines
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{domains.length}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDomainDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un domaine
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {domains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun domaine configuré. Ajoutez un domaine pour commencer.
              </p>
            ) : (
              <div className="space-y-3">
                {domains.map((domain) => (
                  <div key={domain.id} className="rounded-lg border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-medium">
                          {domain.name}
                        </span>
                        {domain.dkim_enabled && (
                          <Badge
                            variant="outline"
                            className="text-xs border-blue-500/30 text-blue-600"
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            DKIM
                          </Badge>
                        )}
                        {domain.verified ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Vérifié
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-500/30 text-amber-600"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Non vérifié
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleDns(domain.id)}
                        >
                          DNS
                          <ChevronDown
                            className={`h-4 w-4 ml-1 transition-transform ${expandedDomain === domain.id ? "rotate-180" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerifyDns(domain.id)}
                          disabled={verifyingDns === domain.id}
                        >
                          {verifyingDns === domain.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteDomain(domain)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* DNS Records */}
                    {expandedDomain === domain.id && (
                      <div className="border-t px-4 py-3 bg-muted/30">
                        {dnsRecords[domain.id] ? (
                          dnsRecords[domain.id].length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Aucun enregistrement DNS requis.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground font-medium mb-2">
                                Enregistrements DNS requis :
                              </p>
                              {dnsRecords[domain.id].map((record, idx) => {
                                const fieldId = `${domain.id}-${idx}`;
                                return (
                                  <div
                                    key={fieldId}
                                    className="flex items-start justify-between gap-2 rounded border bg-card p-2"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] font-mono"
                                        >
                                          {record.record_type}
                                        </Badge>
                                        {record.priority !== undefined && (
                                          <span className="text-[10px] text-muted-foreground">
                                            Priorité: {record.priority}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs font-mono text-muted-foreground truncate">
                                        {record.name}
                                      </p>
                                      <pre className="text-xs font-mono mt-1 whitespace-pre-wrap break-all bg-muted/50 rounded p-1.5">
                                        {record.value}
                                      </pre>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="shrink-0 h-7 w-7 p-0"
                                      onClick={() =>
                                        handleCopyDns(record.value, fieldId)
                                      }
                                    >
                                      {copiedField === fieldId ? (
                                        <Check className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Chargement...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Accounts Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Comptes mail
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{accounts.length}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (domains.length > 0) {
                    setNewAccountDomainId(domains[0].id);
                  }
                  setAccountDialogOpen(true);
                }}
                disabled={domains.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Créer un compte
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {domains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ajoutez d&apos;abord un domaine avant de créer des comptes.
              </p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun compte mail configuré.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => {
                  const quota = quotas[account.id];
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">
                            {account.address}
                          </p>
                          <div className="flex items-center gap-2">
                            {account.display_name &&
                              account.display_name !== account.address && (
                                <p className="text-xs text-muted-foreground">
                                  {account.display_name}
                                </p>
                              )}
                            {quota && (
                              <p className="text-xs text-muted-foreground">
                                {formatBytes(quota.used_bytes)} /{" "}
                                {formatBytes(quota.total_bytes)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteAccount(account)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Queue Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              File d&apos;attente
            </CardTitle>
            {queueStats && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{queueStats.total} total</Badge>
                {queueStats.pending > 0 && (
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
                    {queueStats.pending} en attente
                  </Badge>
                )}
                {queueStats.deferred > 0 && (
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                    {queueStats.deferred} différés
                  </Badge>
                )}
                {queueStats.failed > 0 && (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
                    {queueStats.failed} échoués
                  </Badge>
                )}
                {queueStats.delivered > 0 && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                    {queueStats.delivered} livrés
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {queueEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                La file d&apos;attente est vide.
              </p>
            ) : (
              <div className="space-y-2">
                {queueEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {entry.subject || "(sans sujet)"}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            entry.status === "failed"
                              ? "border-red-500/30 text-red-600"
                              : entry.status === "deferred"
                                ? "border-amber-500/30 text-amber-600"
                                : "border-blue-500/30 text-blue-600"
                          }`}
                        >
                          {entry.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.from} &rarr; {entry.to}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetryQueue(entry.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Sieve Scripts Card (collapsed by default) */}
        <Collapsible open={sieveOpen} onOpenChange={setSieveOpen}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-sm font-medium hover:underline">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Scripts Sieve
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${sieveOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">
                      Sélectionner un compte
                    </Label>
                    <Select
                      value={sieveAccountId}
                      onValueChange={(val) => handleLoadSieve(val)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choisir un compte..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loadingSieve && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement...
                  </div>
                )}

                {!loadingSieve &&
                  sieveAccountId &&
                  sieveScripts.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Aucun script Sieve pour ce compte.
                    </p>
                  )}

                {!loadingSieve && sieveScripts.length > 0 && (
                  <div className="space-y-2">
                    {sieveScripts.map((script) => (
                      <div
                        key={script.name}
                        className="rounded-lg border px-4 py-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {script.name}
                          </span>
                          {script.active && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                              Actif
                            </Badge>
                          )}
                        </div>
                        {script.content && (
                          <pre className="text-xs font-mono bg-muted/50 rounded p-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                            {script.content}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Domain Dialog */}
      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un domaine</DialogTitle>
            <DialogDescription>
              Le domaine sera configuré avec une clé DKIM générée
              automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="domain-name">Nom de domaine</Label>
              <Input
                id="domain-name"
                placeholder="exemple.com"
                value={newDomainName}
                onChange={(e) => setNewDomainName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateDomain()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDomainDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateDomain}
              disabled={creatingDomain || !newDomainName.trim()}
            >
              {creatingDomain ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte mail</DialogTitle>
            <DialogDescription>
              Créer un nouveau compte sur un domaine configuré.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="account-domain">Domaine</Label>
              <Select
                value={newAccountDomainId}
                onValueChange={setNewAccountDomainId}
              >
                <SelectTrigger id="account-domain" className="mt-1">
                  <SelectValue placeholder="Sélectionner un domaine..." />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account-address">Adresse email</Label>
              <Input
                id="account-address"
                placeholder="alice@exemple.com"
                value={newAccountAddress}
                onChange={(e) => setNewAccountAddress(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="account-display-name">Nom affiché</Label>
              <Input
                id="account-display-name"
                placeholder="Alice Dupont"
                value={newAccountDisplayName}
                onChange={(e) => setNewAccountDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="account-password">Mot de passe</Label>
              <Input
                id="account-password"
                type="password"
                placeholder="Mot de passe IMAP/SMTP"
                value={newAccountPassword}
                onChange={(e) => setNewAccountPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAccountDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateAccount}
              disabled={
                creatingAccount ||
                !newAccountAddress.trim() ||
                !newAccountPassword.trim() ||
                !newAccountDomainId
              }
            >
              {creatingAccount ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer le compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
