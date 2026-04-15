"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { NetworkDiscovery } from "@/lib/api/it-assets";
import { Button } from "@/components/ui/button";

// ─── Force-directed layout (spring algorithm) ─────────────────────────────────

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ip: string;
  hostname?: string;
  os_guess?: string;
  open_ports: number[];
  hardware_id?: string;
  subnet: string;
  response_time_ms?: number;
}

interface Edge {
  source: string;
  target: string;
}

const NODE_RADIUS = 22;
const SPRING_LENGTH = 120;
const SPRING_K = 0.05;
const REPULSION = 3000;
const DAMPING = 0.85;
const ITERATIONS = 150;

function buildGraph(discoveries: NetworkDiscovery[]): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = discoveries.map((d, i) => ({
    id: d.id,
    x: 200 + Math.cos((i / discoveries.length) * Math.PI * 2) * 150,
    y: 200 + Math.sin((i / discoveries.length) * Math.PI * 2) * 150,
    vx: 0,
    vy: 0,
    ip: d.ip_address,
    hostname: d.hostname,
    os_guess: d.os_guess,
    open_ports: d.open_ports,
    hardware_id: d.hardware_id,
    subnet: d.subnet,
    response_time_ms: d.response_time_ms,
  }));

  // Connect nodes that are on the same subnet (same /24)
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].ip.split(".").slice(0, 3).join(".");
      const b = nodes[j].ip.split(".").slice(0, 3).join(".");
      if (a === b) {
        edges.push({ source: nodes[i].id, target: nodes[j].id });
      }
    }
  }

  return { nodes, edges };
}

function runLayout(
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number,
): Node[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    for (const n of nodeMap.values()) {
      forces.set(n.id, { fx: 0, fy: 0 });
    }

    // Repulsion between all node pairs
    const nodeArr = Array.from(nodeMap.values());
    for (let i = 0; i < nodeArr.length; i++) {
      for (let j = i + 1; j < nodeArr.length; j++) {
        const a = nodeArr[i];
        const b = nodeArr[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces.get(a.id)!.fx -= fx;
        forces.get(a.id)!.fy -= fy;
        forces.get(b.id)!.fx += fx;
        forces.get(b.id)!.fy += fy;
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const force = SPRING_K * (dist - SPRING_LENGTH);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces.get(a.id)!.fx += fx;
      forces.get(a.id)!.fy += fy;
      forces.get(b.id)!.fx -= fx;
      forces.get(b.id)!.fy -= fy;
    }

    // Center gravity
    for (const node of nodeMap.values()) {
      forces.get(node.id)!.fx += (width / 2 - node.x) * 0.01;
      forces.get(node.id)!.fy += (height / 2 - node.y) * 0.01;
    }

    // Integrate
    for (const node of nodeMap.values()) {
      const f = forces.get(node.id)!;
      node.vx = (node.vx + f.fx) * DAMPING;
      node.vy = (node.vy + f.fy) * DAMPING;
      node.x += node.vx;
      node.y += node.vy;
      // Clamp to canvas
      node.x = Math.max(
        NODE_RADIUS + 10,
        Math.min(width - NODE_RADIUS - 10, node.x),
      );
      node.y = Math.max(
        NODE_RADIUS + 10,
        Math.min(height - NODE_RADIUS - 10, node.y),
      );
    }
  }

  return Array.from(nodeMap.values());
}

// ─── Node color by status ─────────────────────────────────────────────────────

function nodeColor(node: Node): string {
  if (node.hardware_id) return "#10b981"; // emerald — in inventory
  if (node.response_time_ms && node.response_time_ms < 100) return "#3b82f6"; // blue — fast
  if (node.response_time_ms && node.response_time_ms < 500) return "#f59e0b"; // amber — medium
  return "#94a3b8"; // gray — unknown/slow
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NetworkTopologyProps {
  discoveries: NetworkDiscovery[];
  onNodeClick?: (discovery: NetworkDiscovery) => void;
}

export function NetworkTopology({
  discoveries,
  onNodeClick,
}: NetworkTopologyProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const WIDTH = 800;
  const HEIGHT = 500;

  useEffect(() => {
    if (discoveries.length === 0) return;
    const { nodes: rawNodes, edges: rawEdges } = buildGraph(discoveries);
    const laid = runLayout(rawNodes, rawEdges, WIDTH, HEIGHT);
    setNodes(laid);
    setEdges(rawEdges);
  }, [discoveries]);

  const handleNodeClick = useCallback(
    (node: Node) => {
      setSelected((s) => (s?.id === node.id ? null : node));
      if (onNodeClick) {
        const discovery = discoveries.find((d) => d.id === node.id);
        if (discovery) onNodeClick(discovery);
      }
    },
    [discoveries, onNodeClick],
  );

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest("circle[data-node]")) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPanOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  if (discoveries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center text-center gap-3">
          <Network className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            Lancez un scan pour voir la topologie reseau
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-purple-500" />
              Topologie reseau
              <Badge variant="outline" className="ml-1 text-xs">
                {nodes.length} hotes
              </Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={resetView}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t overflow-hidden rounded-b-lg bg-muted/20 dark:bg-zinc-950">
            <svg
              ref={svgRef}
              width="100%"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="cursor-grab active:cursor-grabbing select-none"
              style={{ height: 500 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <g
                transform={`translate(${panOffset.x},${panOffset.y}) scale(${zoom})`}
              >
                {/* Edges */}
                {edges.map((edge, i) => {
                  const a = nodes.find((n) => n.id === edge.source);
                  const b = nodes.find((n) => n.id === edge.target);
                  if (!a || !b) return null;
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="currentColor"
                      strokeOpacity={0.15}
                      strokeWidth={1}
                      className="text-foreground"
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const isSelected = selected?.id === node.id;
                  const color = nodeColor(node);
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      className="cursor-pointer"
                      onClick={() => handleNodeClick(node)}
                    >
                      {/* Glow ring on selection */}
                      {isSelected && (
                        <circle
                          r={NODE_RADIUS + 6}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeOpacity={0.5}
                        />
                      )}
                      <circle
                        data-node="true"
                        r={NODE_RADIUS}
                        fill={color}
                        fillOpacity={isSelected ? 1 : 0.8}
                        stroke={isSelected ? "white" : color}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      {/* IP label */}
                      <text
                        y={NODE_RADIUS + 14}
                        textAnchor="middle"
                        fontSize={9}
                        fill="currentColor"
                        className="text-foreground"
                        fillOpacity={0.8}
                      >
                        {node.ip}
                      </text>
                      {/* Hostname inside node */}
                      {node.hostname && (
                        <text
                          textAnchor="middle"
                          fontSize={7}
                          fill="white"
                          fillOpacity={0.9}
                          dy="0.3em"
                        >
                          {node.hostname.slice(0, 10)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          Dans l'inventaire
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          Rapide (&lt;100ms)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          Lent (100-500ms)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          Inconnu
        </div>
      </div>

      {/* Selected node detail */}
      {selected && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-semibold font-mono">{selected.ip}</p>
                {selected.hostname && (
                  <p className="text-sm text-muted-foreground">
                    {selected.hostname}
                  </p>
                )}
                {selected.os_guess && (
                  <Badge variant="outline" className="text-xs">
                    {selected.os_guess}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground space-y-1 text-right">
                {selected.response_time_ms && (
                  <p>RTT: {selected.response_time_ms}ms</p>
                )}
                <div className="flex flex-wrap gap-1 justify-end">
                  {selected.open_ports.map((p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className="text-xs py-0 h-4 font-mono"
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
