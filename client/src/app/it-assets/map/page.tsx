"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Search,
  Server,
  MonitorSmartphone,
  Network,
  Cpu,
  Printer,
  CheckCircle,
  AlertTriangle,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { itAssetsApi, HardwareAsset, ITAlert } from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteGroup {
  site: string;
  assets: HardwareAsset[];
  healthScore: number; // 0-100
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeIcon(type: string, size = "h-4 w-4") {
  switch (type) {
    case "server":
      return <Server className={`${size} text-blue-500`} />;
    case "switch":
      return <Network className={`${size} text-purple-500`} />;
    case "workstation":
      return <Cpu className={`${size} text-indigo-500`} />;
    case "printer":
      return <Printer className={`${size} text-amber-500`} />;
    default:
      return <MonitorSmartphone className={`${size} text-emerald-500`} />;
  }
}

function statusColor(status?: string): string {
  switch (status) {
    case "active":
      return "#10b981"; // green
    case "maintenance":
      return "#f97316"; // orange
    case "retired":
      return "#94a3b8"; // gray
    case "stock":
      return "#3b82f6"; // blue
    default:
      return "#94a3b8";
  }
}

function sitePinColor(healthScore: number): string {
  if (healthScore >= 80) return "bg-emerald-500";
  if (healthScore >= 50) return "bg-yellow-400";
  return "bg-red-500";
}

function siteBorderColor(healthScore: number): string {
  if (healthScore >= 80) return "border-emerald-500/30";
  if (healthScore >= 50) return "border-yellow-400/30";
  return "border-red-500/30";
}

function healthLabel(score: number): { label: string; badge: string } {
  if (score >= 80)
    return { label: "Sain", badge: "bg-emerald-500/10 text-emerald-600" };
  if (score >= 50)
    return { label: "Attention", badge: "bg-yellow-500/10 text-yellow-700" };
  return { label: "Critique", badge: "bg-red-500/10 text-red-600" };
}

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  maintenance: "Maintenance",
  retired: "Retire",
  stock: "En stock",
};

// ─── Site Pin (SVG-based) ─────────────────────────────────────────────────────

interface SitePinProps {
  group: SiteGroup;
  isSelected: boolean;
  onSelect: (site: string) => void;
  x: number;
  y: number;
}

