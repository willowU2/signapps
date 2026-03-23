"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight } from "lucide-react";

export interface DocumentVersion {
  id: string;
  version: number;
  timestamp: Date;
  author: string;
  content: string;
}

export interface DocCompareProps {
  versions: DocumentVersion[];
  onVersionSelect?: (versionId: string) => void;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const diff: DiffLine[] = [];

  // Simple line-by-line diff
  const maxLength = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i] || "";
    const newLine = newLines[i] || "";

    if (oldLine === newLine) {
      diff.push({ type: "unchanged", content: oldLine, lineNumber: i + 1 });
    } else {
      if (oldLine) {
        diff.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
      }
      if (newLine) {
        diff.push({ type: "added", content: newLine, lineNumber: i + 1 });
      }
    }
  }

  return diff;
}

export function DocCompare({ versions, onVersionSelect }: DocCompareProps) {
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(
    Math.max(0, versions.length - 1)
  );

  const baseVersion = versions[0];
  const selectedVersion = versions[selectedVersionIndex];

  const diff = useMemo(
    () => (baseVersion && selectedVersion ? computeDiff(baseVersion.content, selectedVersion.content) : []),
    [baseVersion, selectedVersion]
  );

  const handleVersionChange = (versionId: string) => {
    const index = versions.findIndex((v) => v.id === versionId);
    if (index !== -1) {
      setSelectedVersionIndex(index);
      onVersionSelect?.(versionId);
    }
  };

  if (!baseVersion || !selectedVersion) {
    return (
      <Card className="p-6 text-center">
        <p className="text-gray-500">Aucune version disponible pour la comparaison</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Comparaison des versions</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Comparer vers:</span>
          <Select value={selectedVersion.id} onValueChange={handleVersionChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  v{version.version} - {version.author} ({version.timestamp.toLocaleDateString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Version Info */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 uppercase">Base</p>
          <p className="text-sm text-gray-700 mt-1">v{baseVersion.version}</p>
          <p className="text-xs text-gray-500 mt-1">{baseVersion.author}</p>
          <p className="text-xs text-gray-500">
            {baseVersion.timestamp.toLocaleDateString()} {baseVersion.timestamp.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center justify-center">
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </div>

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs font-semibold text-blue-600 uppercase">Comparaison</p>
          <p className="text-sm text-blue-700 mt-1">v{selectedVersion.version}</p>
          <p className="text-xs text-blue-600 mt-1">{selectedVersion.author}</p>
          <p className="text-xs text-blue-600">
            {selectedVersion.timestamp.toLocaleDateString()} {selectedVersion.timestamp.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Side-by-side diff view */}
      <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
        {/* Original */}
        <div className="space-y-0 font-mono text-xs">
          <div className="text-gray-600 font-semibold mb-2">Version de base</div>
          <div className="space-y-0">
            {baseVersion.content.split("\n").map((line, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-gray-400 w-6 text-right">{idx + 1}</span>
                <span className="flex-1 text-gray-700">{line || "\u00A0"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison with highlights */}
        <div className="space-y-0 font-mono text-xs">
          <div className="text-gray-600 font-semibold mb-2">Version {selectedVersion.version}</div>
          <div className="space-y-0">
            {diff.map((line, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${
                  line.type === "added"
                    ? "bg-green-100"
                    : line.type === "removed"
                    ? "bg-red-100"
                    : "bg-transparent"
                }`}
              >
                <span
                  className={`w-6 text-right ${
                    line.type === "added"
                      ? "text-green-700"
                      : line.type === "removed"
                      ? "text-red-700"
                      : "text-gray-400"
                  }`}
                >
                  {line.lineNumber}
                </span>
                <span
                  className={`flex-1 ${
                    line.type === "added"
                      ? "text-green-900 font-semibold"
                      : line.type === "removed"
                      ? "text-red-900 line-through opacity-70"
                      : "text-gray-700"
                  }`}
                >
                  {line.content || "\u00A0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="text-center p-2 bg-green-50 rounded border border-green-200">
          <p className="text-green-700 font-semibold">
            {diff.filter((d) => d.type === "added").length} additions
          </p>
        </div>
        <div className="text-center p-2 bg-red-50 rounded border border-red-200">
          <p className="text-red-700 font-semibold">
            {diff.filter((d) => d.type === "removed").length} suppressions
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-gray-700 font-semibold">
            {diff.filter((d) => d.type === "unchanged").length} inchangés
          </p>
        </div>
      </div>
    </Card>
  );
}
