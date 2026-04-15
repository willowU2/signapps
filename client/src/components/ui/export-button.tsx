"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  /** Optional column headers mapping: key -> display label */
  columns?: Record<string, string>;
  className?: string;
}

function flattenValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return val.join("; ");
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function exportCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns?: Record<string, string>,
) {
  if (data.length === 0) {
    toast.error("Aucune donnee a exporter");
    return;
  }

  const keys = columns ? Object.keys(columns) : Object.keys(data[0]);
  const headers = columns ? keys.map((k) => columns[k]) : keys;

  const rows = data.map((row) =>
    keys.map((key) => escapeCSV(flattenValue(row[key]))).join(","),
  );

  const csv =
    "\uFEFF" + [headers.map((h) => escapeCSV(h)).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${filename}.csv`);
  toast.success(`${data.length} lignes exportees (CSV)`);
}

function exportJSON(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) {
    toast.error("Aucune donnee a exporter");
    return;
  }

  const payload = {
    exported_at: new Date().toISOString(),
    total: data.length,
    data,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
  toast.success(`${data.length} lignes exportees (JSON)`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportButton({
  data,
  filename,
  columns,
  className,
}: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Download className="mr-2 h-4 w-4" />
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCSV(data, filename, columns)}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportJSON(data, filename)}>
          <Download className="mr-2 h-4 w-4" />
          JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
