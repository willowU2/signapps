"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeTypeConfig } from "./tab-config";
import type { OrgNode } from "@/types/org";

export interface ListViewProps {
  nodes: OrgNode[];
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
  searchQuery: string;
}

export function ListView({
  nodes,
  selectedId,
  onSelect,
  searchQuery,
}: ListViewProps) {
  const [sortField, setSortField] = useState<
    "name" | "node_type" | "sort_order"
  >("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, n.name);
    }
    return map;
  }, [nodes]);

  const filtered = useMemo(() => {
    let list = [...nodes];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.code?.toLowerCase().includes(q) ||
          n.node_type.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [nodes, searchQuery, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  };

  return (
    <div className="overflow-auto h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("name")}
            >
              Nom <SortIcon field="name" />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("node_type")}
            >
              Type <SortIcon field="node_type" />
            </TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground py-12"
              >
                Aucun noeud
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((node) => {
              const nodeCfg = getNodeTypeConfig(node.node_type);
              return (
                <TableRow
                  key={node.id}
                  className={cn(
                    "cursor-pointer",
                    selectedId === node.id && "bg-primary/5",
                  )}
                  onClick={() => onSelect(node)}
                >
                  <TableCell className="font-medium">{node.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        nodeCfg.color,
                        nodeCfg.bg,
                      )}
                    >
                      {nodeCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {node.parent_id
                      ? (parentMap.get(node.parent_id) ?? "\u2014")
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {node.code ?? "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={node.is_active ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {node.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
