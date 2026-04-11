"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { getClient, ServiceName } from "@/lib/api/factory";
import {
  namingRulesApi,
  distListsApi,
  sharedMailboxesApi,
  type NamingRule,
  type DistributionList,
  type DistListMember,
  type SharedMailbox,
  type SharedMailboxMember,
} from "@/lib/api/mailserver";
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
  BookOpen,
  Inbox,
  UserPlus,
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

  // Naming Rules
  const [namingRules, setNamingRules] = useState<NamingRule[]>([]);
  const [loadingNamingRules, setLoadingNamingRules] = useState(false);
  const [namingRulesError, setNamingRulesError] = useState<string | null>(null);
  const [namingRuleDialogOpen, setNamingRuleDialogOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const [newRuleTemplate, setNewRuleTemplate] = useState("");
  const [newRulePriority, setNewRulePriority] = useState("0");
  const [creatingNamingRule, setCreatingNamingRule] = useState(false);

  // Distribution Lists
  const [distLists, setDistLists] = useState<DistributionList[]>([]);
  const [loadingDistLists, setLoadingDistLists] = useState(false);
  const [distListsError, setDistListsError] = useState<string | null>(null);
  const [distListDialogOpen, setDistListDialogOpen] = useState(false);
  const [newDistEmail, setNewDistEmail] = useState("");
  const [newDistDisplayName, setNewDistDisplayName] = useState("");
  const [newDistDescription, setNewDistDescription] = useState("");
  const [newDistOrgWide, setNewDistOrgWide] = useState(false);
  const [creatingDistList, setCreatingDistList] = useState(false);
  const [expandedDistList, setExpandedDistList] = useState<string | null>(null);
  const [distListMembers, setDistListMembers] = useState<
    Record<string, DistListMember[]>
  >({});

  // Shared Mailboxes
  const [sharedMailboxes, setSharedMailboxes] = useState<SharedMailbox[]>([]);
  const [loadingSharedMailboxes, setLoadingSharedMailboxes] = useState(false);
  const [sharedMailboxesError, setSharedMailboxesError] = useState<
    string | null
  >(null);
  const [sharedMailboxDialogOpen, setSharedMailboxDialogOpen] = useState(false);
  const [newMbxEmail, setNewMbxEmail] = useState("");
  const [newMbxDisplayName, setNewMbxDisplayName] = useState("");
  const [newMbxDescription, setNewMbxDescription] = useState("");
  const [newMbxType, setNewMbxType] = useState<"shared" | "equipment" | "room">(
    "shared",
  );
  const [creatingSharedMailbox, setCreatingSharedMailbox] = useState(false);
  const [expandedMailbox, setExpandedMailbox] = useState<string | null>(null);
  const [mailboxMembers, setMailboxMembers] = useState<
    Record<string, SharedMailboxMember[]>
  >({});
  const [addMemberMailboxId, setAddMemberMailboxId] = useState<string | null>(
    null,
  );
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<
    "owner" | "editor" | "reviewer" | "viewer"
  >("viewer");
  const [addingMember, setAddingMember] = useState(false);

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
  // Naming Rules fetching & actions
  // ---------------------------------------------------------------------------

  const loadNamingRules = useCallback(async () => {
    setLoadingNamingRules(true);
    setNamingRulesError(null);
    try {
      const { data } = await namingRulesApi.list();
      setNamingRules(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setNamingRulesError(
        e instanceof Error ? e.message : "Erreur de chargement",
      );
    } finally {
      setLoadingNamingRules(false);
    }
  }, []);

  useEffect(() => {
    loadNamingRules();
  }, [loadNamingRules]);

  const handleCreateNamingRule = async () => {
    if (!newRuleName.trim() || !newRuleTemplate.trim()) return;
    setCreatingNamingRule(true);
    try {
      await namingRulesApi.create({
        rule_name: newRuleName.trim(),
        description: newRuleDescription.trim() || undefined,
        template: newRuleTemplate.trim(),
        priority: parseInt(newRulePriority, 10) || 0,
      });
      toast.success(`Règle "${newRuleName.trim()}" créée`);
      setNewRuleName("");
      setNewRuleDescription("");
      setNewRuleTemplate("");
      setNewRulePriority("0");
      setNamingRuleDialogOpen(false);
      await loadNamingRules();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la création",
      );
    } finally {
      setCreatingNamingRule(false);
    }
  };

  const handleDeleteNamingRule = async (rule: NamingRule) => {
    if (!confirm(`Supprimer la règle "${rule.rule_name}" ?`)) return;
    try {
      await namingRulesApi.delete(rule.id);
      toast.success(`Règle "${rule.rule_name}" supprimée`);
      await loadNamingRules();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la suppression",
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Distribution Lists fetching & actions
  // ---------------------------------------------------------------------------

  const loadDistLists = useCallback(async () => {
    setLoadingDistLists(true);
    setDistListsError(null);
    try {
      const { data } = await distListsApi.list();
      setDistLists(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setDistListsError(
        e instanceof Error ? e.message : "Erreur de chargement",
      );
    } finally {
      setLoadingDistLists(false);
    }
  }, []);

  useEffect(() => {
    loadDistLists();
  }, [loadDistLists]);

  const handleCreateDistList = async () => {
    if (!newDistEmail.trim() || !newDistDisplayName.trim()) return;
    setCreatingDistList(true);
    try {
      await distListsApi.create({
        email: newDistEmail.trim(),
        display_name: newDistDisplayName.trim(),
        description: newDistDescription.trim() || undefined,
        is_org_wide: newDistOrgWide,
      });
      toast.success(`Liste "${newDistDisplayName.trim()}" créée`);
      setNewDistEmail("");
      setNewDistDisplayName("");
      setNewDistDescription("");
      setNewDistOrgWide(false);
      setDistListDialogOpen(false);
      await loadDistLists();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la création",
      );
    } finally {
      setCreatingDistList(false);
    }
  };

  const handleDeleteDistList = async (list: DistributionList) => {
    if (!confirm(`Supprimer la liste "${list.display_name}" ?`)) return;
    try {
      await distListsApi.delete(list.id);
      toast.success(`Liste "${list.display_name}" supprimée`);
      await loadDistLists();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la suppression",
      );
    }
  };

  const handleToggleDistList = async (id: string) => {
    if (expandedDistList === id) {
      setExpandedDistList(null);
      return;
    }
    setExpandedDistList(id);
    if (!distListMembers[id]) {
      try {
        const { data } = await distListsApi.getMembers(id);
        setDistListMembers((prev) => ({
          ...prev,
          [id]: Array.isArray(data) ? data : [],
        }));
      } catch {
        toast.error("Impossible de charger les membres");
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Shared Mailboxes fetching & actions
  // ---------------------------------------------------------------------------

  const loadSharedMailboxes = useCallback(async () => {
    setLoadingSharedMailboxes(true);
    setSharedMailboxesError(null);
    try {
      const { data } = await sharedMailboxesApi.list();
      setSharedMailboxes(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setSharedMailboxesError(
        e instanceof Error ? e.message : "Erreur de chargement",
      );
    } finally {
      setLoadingSharedMailboxes(false);
    }
  }, []);

  useEffect(() => {
    loadSharedMailboxes();
  }, [loadSharedMailboxes]);

  const handleCreateSharedMailbox = async () => {
    if (!newMbxEmail.trim() || !newMbxDisplayName.trim()) return;
    setCreatingSharedMailbox(true);
    try {
      await sharedMailboxesApi.create({
        email: newMbxEmail.trim(),
        display_name: newMbxDisplayName.trim(),
        description: newMbxDescription.trim() || undefined,
        mailbox_type: newMbxType,
      });
      toast.success(`Boîte "${newMbxDisplayName.trim()}" créée`);
      setNewMbxEmail("");
      setNewMbxDisplayName("");
      setNewMbxDescription("");
      setNewMbxType("shared");
      setSharedMailboxDialogOpen(false);
      await loadSharedMailboxes();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la création",
      );
    } finally {
      setCreatingSharedMailbox(false);
    }
  };

  const handleDeleteSharedMailbox = async (mbx: SharedMailbox) => {
    if (!confirm(`Supprimer la boîte "${mbx.display_name}" ?`)) return;
    try {
      await sharedMailboxesApi.delete(mbx.id);
      toast.success(`Boîte "${mbx.display_name}" supprimée`);
      await loadSharedMailboxes();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la suppression",
      );
    }
  };

  const handleToggleMailbox = async (id: string) => {
    if (expandedMailbox === id) {
      setExpandedMailbox(null);
      return;
    }
    setExpandedMailbox(id);
    if (!mailboxMembers[id]) {
      try {
        // Re-use list endpoint for now; members are refreshed after add/remove
        setMailboxMembers((prev) => ({ ...prev, [id]: [] }));
      } catch {
        toast.error("Impossible de charger les membres");
      }
    }
  };

  const handleAddMailboxMember = async () => {
    if (!addMemberMailboxId || !newMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      const { data: member } = await sharedMailboxesApi.addMember(
        addMemberMailboxId,
        {
          member_email: newMemberEmail.trim(),
          permission_level: newMemberRole,
        },
      );
      setMailboxMembers((prev) => ({
        ...prev,
        [addMemberMailboxId]: [...(prev[addMemberMailboxId] ?? []), member],
      }));
      toast.success(`Membre "${newMemberEmail.trim()}" ajouté`);
      setNewMemberEmail("");
      setNewMemberRole("viewer");
      setAddMemberMailboxId(null);
      await loadSharedMailboxes();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'ajout");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMailboxMember = async (
    mailboxId: string,
    memberId: string,
  ) => {
    try {
      await sharedMailboxesApi.removeMember(mailboxId, memberId);
      setMailboxMembers((prev) => ({
        ...prev,
        [mailboxId]: (prev[mailboxId] ?? []).filter((m) => m.id !== memberId),
      }));
      toast.success("Membre retiré");
      await loadSharedMailboxes();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erreur lors de la suppression",
      );
    }
  };

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

  if (loading && domains.length === 0 && accounts.length === 0) {
    return (
      <AppLayout>
        <div className="w-full space-y-6">
          <PageHeader
            title="Serveur Mail Interne"
            description="Gestion du serveur mail natif SignApps"
            icon={<Mail className="h-5 w-5" />}
          />
          <LoadingState variant="skeleton" />
        </div>
      </AppLayout>
    );
  }

  if (error && domains.length === 0 && accounts.length === 0) {
    return (
      <AppLayout>
        <div className="w-full space-y-6">
          <PageHeader
            title="Serveur Mail Interne"
            description="Gestion du serveur mail natif SignApps"
            icon={<Mail className="h-5 w-5" />}
          />
          <ErrorState
            title="Impossible de charger la configuration mail"
            message={error}
            onRetry={refresh}
          />
        </div>
      </AppLayout>
    );
  }

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

        {/* 6. Naming Rules Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              Règles de nommage
            </CardTitle>
            <div className="flex items-center gap-2">
              {loadingNamingRules && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Badge variant="outline">{namingRules.length}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNamingRuleDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle règle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {namingRulesError ? (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive flex-1">
                  {namingRulesError}
                </p>
                <Button size="sm" variant="ghost" onClick={loadNamingRules}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            ) : loadingNamingRules && namingRules.length === 0 ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg bg-muted/50 animate-pulse"
                  />
                ))}
              </div>
            ) : namingRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune règle de nommage. Les règles définissent le format des
                adresses générées automatiquement.
              </p>
            ) : (
              <div className="space-y-2">
                {namingRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium">{rule.rule_name}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs ${rule.enabled ? "border-emerald-500/30 text-emerald-600" : "border-muted-foreground/30 text-muted-foreground"}`}
                        >
                          {rule.enabled ? "Actif" : "Inactif"}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono">
                          P{rule.priority}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {rule.template}
                      </p>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rule.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleDeleteNamingRule(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. Distribution Lists Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              Listes de distribution
            </CardTitle>
            <div className="flex items-center gap-2">
              {loadingDistLists && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Badge variant="outline">{distLists.length}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDistListDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle liste
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {distListsError ? (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive flex-1">
                  {distListsError}
                </p>
                <Button size="sm" variant="ghost" onClick={loadDistLists}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            ) : loadingDistLists && distLists.length === 0 ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg bg-muted/50 animate-pulse"
                  />
                ))}
              </div>
            ) : distLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune liste de distribution configurée.
              </p>
            ) : (
              <div className="space-y-2">
                {distLists.map((list) => (
                  <div key={list.id} className="rounded-lg border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium font-mono">
                              {list.email}
                            </p>
                            {list.is_org_wide ? (
                              <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/30 text-xs">
                                Org
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Manuel
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {list.display_name}
                            {list.description ? ` — ${list.description}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs mr-1">
                          {list.member_count} membre
                          {list.member_count !== 1 ? "s" : ""}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleDistList(list.id)}
                        >
                          Membres
                          <ChevronDown
                            className={`h-4 w-4 ml-1 transition-transform ${expandedDistList === list.id ? "rotate-180" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteDistList(list)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedDistList === list.id && (
                      <div className="border-t px-4 py-3 bg-muted/30">
                        {distListMembers[list.id] === undefined ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Chargement des membres...
                          </div>
                        ) : distListMembers[list.id].length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Aucun membre dans cette liste.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {distListMembers[list.id].map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono">
                                  {m.member_email}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {m.member_type}
                                </Badge>
                              </div>
                            ))}
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

        {/* 8. Shared Mailboxes Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Inbox className="h-4 w-4 text-amber-500" />
              Boîtes partagées
            </CardTitle>
            <div className="flex items-center gap-2">
              {loadingSharedMailboxes && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Badge variant="outline">{sharedMailboxes.length}</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSharedMailboxDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle boîte
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sharedMailboxesError ? (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive flex-1">
                  {sharedMailboxesError}
                </p>
                <Button size="sm" variant="ghost" onClick={loadSharedMailboxes}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            ) : loadingSharedMailboxes && sharedMailboxes.length === 0 ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg bg-muted/50 animate-pulse"
                  />
                ))}
              </div>
            ) : sharedMailboxes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune boîte partagée configurée.
              </p>
            ) : (
              <div className="space-y-2">
                {sharedMailboxes.map((mbx) => (
                  <div key={mbx.id} className="rounded-lg border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Inbox className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium font-mono">
                              {mbx.email}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                mbx.mailbox_type === "room"
                                  ? "border-blue-500/30 text-blue-600"
                                  : mbx.mailbox_type === "equipment"
                                    ? "border-amber-500/30 text-amber-600"
                                    : "border-emerald-500/30 text-emerald-600"
                              }`}
                            >
                              {mbx.mailbox_type === "shared"
                                ? "Partagée"
                                : mbx.mailbox_type === "room"
                                  ? "Salle"
                                  : "Équipement"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {mbx.display_name}
                            {mbx.description ? ` — ${mbx.description}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs mr-1">
                          {mbx.member_count} membre
                          {mbx.member_count !== 1 ? "s" : ""}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleMailbox(mbx.id)}
                        >
                          Membres
                          <ChevronDown
                            className={`h-4 w-4 ml-1 transition-transform ${expandedMailbox === mbx.id ? "rotate-180" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteSharedMailbox(mbx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedMailbox === mbx.id && (
                      <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                        {(mailboxMembers[mbx.id] ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Aucun membre dans cette boîte.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {(mailboxMembers[mbx.id] ?? []).map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-mono">
                                    {m.member_email}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      m.permission_level === "owner"
                                        ? "border-amber-500/30 text-amber-600"
                                        : m.permission_level === "editor"
                                          ? "border-blue-500/30 text-blue-600"
                                          : m.permission_level === "reviewer"
                                            ? "border-violet-500/30 text-violet-600"
                                            : "border-muted-foreground/30 text-muted-foreground"
                                    }`}
                                  >
                                    {m.permission_level}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                  onClick={() =>
                                    handleRemoveMailboxMember(mbx.id, m.id)
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setAddMemberMailboxId(mbx.id)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Ajouter un membre
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
      {/* Naming Rule Dialog */}
      <Dialog
        open={namingRuleDialogOpen}
        onOpenChange={setNamingRuleDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle règle de nommage</DialogTitle>
            <DialogDescription>
              Définissez un template pour générer automatiquement des adresses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="rule-name">Nom de la règle</Label>
              <Input
                id="rule-name"
                placeholder="ex: Adresse département"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rule-template">Template</Label>
              <Input
                id="rule-template"
                placeholder="{prenom}.{nom}@{domaine}"
                value={newRuleTemplate}
                onChange={(e) => setNewRuleTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variables disponibles :{" "}
                <code className="font-mono">{"{prenom}"}</code>,{" "}
                <code className="font-mono">{"{nom}"}</code>,{" "}
                <code className="font-mono">{"{domaine}"}</code>,{" "}
                <code className="font-mono">{"{dept}"}</code>
              </p>
            </div>
            <div>
              <Label htmlFor="rule-description">Description (optionnel)</Label>
              <Input
                id="rule-description"
                placeholder="Décrivez l'usage de cette règle"
                value={newRuleDescription}
                onChange={(e) => setNewRuleDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rule-priority">Priorité</Label>
              <Input
                id="rule-priority"
                type="number"
                placeholder="0"
                value={newRulePriority}
                onChange={(e) => setNewRulePriority(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNamingRuleDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateNamingRule}
              disabled={
                creatingNamingRule ||
                !newRuleName.trim() ||
                !newRuleTemplate.trim()
              }
            >
              {creatingNamingRule ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer la règle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribution List Dialog */}
      <Dialog open={distListDialogOpen} onOpenChange={setDistListDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle liste de distribution</DialogTitle>
            <DialogDescription>
              Créer une liste d&apos;adresses pour distribuer les emails à
              plusieurs destinataires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="dist-email">Adresse email</Label>
              <Input
                id="dist-email"
                placeholder="equipe@exemple.com"
                value={newDistEmail}
                onChange={(e) => setNewDistEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dist-display-name">Nom affiché</Label>
              <Input
                id="dist-display-name"
                placeholder="Équipe Technique"
                value={newDistDisplayName}
                onChange={(e) => setNewDistDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dist-description">Description (optionnel)</Label>
              <Input
                id="dist-description"
                placeholder="Description de la liste"
                value={newDistDescription}
                onChange={(e) => setNewDistDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Organisation entière</p>
                <p className="text-xs text-muted-foreground">
                  Inclure automatiquement tous les membres de
                  l&apos;organisation
                </p>
              </div>
              <Switch
                checked={newDistOrgWide}
                onCheckedChange={setNewDistOrgWide}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDistListDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateDistList}
              disabled={
                creatingDistList ||
                !newDistEmail.trim() ||
                !newDistDisplayName.trim()
              }
            >
              {creatingDistList ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer la liste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared Mailbox Dialog */}
      <Dialog
        open={sharedMailboxDialogOpen}
        onOpenChange={setSharedMailboxDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle boîte partagée</DialogTitle>
            <DialogDescription>
              Créer une boîte mail accessible par plusieurs utilisateurs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="mbx-email">Adresse email</Label>
              <Input
                id="mbx-email"
                placeholder="contact@exemple.com"
                value={newMbxEmail}
                onChange={(e) => setNewMbxEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mbx-display-name">Nom affiché</Label>
              <Input
                id="mbx-display-name"
                placeholder="Service Client"
                value={newMbxDisplayName}
                onChange={(e) => setNewMbxDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mbx-description">Description (optionnel)</Label>
              <Input
                id="mbx-description"
                placeholder="Description de la boîte"
                value={newMbxDescription}
                onChange={(e) => setNewMbxDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mbx-type">Type de boîte</Label>
              <Select
                value={newMbxType}
                onValueChange={(v) => setNewMbxType(v as typeof newMbxType)}
              >
                <SelectTrigger id="mbx-type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Partagée</SelectItem>
                  <SelectItem value="room">Salle de réunion</SelectItem>
                  <SelectItem value="equipment">Équipement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSharedMailboxDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateSharedMailbox}
              disabled={
                creatingSharedMailbox ||
                !newMbxEmail.trim() ||
                !newMbxDisplayName.trim()
              }
            >
              {creatingSharedMailbox ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer la boîte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Mailbox Member Dialog */}
      <Dialog
        open={addMemberMailboxId !== null}
        onOpenChange={(open) => !open && setAddMemberMailboxId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
            <DialogDescription>
              Ajoutez un utilisateur à cette boîte partagée avec un niveau
              d&apos;accès.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="member-email">Email du membre</Label>
              <Input
                id="member-email"
                placeholder="alice@exemple.com"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="member-role">Rôle</Label>
              <Select
                value={newMemberRole}
                onValueChange={(v) =>
                  setNewMemberRole(v as typeof newMemberRole)
                }
              >
                <SelectTrigger id="member-role" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Propriétaire</SelectItem>
                  <SelectItem value="editor">Éditeur</SelectItem>
                  <SelectItem value="reviewer">Lecteur avec réponse</SelectItem>
                  <SelectItem value="viewer">Lecteur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddMemberMailboxId(null)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddMailboxMember}
              disabled={addingMember || !newMemberEmail.trim()}
            >
              {addingMember ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
