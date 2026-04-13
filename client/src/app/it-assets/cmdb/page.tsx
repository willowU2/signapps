"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Layers, Plus, Trash2, Network, ZoomIn } from "lucide-react";
import {
  itAssetsApi,
  ConfigurationItem,
  CIRelationship,
} from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

const CI_TYPES = [
  "server",
  "workstation",
  "network",
  "storage",
  "application",
  "service",
  "database",
  "other",
];
const REL_TYPES = [
  "depends_on",
  "hosted_on",
  "connected_to",
  "backup_of",
  "part_of",
  "monitors",
];

type Node = { id: string; name: string; x: number; y: number; ci_type: string };
type Edge = { id: string; source: string; target: string; rel_type: string };

function ForceGraph({
  cis,
  relationships,
  selectedId,
  onSelect,
}: {
  cis: ConfigurationItem[];
  relationships: CIRelationship[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 600,
    H = 400;
  const R = 22;

  // Simple circular layout
  const nodes: Node[] = cis.map((ci, i) => {
    const angle = (2 * Math.PI * i) / Math.max(cis.length, 1);
    const rx = Math.min(W, H) * 0.38;
    return {
      id: ci.id,
      name: ci.name,
      ci_type: ci.ci_type,
      x: W / 2 + rx * Math.cos(angle),
      y: H / 2 + rx * Math.sin(angle),
    };
  });

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges: Edge[] = relationships.map((r) => ({
    id: r.id,
    source: r.source_ci_id,
    target: r.target_ci_id,
    rel_type: r.relationship_type,
  }));

  const TYPE_COLORS: Record<string, string> = {
    server: "#3b82f6",
    workstation: "#10b981",
    network: "#f59e0b",
    storage: "#8b5cf6",
    application: "#ec4899",
    service: "#06b6d4",
    database: "#f97316",
    other: "#6b7280",
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full border rounded-lg bg-muted/30"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
        </marker>
      </defs>
      {edges.map((e) => {
        const src = nodeMap[e.source];
        const tgt = nodeMap[e.target];
        if (!src || !tgt) return null;
        const dx = tgt.x - src.x,
          dy = tgt.y - src.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ex = tgt.x - (dx / len) * (R + 4);
        const ey = tgt.y - (dy / len) * (R + 4);
        return (
          <g key={e.id}>
            <line
              x1={src.x}
              y1={src.y}
              x2={ex}
              y2={ey}
              stroke="#6b7280"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
              strokeOpacity={0.6}
            />
            <text
              x={(src.x + ex) / 2}
              y={(src.y + ey) / 2 - 4}
              fontSize={9}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {e.rel_type}
            </text>
          </g>
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} onClick={() => onSelect(n.id)} className="cursor-pointer">
          <circle
            cx={n.x}
            cy={n.y}
            r={R}
            fill={TYPE_COLORS[n.ci_type] ?? "#6b7280"}
            stroke={selectedId === n.id ? "#fff" : "transparent"}
            strokeWidth={3}
            fillOpacity={0.85}
          />
          <text
            x={n.x}
            y={n.y + 4}
            textAnchor="middle"
            fontSize={10}
            fill="white"
            fontWeight="600"
          >
            {n.name.slice(0, 6)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function CmdbPage() {
  usePageTitle("CMDB");
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedCI, setSelectedCI] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", ci_type: "server" });

  const { data: cis = [] } = useQuery<ConfigurationItem[]>({
    queryKey: ["cmdb-cis"],
    queryFn: () => itAssetsApi.listCIs().then((r) => r.data),
  });

  const { data: impact = [] } = useQuery<ConfigurationItem[]>({
    queryKey: ["ci-impact", selectedCI],
    queryFn: () => itAssetsApi.getCIImpact(selectedCI!).then((r) => r.data),
    enabled: !!selectedCI,
  });

  const { data: rels = [] } = useQuery<CIRelationship[]>({
    queryKey: ["ci-rels", selectedCI],
    queryFn: () =>
      itAssetsApi.listCIRelationships(selectedCI!).then((r) => r.data),
    enabled: !!selectedCI,
  });

  const createMut = useMutation({
    mutationFn: () => itAssetsApi.createCI(createForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cmdb-cis"] });
      setShowCreate(false);
      setCreateForm({ name: "", ci_type: "server" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => itAssetsApi.deleteCI(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cmdb-cis"] }),
  });

  const filtered =
    typeFilter === "all" ? cis : cis.filter((c) => c.ci_type === typeFilter);
  const selectedCIObj = cis.find((c) => c.id === selectedCI);

  // All relationships for graph (for all CIs)
  const { data: allRels = [] } = useQuery<CIRelationship[]>({
    queryKey: ["ci-rels-all"],
    queryFn: async () => {
      const all: CIRelationship[] = [];
      for (const ci of cis.slice(0, 20)) {
        try {
          const r = await itAssetsApi
            .listCIRelationships(ci.id)
            .then((res) => res.data);
          all.push(...r);
        } catch {
          /* skip */
        }
      }
      // deduplicate
      const seen = new Set<string>();
      return all.filter((r) =>
        seen.has(r.id) ? false : (seen.add(r.id), true),
      );
    },
    enabled: cis.length > 0,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              CMDB
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configuration items and relationships
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New CI
          </Button>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {CI_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Relationship graph */}
        {cis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Network className="h-4 w-4" /> Relationship Graph
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ForceGraph
                cis={filtered}
                relationships={allRels}
                selectedId={selectedCI}
                onSelect={(id) =>
                  setSelectedCI((prev) => (prev === id ? null : id))
                }
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Click a node to see impact analysis
              </p>
            </CardContent>
          </Card>
        )}

        {/* Impact analysis */}
        {selectedCI && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                Impact Analysis:{" "}
                <span className="text-primary">{selectedCIObj?.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {impact.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No dependent CIs found
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {impact.map((ci) => (
                    <Badge key={ci.id} variant="outline">
                      {ci.name}{" "}
                      <span className="ml-1 text-muted-foreground">
                        ({ci.ci_type})
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CI List */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Layers className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">
                          Aucun element de configuration
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                          Ajoutez des CIs pour cartographier votre
                          infrastructure.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((ci) => (
                  <TableRow
                    key={ci.id}
                    className={`cursor-pointer ${selectedCI === ci.id ? "bg-primary/5" : ""}`}
                    onClick={() =>
                      setSelectedCI((prev) => (prev === ci.id ? null : ci.id))
                    }
                  >
                    <TableCell className="font-medium">{ci.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ci.ci_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ci.status === "active" ? "default" : "outline"}
                      >
                        {ci.status ?? "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(ci.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMut.mutate(ci.id);
                        }}
                        className="h-7 w-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create CI dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Configuration Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. prod-web-01"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={createForm.ci_type}
                onValueChange={(v) =>
                  setCreateForm((p) => ({ ...p, ci_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CI_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
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
              disabled={!createForm.name || createMut.isPending}
            >
              Create CI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
