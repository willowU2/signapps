"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Key,
  RefreshCw,
  Search,
  AlertTriangle,
  Users,
  Monitor,
  Server,
  ShieldAlert,
} from "lucide-react";
import { useAdDomains } from "@/hooks/use-active-directory";
import { useAdKeys, useRotateKey } from "@/hooks/use-active-directory";
import type { AdPrincipalKey } from "@/types/active-directory";
import { ENC_TYPE_LABELS } from "@/types/active-directory";

// ── Helpers ─────────────────────────────────────────────────────────────────

type PrincipalType = AdPrincipalKey["principal_type"];

const TYPE_CONFIG: Record<
  PrincipalType,
  { label: string; className: string; icon: React.ReactNode }
> = {
  user: {
    label: "Utilisateur",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    icon: <Users className="h-3 w-3" />,
  },
  computer: {
    label: "Ordinateur",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon: <Monitor className="h-3 w-3" />,
  },
  service: {
    label: "Service",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    icon: <Server className="h-3 w-3" />,
  },
  krbtgt: {
    label: "krbtgt",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
};

function TypeBadge({ type }: { type: PrincipalType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Principal row (one row per enc_type) ────────────────────────────────────

interface KeyRowProps {
  principalName: string;
  keys: AdPrincipalKey[];
  domainId: string;
  onRotate: (principal: string) => void;
  rotating: boolean;
}

function PrincipalRow({
  principalName,
  keys,
  domainId: _domainId,
  onRotate,
  rotating,
}: KeyRowProps) {
  const firstKey = keys[0];
  return (
    <>
      {keys.map((k, idx) => (
        <TableRow key={k.id}>
          {idx === 0 && (
            <TableCell
              rowSpan={keys.length}
              className="font-mono text-sm align-top pt-3"
            >
              {principalName}
            </TableCell>
          )}
          {idx === 0 && (
            <TableCell rowSpan={keys.length} className="align-top pt-3">
              <TypeBadge type={firstKey.principal_type} />
            </TableCell>
          )}
          <TableCell className="font-mono text-xs">
            {ENC_TYPE_LABELS[k.enc_type] ?? `#${k.enc_type}`}
          </TableCell>
          <TableCell className="text-center">{k.key_version}</TableCell>
          <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
            {k.salt ?? "—"}
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {formatDate(k.created_at)}
          </TableCell>
          {idx === 0 && (
            <TableCell rowSpan={keys.length} className="align-top pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={rotating}
                onClick={() => onRotate(principalName)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Rotation
              </Button>
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  );
}

// ── Keys table ───────────────────────────────────────────────────────────────

interface KeysTableProps {
  keys: AdPrincipalKey[];
  domainId: string;
  search: string;
  filter?: PrincipalType;
}

function KeysTable({ keys, domainId, search, filter }: KeysTableProps) {
  const rotate = useRotateKey();

  const grouped = useMemo(() => {
    const filtered = keys.filter((k) => {
      const matchSearch =
        !search ||
        k.principal_name.toLowerCase().includes(search.toLowerCase());
      const matchType = !filter || k.principal_type === filter;
      return matchSearch && matchType;
    });

    const map = new Map<string, AdPrincipalKey[]>();
    for (const k of filtered) {
      const existing = map.get(k.principal_name) ?? [];
      map.set(k.principal_name, [...existing, k]);
    }
    return Array.from(map.entries());
  }, [keys, search, filter]);

  const handleRotate = (principal: string) => {
    rotate.mutate(
      { domainId, principal },
      {
        onSuccess: () => toast.success(`Rotation effectuée pour ${principal}`),
        onError: () => toast.error(`Échec de la rotation pour ${principal}`),
      },
    );
  };

  if (grouped.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Key className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Aucun principal trouvé</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom du principal</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Chiffrement</TableHead>
          <TableHead className="text-center">Version (kvno)</TableHead>
          <TableHead>Salt</TableHead>
          <TableHead>Créé le</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {grouped.map(([name, ks]) => (
          <PrincipalRow
            key={name}
            principalName={name}
            keys={ks}
            domainId={domainId}
            onRotate={handleRotate}
            rotating={rotate.isPending}
          />
        ))}
      </TableBody>
    </Table>
  );
}

// ── krbtgt tab ───────────────────────────────────────────────────────────────

function KrbtgtTab({
  keys,
  domainId,
}: {
  keys: AdPrincipalKey[];
  domainId: string;
}) {
  const krbtgtKeys = keys.filter((k) => k.principal_type === "krbtgt");
  const rotate = useRotateKey();

  const handleRotate = () => {
    if (!krbtgtKeys[0]) return;
    rotate.mutate(
      { domainId, principal: krbtgtKeys[0].principal_name },
      {
        onSuccess: () => toast.success("Rotation krbtgt effectuée"),
        onError: () => toast.error("Échec de la rotation krbtgt"),
      },
    );
  };

  if (krbtgtKeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Aucune clé krbtgt trouvée pour ce domaine.
        </CardContent>
      </Card>
    );
  }

  const first = krbtgtKeys[0];
  return (
    <div className="space-y-4">
      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <CardTitle className="text-destructive">
                Avertissement — Impact global
              </CardTitle>
              <CardDescription className="mt-1">
                La rotation de la clé krbtgt invalide{" "}
                <strong>tous les tickets Kerberos actifs</strong> du domaine.
                Les utilisateurs devront se réauthentifier. Effectuez cette
                opération uniquement en dehors des heures de travail et avec
                l'accord de votre équipe.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Compte krbtgt
          </CardTitle>
          <CardDescription>
            Clé maîtresse du centre de distribution de tickets (KDC)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Principal</TableHead>
                <TableHead>Chiffrement</TableHead>
                <TableHead className="text-center">Version (kvno)</TableHead>
                <TableHead>Salt</TableHead>
                <TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {krbtgtKeys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-sm">
                    {k.principal_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {ENC_TYPE_LABELS[k.enc_type] ?? `#${k.enc_type}`}
                  </TableCell>
                  <TableCell className="text-center">{k.key_version}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {k.salt ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(k.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-end">
            <Button
              variant="destructive"
              disabled={rotate.isPending}
              onClick={handleRotate}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Rotation krbtgt
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdKerberosPage() {
  usePageTitle("Kerberos — Active Directory");

  const [domainId, setDomainId] = useState("");
  const [search, setSearch] = useState("");

  const { data: domains = [], isLoading: domainsLoading } = useAdDomains();
  const { data: keys = [], isLoading: keysLoading } = useAdKeys(domainId);

  const loading = domainsLoading || (!!domainId && keysLoading);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Kerberos KDC"
          description="Gestion des principals, clés et tickets Kerberos"
          icon={<Key className="h-5 w-5" />}
          actions={
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Sélectionner un domaine" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.dns_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {!domainId ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Sélectionnez un domaine pour afficher les clés Kerberos.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-60" />
              <p>Chargement des clés…</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="principals">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="principals">
                  <Users className="h-4 w-4 mr-2" />
                  Principals
                </TabsTrigger>
                <TabsTrigger value="krbtgt">
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  krbtgt
                </TabsTrigger>
                <TabsTrigger value="spns">
                  <Server className="h-4 w-4 mr-2" />
                  Service SPNs
                </TabsTrigger>
              </TabsList>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer par nom de principal…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>

            {/* Principals tab */}
            <TabsContent value="principals" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tous les principals</CardTitle>
                  <CardDescription>
                    Clés Kerberos par principal — groupées par nom
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <KeysTable keys={keys} domainId={domainId} search={search} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* krbtgt tab */}
            <TabsContent value="krbtgt" className="mt-4">
              <KrbtgtTab keys={keys} domainId={domainId} />
            </TabsContent>

            {/* Service SPNs tab */}
            <TabsContent value="spns" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Service SPNs</CardTitle>
                  <CardDescription>
                    Comptes de service avec Service Principal Names enregistrés
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <KeysTable
                    keys={keys}
                    domainId={domainId}
                    search={search}
                    filter="service"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
