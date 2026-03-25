"use client";

import React, { useState, useEffect, useCallback } from "react";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import {
  Table2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface SheetData {
  rows: (string | number | boolean | null)[][];
  sheetName: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SheetEmbedView({ node, updateAttributes, selected }: NodeViewProps) {
  const { sheetId, sheetName, range, lastRefreshed } = node.attrs;
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sheetId) {
      setError("No sheet ID specified");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { docsApi } = await import("@/lib/api/docs");
      const res = await docsApi.getSpreadsheetRows(sheetId);
      const rows = res.data?.rows || [];

      // Apply range filter if specified (e.g., "A1:D10")
      let filteredRows = rows;
      if (range) {
        const parsed = parseRange(range);
        if (parsed) {
          filteredRows = rows
            .slice(parsed.startRow, parsed.endRow + 1)
            .map((row) => row.slice(parsed.startCol, parsed.endCol + 1));
        }
      }

      setData({ rows: filteredRows, sheetName });
      updateAttributes({ lastRefreshed: new Date().toISOString() });
    } catch (err) {
      setError("Failed to load sheet data. The sheet may not exist or is inaccessible.");
    } finally {
      setLoading(false);
    }
  }, [sheetId, range, sheetName, updateAttributes]);

  useEffect(() => {
    fetchData();
  }, [sheetId]);

  const openSheet = () => {
    window.open(`/sheets/${sheetId}`, "_blank");
  };

  return (
    <NodeViewWrapper
      className={cn(
        "my-4 rounded-lg border bg-card shadow-sm overflow-hidden transition-shadow",
        selected && "ring-2 ring-primary/50 shadow-md"
      )}
      data-drag-handle
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm font-medium truncate">{sheetName || "Embedded Sheet"}</span>
          {range && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {range}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchData}
            disabled={loading}
            title="Refresh data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={openSheet}
            title="Open full sheet"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[320px] overflow-auto">
        {loading && !data && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading sheet data...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <tbody>
              {data.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn(
                    "border-b last:border-0",
                    rowIdx === 0 && "bg-muted/30 font-medium"
                  )}
                >
                  {row.map((cell, colIdx) => {
                    const Tag = rowIdx === 0 ? "th" : "td";
                    return (
                      <Tag
                        key={colIdx}
                        className={cn(
                          "px-3 py-1.5 text-left border-r last:border-0 whitespace-nowrap",
                          typeof cell === "number" && "text-right font-mono",
                          rowIdx === 0 && "text-xs uppercase text-muted-foreground"
                        )}
                      >
                        {cell !== null && cell !== undefined ? String(cell) : ""}
                      </Tag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.rows.length === 0 && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            No data in the selected range.
          </div>
        )}
      </div>

      {/* Footer */}
      {lastRefreshed && (
        <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
          Last refreshed: {new Date(lastRefreshed).toLocaleString()}
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ── Range parser ───────────────────────────────────────────────────────────

function parseRange(range: string): {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
} | null {
  // Parse ranges like "A1:D10", "B2:F20"
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) return null;

  const colToNum = (col: string) => {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num - 1; // 0-indexed
  };

  return {
    startCol: colToNum(match[1].toUpperCase()),
    startRow: parseInt(match[2], 10) - 1,
    endCol: colToNum(match[3].toUpperCase()),
    endRow: parseInt(match[4], 10) - 1,
  };
}
