"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Search, User, Users } from "lucide-react";

interface OrgNode {
  id: string;
  name: string;
  title: string;
  department: string;
  avatar?: string;
  children?: OrgNode[];
}

const ORG_DATA: OrgNode = {
  id: "1",
  name: "Marie Directrice",
  title: "PDG",
  department: "Direction",
  children: [
    {
      id: "2",
      name: "Thomas Dev",
      title: "CTO",
      department: "Technologie",
      children: [
        {
          id: "5",
          name: "Alice Martin",
          title: "Lead Dev",
          department: "Technologie",
          children: [
            {
              id: "9",
              name: "Luc Frontend",
              title: "Dev Frontend",
              department: "Technologie",
            },
            {
              id: "10",
              name: "Emma Backend",
              title: "Dev Backend",
              department: "Technologie",
            },
          ],
        },
        {
          id: "6",
          name: "Bob Dupont",
          title: "DevOps",
          department: "Technologie",
        },
      ],
    },
    {
      id: "3",
      name: "Sophie Commerce",
      title: "Directrice Commerciale",
      department: "Commercial",
      children: [
        {
          id: "7",
          name: "David Vente",
          title: "Commercial Senior",
          department: "Commercial",
        },
        {
          id: "8",
          name: "Claire Support",
          title: "Support Client",
          department: "Commercial",
        },
      ],
    },
    {
      id: "4",
      name: "Jean Finance",
      title: "DAF",
      department: "Finance",
      children: [
        {
          id: "11",
          name: "Nadia Comptable",
          title: "Comptable",
          department: "Finance",
        },
      ],
    },
  ],
};

const DEPT_COLORS: Record<string, string> = {
  Direction: "bg-purple-100 border-purple-300",
  Technologie: "bg-blue-100 border-blue-300",
  Commercial: "bg-green-100 border-green-300",
  Finance: "bg-amber-100 border-amber-300",
};

function countAll(node: OrgNode): number {
  return 1 + (node.children?.reduce((s, c) => s + countAll(c), 0) || 0);
}

function matchesSearch(node: OrgNode, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    node.name.toLowerCase().includes(lower) ||
    node.title.toLowerCase().includes(lower) ||
    node.department.toLowerCase().includes(lower)
  );
}

function OrgNodeCard({
  node,
  expanded,
  onToggle,
  onSelect,
  selected,
  searchQuery,
}: {
  node: OrgNode;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (n: OrgNode) => void;
  selected: string | null;
  searchQuery: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selected === node.id;
  const isHighlighted = searchQuery && matchesSearch(node, searchQuery);

  return (
    <div
      className={`rounded-lg border-2 p-3 cursor-pointer transition-all w-48 ${DEPT_COLORS[node.department] || "bg-muted border-border"} ${isSelected ? "ring-2 ring-blue-500 shadow-md" : "hover:shadow-md"} ${isHighlighted ? "ring-2 ring-yellow-400" : ""}`}
      onClick={() => onSelect(node)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-muted-foreground">
            {node.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">
              {node.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {node.title}
            </p>
          </div>
        </div>
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-0.5 hover:bg-card/50 rounded flex-shrink-0"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{node.department}</span>
        {hasChildren && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Users className="w-3 h-3" />
            {countAll(node) - 1}
          </span>
        )}
      </div>
    </div>
  );
}

function OrgTree({
  node,
  level,
  expandedIds,
  onToggle,
  selectedId,
  onSelect,
  searchQuery,
}: {
  node: OrgNode;
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (n: OrgNode) => void;
  searchQuery: string;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <OrgNodeCard
        node={node}
        expanded={isExpanded}
        onToggle={() => onToggle(node.id)}
        onSelect={onSelect}
        selected={selectedId}
        searchQuery={searchQuery}
      />
      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex gap-8 items-start">
            {node.children!.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-gray-300" />
                <OrgTree
                  node={child}
                  level={level + 1}
                  expandedIds={expandedIds}
                  onToggle={onToggle}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  searchQuery={searchQuery}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function OrgChart() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(["1", "2", "3", "4"]),
  );
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set<string>();
    const collect = (n: OrgNode) => {
      allIds.add(n.id);
      n.children?.forEach(collect);
    };
    collect(ORG_DATA);
    setExpandedIds(allIds);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Organigramme interactif
          </h2>
          <p className="text-muted-foreground">
            Arbre cliquable, expandable et recherchable
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>
          <button
            onClick={handleExpandAll}
            className="px-3 py-2 rounded-lg border text-sm hover:bg-muted"
          >
            Tout déplier
          </button>
          <button
            onClick={() => setExpandedIds(new Set(["1"]))}
            className="px-3 py-2 rounded-lg border text-sm hover:bg-muted"
          >
            Replier
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border bg-card p-6 overflow-auto">
          <OrgTree
            node={ORG_DATA}
            level={0}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            selectedId={selectedNode?.id || null}
            onSelect={setSelectedNode}
            searchQuery={searchQuery}
          />
        </div>

        {selectedNode && (
          <div className="w-64 rounded-lg border bg-card p-4 space-y-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Détails</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-muted-foreground text-lg leading-none"
              >
                &times;
              </button>
            </div>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold mx-auto">
              {selectedNode.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">{selectedNode.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedNode.title}
              </p>
              <span
                className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLORS[selectedNode.department] || "bg-muted"}`}
              >
                {selectedNode.department}
              </span>
            </div>
            {selectedNode.children && selectedNode.children.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  N-1 directs ({selectedNode.children.length})
                </p>
                {selectedNode.children.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted rounded px-1"
                    onClick={() => setSelectedNode(c)}
                  >
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {Object.entries(DEPT_COLORS).map(([dept, cls]) => (
          <div
            key={dept}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-medium ${cls}`}
          >
            {dept}
          </div>
        ))}
      </div>
    </div>
  );
}