function SitePin({ group, isSelected, onSelect, x, y }: SitePinProps) {
  const pinCls = sitePinColor(group.healthScore);
  const count = group.assets.length;
  const { label: hLabel, badge: hBadge } = healthLabel(group.healthScore);

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: "pointer" }}
      onClick={() => onSelect(group.site)}
    >
      {/* Pulse ring for critical */}
      {group.healthScore < 50 && (
        <circle
          r={24}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          opacity={0.3}
          className="animate-ping"
          style={{ animationDuration: "2s" }}
        />
      )}
      <circle
        r={isSelected ? 22 : 18}
        fill={
          group.healthScore >= 80
            ? "#10b981"
            : group.healthScore >= 50
              ? "#f59e0b"
              : "#ef4444"
        }
        stroke="white"
        strokeWidth={isSelected ? 3 : 2}
        opacity={0.9}
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={11}
        fontWeight="bold"
      >
        {count}
      </text>
      {/* Site name label */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        y={28}
        fill="currentColor"
        fontSize={10}
        className="fill-foreground"
        fontWeight={isSelected ? "bold" : "normal"}
      >
        {group.site.slice(0, 12)}
      </text>
    </g>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeoMapPage() {
  usePageTitle("Carte des equipements");

  const [search, setSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<HardwareAsset | null>(
    null,
  );

  const { data: hardware = [], isLoading } = useQuery<HardwareAsset[]>({
    queryKey: ["hardware"],
    queryFn: () => itAssetsApi.listHardware().then((r) => r.data),
  });

  const { data: alerts = [] } = useQuery<ITAlert[]>({
    queryKey: ["alerts"],
    queryFn: () => itAssetsApi.listAlerts().then((r) => r.data),
  });

  const activeAlerts = alerts.filter((a) => !a.resolved_at);

  // Group by location/site
  const siteGroups = useMemo<SiteGroup[]>(() => {
    const map = new Map<string, HardwareAsset[]>();
    for (const asset of hardware) {
      const site = asset.location?.trim() || "Non localise";
      if (!map.has(site)) map.set(site, []);
      map.get(site)!.push(asset);
    }

    return Array.from(map.entries()).map(([site, assets]) => {
      const alertedIds = new Set(activeAlerts.map((a) => a.hardware_id));
      const criticalCount = assets.filter((a) => alertedIds.has(a.id)).length;
      const activeCount = assets.filter((a) => a.status === "active").length;
      const healthScore =
        assets.length > 0
          ? Math.round((activeCount / assets.length) * 100) - criticalCount * 15
          : 100;
      return {
        site,
        assets,
        healthScore: Math.max(0, Math.min(100, healthScore)),
      };
    });
  }, [hardware, activeAlerts]);

  const filteredGroups = useMemo(
    () =>
      search.trim()
        ? siteGroups.filter(
            (g) =>
              g.site.toLowerCase().includes(search.toLowerCase()) ||
              g.assets.some((a) =>
                a.name.toLowerCase().includes(search.toLowerCase()),
              ),
          )
        : siteGroups,
    [siteGroups, search],
  );

  const selectedGroup = selectedSite
    ? filteredGroups.find((g) => g.site === selectedSite)
    : null;

  // Distribute pins across a virtual 600x380 canvas in a grid
  const PIN_POSITIONS = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(filteredGroups.length * 1.5));
    return filteredGroups.map((g, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        site: g.site,
        x: 60 + col * (480 / Math.max(cols, 1)),
        y: 60 + row * 100,
      };
    });
  }, [filteredGroups]);

  const allHealthy = siteGroups.every((g) => g.healthScore >= 80);

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MapPin className="h-6 w-6 text-primary" />
              Carte des equipements
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vue geographique du parc informatique par site
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher un site..."
                className="h-8 pl-8 w-48 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sites</p>
              <p className="text-2xl font-bold">{siteGroups.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Equipements</p>
              <p className="text-2xl font-bold">{hardware.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Sites sains</p>
              <p className="text-2xl font-bold text-emerald-600">
                {siteGroups.filter((g) => g.healthScore >= 80).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Alertes actives</p>
              <p
                className={`text-2xl font-bold ${activeAlerts.length > 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {activeAlerts.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* SVG Map */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                Vue par site
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {/* Legend */}
              <div className="flex gap-3 px-2 pb-2 text-xs text-muted-foreground">
                {[
                  { color: "bg-emerald-500", label: "Sain (≥80%)" },
                  { color: "bg-yellow-400", label: "Attention" },
                  { color: "bg-red-500", label: "Critique" },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full inline-block ${color}`}
                    />
                    {label}
                  </span>
                ))}
                <span className="text-muted-foreground ml-2">
                  Chiffre = nb d&apos;equipements
                </span>
              </div>

              {filteredGroups.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                  {isLoading ? "Chargement..." : "Aucun equipement localise"}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg bg-muted/30 border border-dashed">
                  <svg
                    viewBox="0 0 600 400"
                    className="w-full"
                    style={{ minHeight: 280 }}
                  >
                    {/* Grid dots background */}
                    {Array.from({ length: 12 }, (_, row) =>
                      Array.from({ length: 20 }, (_, col) => (
                        <circle
                          key={`${row}-${col}`}
                          cx={col * 30 + 15}
                          cy={row * 30 + 15}
                          r={1}
                          fill="#cbd5e1"
                          opacity={0.5}
                        />
                      )),
                    )}

                    {/* Pins */}
                    {PIN_POSITIONS.map((pos) => {
                      const group = filteredGroups.find(
                        (g) => g.site === pos.site,
                      );
                      if (!group) return null;
                      return (
                        <SitePin
                          key={pos.site}
                          group={group}
                          isSelected={selectedSite === pos.site}
                          onSelect={setSelectedSite}
                          x={pos.x}
                          y={pos.y}
                        />
                      );
                    })}
                  </svg>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {selectedGroup ? selectedGroup.site : "Selectionnez un site"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedGroup ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Cliquez sur un pin pour voir les details
                  </p>
                  <div className="space-y-1.5 border-t pt-2">
                    {filteredGroups.slice(0, 8).map((g) => {
                      const { badge } = healthLabel(g.healthScore);
                      return (
                        <button
                          key={g.site}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted text-sm"
                          onClick={() => setSelectedSite(g.site)}
                        >
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${sitePinColor(g.healthScore)}`}
                          />
                          <span className="flex-1 truncate">{g.site}</span>
                          <Badge className={`text-xs ${badge}`}>
                            {g.assets.length}
                          </Badge>
                        </button>
                      );
                    })}
                    {filteredGroups.length > 8 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{filteredGroups.length - 8} autres sites
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Site health */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Sante du site
                    </span>
                    <Badge
                      className={`text-xs ${healthLabel(selectedGroup.healthScore).badge}`}
                    >
                      {healthLabel(selectedGroup.healthScore).label} —{" "}
                      {selectedGroup.healthScore}%
                    </Badge>
                  </div>

                  {/* Asset list */}
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selectedGroup.assets.map((asset) => {
                      const alertCount = activeAlerts.filter(
                        (a) => a.hardware_id === asset.id,
                      ).length;
                      const isSelected = selectedAsset?.id === asset.id;
                      return (
                        <button
                          key={asset.id}
                          className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() =>
                            setSelectedAsset(isSelected ? null : asset)
                          }
                        >
                          {getTypeIcon(asset.type, "h-3.5 w-3.5")}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {asset.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {asset.type}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {alertCount > 0 && (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            )}
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ background: statusColor(asset.status) }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected asset detail */}
                  {selectedAsset && (
                    <div className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-1">
                      <p className="font-semibold">{selectedAsset.name}</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-muted-foreground">
                        <span>Type</span> <span>{selectedAsset.type}</span>
                        <span>Statut</span>{" "}
                        <span>
                          {STATUS_LABEL[selectedAsset.status ?? ""] ??
                            selectedAsset.status}
                        </span>
                        {selectedAsset.manufacturer && (
                          <>
                            <span>Fabricant</span>
                            <span>{selectedAsset.manufacturer}</span>
                          </>
                        )}
                        {selectedAsset.model && (
                          <>
                            <span>Modele</span>
                            <span>{selectedAsset.model}</span>
                          </>
                        )}
                        {selectedAsset.serial_number && (
                          <>
                            <span>S/N</span>
                            <span className="font-mono">
                              {selectedAsset.serial_number}
                            </span>
                          </>
                        )}
                      </div>
                      {activeAlerts.filter(
                        (a) => a.hardware_id === selectedAsset.id,
                      ).length > 0 && (
                        <div className="flex items-center gap-1 text-red-600 mt-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {
                            activeAlerts.filter(
                              (a) => a.hardware_id === selectedAsset.id,
                            ).length
                          }{" "}
                          alerte(s) active(s)
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedSite(null);
                      setSelectedAsset(null);
                    }}
                  >
                    Retour a la liste des sites
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All sites grid */}
        <div>
          <h2 className="text-sm font-semibold mb-3">
            Tous les sites ({filteredGroups.length})
          </h2>
          {filteredGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground text-sm">
              {isLoading
                ? "Chargement des equipements..."
                : "Aucun equipement avec localisation"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredGroups.map((group) => {
                const { label: hLabel, badge: hBadge } = healthLabel(
                  group.healthScore,
                );
                const alertedAssets = group.assets.filter((a) =>
                  activeAlerts.some((al) => al.hardware_id === a.id),
                );

                return (
                  <button
                    key={group.site}
                    className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                      selectedSite === group.site
                        ? "border-primary bg-primary/5"
                        : `${siteBorderColor(group.healthScore)} bg-card hover:bg-muted/50`
                    }`}
                    onClick={() =>
                      setSelectedSite(
                        group.site === selectedSite ? null : group.site,
                      )
                    }
                  >
                    <div className="flex items-start justify-between mb-2">
                      <MapPin
                        className={`h-4 w-4 shrink-0 ${
                          group.healthScore >= 80
                            ? "text-emerald-500"
                            : group.healthScore >= 50
                              ? "text-yellow-500"
                              : "text-red-500"
                        }`}
                      />
                      <Badge className={`text-xs ${hBadge}`}>{hLabel}</Badge>
                    </div>
                    <p className="text-sm font-semibold leading-tight mb-1 truncate">
                      {group.site}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {group.assets.length} equipement
                      {group.assets.length > 1 ? "s" : ""}
                    </p>
                    {alertedAssets.length > 0 && (
                      <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        {alertedAssets.length} alerte
                        {alertedAssets.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
