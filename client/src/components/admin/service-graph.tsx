"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Activity } from "lucide-react";

interface ServiceNodeData extends Record<string, unknown> {
  label: string;
  port: number;
  type: "backend" | "frontend" | "infra";
}

const STATUS_COLORS: Record<ServiceNodeData["type"], string> = {
  backend: "border-blue-400 bg-blue-50",
  frontend: "border-green-400 bg-green-50",
  infra: "border-purple-400 bg-purple-50",
};

const STATUS_BADGE: Record<ServiceNodeData["type"], string> = {
  backend: "bg-blue-100 text-blue-700",
  frontend: "bg-green-100 text-green-700",
  infra: "bg-purple-100 text-purple-700",
};

function ServiceNode({ data }: { data: ServiceNodeData }) {
  return (
    <div className={`rounded-lg border-2 px-3 py-2 shadow-sm min-w-[120px] ${STATUS_COLORS[data.type]}`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <span className="font-semibold text-sm text-gray-800">{data.label}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-500">:{data.port}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[data.type]}`}>
          {data.type}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  service: ServiceNode,
};

const INITIAL_NODES: Node<ServiceNodeData>[] = [
  // Frontend
  { id: "client", type: "service", position: { x: 360, y: 0 }, data: { label: "Next.js Client", port: 3000, type: "frontend" } },
  // Gateway/Proxy
  { id: "proxy", type: "service", position: { x: 360, y: 120 }, data: { label: "Proxy", port: 3003, type: "infra" } },
  // Core services row 1
  { id: "identity", type: "service", position: { x: 0, y: 260 }, data: { label: "Identity", port: 3001, type: "backend" } },
  { id: "storage", type: "service", position: { x: 160, y: 260 }, data: { label: "Storage", port: 3004, type: "backend" } },
  { id: "ai", type: "service", position: { x: 320, y: 260 }, data: { label: "AI", port: 3005, type: "backend" } },
  { id: "docs", type: "service", position: { x: 480, y: 260 }, data: { label: "Docs", port: 3010, type: "backend" } },
  { id: "calendar", type: "service", position: { x: 640, y: 260 }, data: { label: "Calendar", port: 3011, type: "backend" } },
  // Core services row 2
  { id: "mail", type: "service", position: { x: 0, y: 400 }, data: { label: "Mail", port: 3012, type: "backend" } },
  { id: "scheduler", type: "service", position: { x: 160, y: 400 }, data: { label: "Scheduler", port: 3007, type: "backend" } },
  { id: "office", type: "service", position: { x: 320, y: 400 }, data: { label: "Office", port: 3018, type: "backend" } },
  { id: "metrics", type: "service", position: { x: 480, y: 400 }, data: { label: "Metrics", port: 3008, type: "backend" } },
  { id: "collab", type: "service", position: { x: 640, y: 400 }, data: { label: "Collab", port: 3013, type: "backend" } },
  // Infrastructure
  { id: "postgres", type: "service", position: { x: 160, y: 540 }, data: { label: "PostgreSQL", port: 5432, type: "infra" } },
  { id: "redis", type: "service", position: { x: 360, y: 540 }, data: { label: "Redis", port: 6379, type: "infra" } },
];

const INITIAL_EDGES: Edge[] = [
  // Client → Proxy
  { id: "c-p", source: "client", target: "proxy", animated: true, style: { stroke: "#6b7280" } },
  // Proxy → services
  { id: "p-id", source: "proxy", target: "identity" },
  { id: "p-st", source: "proxy", target: "storage" },
  { id: "p-ai", source: "proxy", target: "ai" },
  { id: "p-dc", source: "proxy", target: "docs" },
  { id: "p-ca", source: "proxy", target: "calendar" },
  { id: "p-ma", source: "proxy", target: "mail" },
  { id: "p-sc", source: "proxy", target: "scheduler" },
  { id: "p-of", source: "proxy", target: "office" },
  { id: "p-me", source: "proxy", target: "metrics" },
  // Services → DB
  { id: "id-pg", source: "identity", target: "postgres", style: { stroke: "#9333ea", strokeDasharray: "4" } },
  { id: "st-pg", source: "storage", target: "postgres", style: { stroke: "#9333ea", strokeDasharray: "4" } },
  { id: "sc-pg", source: "scheduler", target: "postgres", style: { stroke: "#9333ea", strokeDasharray: "4" } },
  { id: "dc-pg", source: "docs", target: "postgres", style: { stroke: "#9333ea", strokeDasharray: "4" } },
  { id: "ca-pg", source: "calendar", target: "postgres", style: { stroke: "#9333ea", strokeDasharray: "4" } },
  { id: "ma-pg", source: "mail", target: "postgres", style: { stroke: "#9333ea", strokeDasharray: "4" } },
  // Services → Redis
  { id: "id-rd", source: "identity", target: "redis", style: { stroke: "#ef4444", strokeDasharray: "4" } },
  { id: "sc-rd", source: "scheduler", target: "redis", style: { stroke: "#ef4444", strokeDasharray: "4" } },
  // AI → Docs (RAG indexing)
  { id: "ai-dc", source: "ai", target: "docs", style: { stroke: "#f59e0b" }, label: "RAG" },
  // Collab → Docs
  { id: "co-dc", source: "collab", target: "docs", style: { stroke: "#10b981" } },
];

export function ServiceGraph() {
  const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const legend = useMemo(() => [
    { color: "border-blue-400 bg-blue-50", label: "Backend service" },
    { color: "border-green-400 bg-green-50", label: "Frontend" },
    { color: "border-purple-400 bg-purple-50", label: "Infrastructure" },
  ], []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-bold">Service Dependency Graph</h2>
        </div>
        <div className="flex items-center gap-3">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded border-2 ${l.color}`} />
              <span className="text-xs text-gray-600">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[600px] w-full rounded-xl border border-gray-200 bg-white overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-right"
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const t = (n.data as unknown as ServiceNodeData)?.type;
              if (t === "frontend") return "#86efac";
              if (t === "infra") return "#c4b5fd";
              return "#93c5fd";
            }}
            maskColor="rgba(255,255,255,0.7)"
          />
        </ReactFlow>
      </div>

      <p className="text-xs text-gray-400">
        Nodes are draggable. Solid lines = HTTP calls. Dashed lines = DB/cache connections.
      </p>
    </div>
  );
}
