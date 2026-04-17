"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, ZoomIn, ZoomOut, RotateCcw, Info } from "lucide-react";
import { ConfigurationItem, CIRelationship } from "@/lib/api/it-assets";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  name: string;
  type: string;
  status: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relType: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_R = 24;
const SPRING_LEN = 130;
const SPRING_K = 0.04;
const REPULSION = 2500;
const DAMPING = 0.82;
const ITERATIONS = 120;
const W = 700;
const H = 420;

// ─── Color helpers ────────────────────────────────────────────────────────────

function nodeColor(
  status: string,
  highlight: boolean,
  dimmed: boolean,
): string {
  if (dimmed) return "#d1d5db";
  if (highlight) return "#f59e0b";
  switch (status) {
    case "active":
      return "#10b981";
    case "warning":
      return "#f59e0b";
    case "critical":
      return "#ef4444";
    case "maintenance":
      return "#f97316";
    default:
      return "#6b7280";
  }
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    server: "SRV",
    workstation: "WS",
    network: "NET",
    storage: "STG",
    application: "APP",
    service: "SVC",
    database: "DB",
    other: "OTH",
  };
  return map[type] ?? type.slice(0, 3).toUpperCase();
}

// ─── Force layout ─────────────────────────────────────────────────────────────

function runForce(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const ns = nodes.map((n) => ({ ...n }));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Repulsion
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[i].x - ns[j].x;
        const dy = ns[i].y - ns[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        ns[i].vx += (dx / dist) * force;
        ns[i].vy += (dy / dist) * force;
        ns[j].vx -= (dx / dist) * force;
        ns[j].vy -= (dy / dist) * force;
      }
    }

    // Spring attraction
    for (const e of edges) {
      const s = ns.find((n) => n.id === e.source);
      const t = ns.find((n) => n.id === e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - SPRING_LEN) * SPRING_K;
      s.vx += (dx / dist) * force;
      s.vy += (dy / dist) * force;
      t.vx -= (dx / dist) * force;
      t.vy -= (dy / dist) * force;
    }

    // Center gravity
    for (const n of ns) {
      n.vx += (W / 2 - n.x) * 0.002;
      n.vy += (H / 2 - n.y) * 0.002;
    }

    for (const n of ns) {
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x = Math.max(NODE_R + 4, Math.min(W - NODE_R - 4, n.x + n.vx));
      n.y = Math.max(NODE_R + 4, Math.min(H - NODE_R - 4, n.y + n.vy));
    }
  }

  return ns;
}

// ─── Impact traversal ─────────────────────────────────────────────────────────

