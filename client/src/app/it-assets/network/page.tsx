"use client";

import { useState, useCallback } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Network,
  Search,
  Plus,
  RefreshCw,
  Radar,
  Monitor,
  Globe,
  Cpu,
  Server,
  Clock,
  Wifi,
} from "lucide-react";
import { itAssetsApi, NetworkDiscovery, ScanResult } from "@/lib/api/it-assets";
import { NetworkTopology } from "@/components/it-assets/network-topology";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOsIcon(osGuess?: string) {
  if (!osGuess)
    return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
  if (osGuess.toLowerCase().includes("windows"))
    return <Monitor className="h-3.5 w-3.5 text-blue-500" />;
  if (osGuess.toLowerCase().includes("linux"))
    return <Server className="h-3.5 w-3.5 text-orange-500" />;
  return <Cpu className="h-3.5 w-3.5 text-muted-foreground" />;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkDiscoveryPage() {
  usePageTitle("Decouverte reseau");

  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [discoveries, setDiscoveries] = useState<NetworkDiscovery[]>([]);
  const [loadingDiscoveries, setLoadingDiscoveries] = useState(false);

  // Add-to-inventory dialog
  const [addDialog, setAddDialog] = useState<{
    open: boolean;
    discoveryId: string;
    ip: string;
  }>({
    open: false,
    discoveryId: "",
    ip: "",
  });
  const [newAssetName, setNewAssetName] = useState("");
  const [adding, setAdding] = useState(false);

  // View toggle
  const [view, setView] = useState<"table" | "topology">("table");

  const handleScan = async () => {
    if (!subnet.trim()) {
      toast.error("Entrer un sous-reseau CIDR valide (ex: 192.168.1.0/24)");
      return;
    }
    setScanning(true);
    setScanResult(null);
    try {
      const res = await itAssetsApi.scanNetwork(subnet.trim());
      setScanResult(res.data);
      toast.success(
        `Scan termine: ${res.data.hosts_found} hotes trouves sur ${res.data.hosts_scanned} analyses`,
      );
      // Refresh discoveries
      loadDiscoveries();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Scan echoue: ${msg}`);
    } finally {
      setScanning(false);
    }
  };

  const loadDiscoveries = useCallback(async () => {
    setLoadingDiscoveries(true);
    try {
      const res = await itAssetsApi.listDiscoveries();
      setDiscoveries(res.data || []);
    } catch {
      toast.error("Impossible de charger les decouvertes");
    } finally {
      setLoadingDiscoveries(false);
    }
  }, []);

  const openAddDialog = (discovery: NetworkDiscovery) => {
    setNewAssetName(discovery.hostname ?? discovery.ip_address);
    setAddDialog({
      open: true,
      discoveryId: discovery.id,
      ip: discovery.ip_address,
    });
  };

  const handleAddToInventory = async () => {
    if (!newAssetName.trim()) {
      toast.error("Nom requis");
      return;
    }
    setAdding(true);
    try {
      await itAssetsApi.addDiscoveryToInventory(
        addDialog.discoveryId,
        newAssetName.trim(),
      );
      toast.success(`"${newAssetName}" ajoute a l'inventaire`);
      setAddDialog({ open: false, discoveryId: "", ip: "" });
      setNewAssetName("");
      loadDiscoveries();
    } catch {
      toast.error("Impossible d'ajouter a l'inventaire");
    } finally {
      setAdding(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
              <Radar className="h-8 w-8 text-purple-500" />
              Decouverte reseau
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Scanner les sous-reseaux pour decouvrir les equipements connectes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={view === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("table")}
            >
              Tableau
            </Button>
            <Button
              variant={view === "topology" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setView("topology");
                if (discoveries.length === 0) loadDiscoveries();
              }}
            >
              <Network className="h-3.5 w-3.5 mr-1" />
              Topologie
            </Button>
          </div>
        </div>

        {/* Scanner */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wifi className="h-4 w-4 text-purple-500" />
              Scanner un sous-reseau
            </CardTitle>
            <CardDescription>
              Entrez un bloc CIDR (ex: 192.168.1.0/24). Le scan utilise des
              connexions TCP sur les ports courants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 max-w-xs space-y-1.5">
                <Label htmlFor="subnet">Sous-reseau (CIDR)</Label>
                <Input
                  id="subnet"
                  placeholder="192.168.1.0/24"
                  value={subnet}
                  onChange={(e) => setSubnet(e.target.value)}
                  className="font-mono"
                  onKeyDown={(e) =>
                    e.key === "Enter" && !scanning && handleScan()
                  }
                />
              </div>
              <Button
                onClick={handleScan}
                disabled={scanning}
                className="gap-1.5"
              >
                <Search
                  className={`h-4 w-4 ${scanning ? "animate-pulse" : ""}`}
                />
                {scanning ? "Scan en cours..." : "Scanner"}
              </Button>
            </div>

            {scanResult && (
              <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Radar className="h-4 w-4 text-purple-500" />
                  <span className="text-muted-foreground">Scanne:</span>
                  <span className="font-semibold">
                    {scanResult.hosts_scanned}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Trouves:</span>
                  <span className="font-semibold text-emerald-600">
                    {scanResult.hosts_found}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  Sous-reseau:{" "}
                  <code className="font-mono">{scanResult.subnet}</code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {view === "topology" ? (
          <NetworkTopology
            discoveries={discoveries}
            onNodeClick={openAddDialog}
          />
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Hotes decouvertes</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadDiscoveries}
                  disabled={loadingDiscoveries}
                  className="gap-1 text-xs text-muted-foreground"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loadingDiscoveries ? "animate-spin" : ""}`}
                  />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-b-md border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP</TableHead>
                      <TableHead>MAC</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Ports ouverts</TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Derniere vue
                        </span>
                      </TableHead>
                      <TableHead>Inventaire</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discoveries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10">
                          {loadingDiscoveries ? (
                            <p className="text-center text-muted-foreground">
                              Chargement...
                            </p>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center">
                              <Radar className="h-12 w-12 text-muted-foreground/30 mb-4" />
                              <h3 className="text-lg font-semibold">
                                Aucun hote decouvert
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                Lancez un scan reseau ou cliquez sur Actualiser
                                pour decouvrir les appareils.
                              </p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      discoveries.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {d.ip_address}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {d.mac_address ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {d.hostname ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {getOsIcon(d.os_guess)}
                              <span className="text-xs text-muted-foreground">
                                {d.os_guess ?? "Inconnu"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {d.open_ports.slice(0, 5).map((p) => (
                                <Badge
                                  key={p}
                                  variant="outline"
                                  className="text-xs py-0 h-4 font-mono"
                                >
                                  {p}
                                </Badge>
                              ))}
                              {d.open_ports.length > 5 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs py-0 h-4"
                                >
                                  +{d.open_ports.length - 5}
                                </Badge>
                              )}
                              {d.open_ports.length === 0 && (
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatTimestamp(d.last_seen)}
                          </TableCell>
                          <TableCell>
                            {d.hardware_id ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs border">
                                Dans l'inventaire
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                Non enregistre
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!d.hardware_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1 h-7"
                                onClick={() => openAddDialog(d)}
                              >
                                <Plus className="h-3 w-3" />
                                Ajouter
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add to inventory dialog */}
      <Dialog
        open={addDialog.open}
        onOpenChange={(o) => !o && setAddDialog((s) => ({ ...s, open: false }))}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Ajouter a l&apos;inventaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              IP: <code className="font-mono">{addDialog.ip}</code>
            </p>
            <div className="space-y-1.5">
              <Label>Nom de l&apos;equipement</Label>
              <Input
                value={newAssetName}
                onChange={(e) => setNewAssetName(e.target.value)}
                placeholder="PC-BUREAU-01"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialog((s) => ({ ...s, open: false }))}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddToInventory}
              disabled={adding || !newAssetName.trim()}
            >
              {adding ? "Ajout..." : "Ajouter a l'inventaire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