function getImpacted(nodeId: string, edges: GraphEdge[]): Set<string> {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    // Find all nodes that depend on cur (edges where source=cur or target=cur for "depends_on")
    for (const e of edges) {
      const next =
        e.source === cur ? e.target : e.target === cur ? e.source : null;
      if (next && !visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DependencyMapProps {
  cis: ConfigurationItem[];
  relationships: CIRelationship[];
}

export function DependencyMap({ cis, relationships }: DependencyMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [impacted, setImpacted] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{
    ci: ConfigurationItem;
    x: number;
    y: number;
  } | null>(null);

  // Build + layout graph
  useEffect(() => {
    if (!cis.length) return;

    const initialNodes: GraphNode[] = cis.map((ci, i) => ({
      id: ci.id,
      name: ci.name,
      type: ci.ci_type,
      status: ci.status ?? "unknown",
      x: W / 2 + Math.cos((i / cis.length) * Math.PI * 2) * 160,
      y: H / 2 + Math.sin((i / cis.length) * Math.PI * 2) * 120,
      vx: 0,
      vy: 0,
    }));

    const graphEdges: GraphEdge[] = relationships.map((r) => ({
      source: r.source_ci_id,
      target: r.target_ci_id,
      relType: r.relationship_type,
    }));

    const laid = runForce(initialNodes, graphEdges);
    setNodes(laid);
    setEdges(graphEdges);
  }, [cis, relationships]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (selected === nodeId) {
        setSelected(null);
        setImpacted(new Set());
      } else {
        setSelected(nodeId);
        setImpacted(getImpacted(nodeId, edges));
      }
      setTooltip(null);
    },
    [selected, edges],
  );

  const handleNodeHover = useCallback(
    (nodeId: string | null, x: number, y: number) => {
      if (nodeId == null) {
        setTooltip(null);
        return;
      }
      const ci = cis.find((c) => c.id === nodeId);
      if (ci) setTooltip({ ci, x, y });
    },
    [cis],
  );

  const reset = () => {
    setSelected(null);
    setImpacted(new Set());
    setZoom(1);
  };

  if (cis.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-primary" />
            Carte de dependances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-muted-foreground text-sm">
            Aucun element CMDB disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedCi = selected ? cis.find((c) => c.id === selected) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-primary" />
            Carte de dependances CMDB
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.min(z + 0.2, 2))}
              aria-label="Zoomer"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))}
              aria-label="Dézoomer"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={reset}
              aria-label="Réinitialiser"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Impact panel */}
        {selectedCi && (
          <div className="flex items-center gap-2 border-b px-4 py-2 bg-amber-500/5">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700">
              Impact de <strong>{selectedCi.name}</strong> : {impacted.size - 1}{" "}
              element(s) dependant(s)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 text-xs"
              onClick={reset}
            >
              Effacer
            </Button>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-3 px-4 py-2 border-b text-xs text-muted-foreground">
          {[
            { color: "#10b981", label: "Actif" },
            { color: "#f59e0b", label: "Attention" },
            { color: "#ef4444", label: "Critique" },
            { color: "#6b7280", label: "Inconnu" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full inline-block"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
        </div>

        {/* SVG Canvas */}
        <div
          className="relative overflow-hidden rounded-b-xl"
          style={{ height: H }}
        >
          <svg
            ref={svgRef}
            width="100%"
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const s = nodes.find((n) => n.id === e.source);
              const t = nodes.find((n) => n.id === e.target);
              if (!s || !t) return null;
              const isHighlighted =
                impacted.has(e.source) && impacted.has(e.target);
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={isHighlighted ? "#f59e0b" : "#cbd5e1"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={
                    e.relType === "connected_to" ? "4 2" : undefined
                  }
                  markerEnd="url(#arrow)"
                  opacity={selected && !isHighlighted ? 0.3 : 1}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const isSelected = selected === n.id;
              const isHighlighted = impacted.has(n.id);
              const isDimmed = selected != null && !isHighlighted;
              const color = nodeColor(n.status, isSelected, isDimmed);

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleNodeClick(n.id)}
                  onMouseEnter={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect)
                      handleNodeHover(
                        n.id,
                        e.clientX - rect.left,
                        e.clientY - rect.top,
                      );
                  }}
                  onMouseLeave={() => handleNodeHover(null, 0, 0)}
                >
                  <circle
                    r={NODE_R}
                    fill={color}
                    stroke={isSelected ? "#1e40af" : "white"}
                    strokeWidth={isSelected ? 3 : 2}
                    opacity={isDimmed ? 0.4 : 1}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={10}
                    fontWeight="bold"
                    dy={-6}
                  >
                    {typeLabel(n.type)}
                  </text>
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={8}
                    dy={6}
                  >
                    {n.name.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-10 pointer-events-none rounded-lg border bg-popover shadow-lg px-3 py-2 text-xs"
              style={{ left: tooltip.x + 12, top: tooltip.y - 20 }}
            >
              <p className="font-semibold">{tooltip.ci.name}</p>
              <p className="text-muted-foreground">
                {tooltip.ci.ci_type} — {tooltip.ci.status}
              </p>
            </div>
          )}
        </div>

        <p className="px-4 py-2 text-xs text-muted-foreground border-t">
          Cliquez sur un noeud pour voir l&apos;impact sur les elements
          dependants
        </p>
      </CardContent>
    </Card>
  );
}
