"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditResult {
  id: string;
  rule: string;
  severity: "error" | "warning" | "info";
  element: string;
  fixSuggestion: string;
}

export default function WcagChecker() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [complianceScore, setComplianceScore] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const runAudit = async () => {
    setIsScanning(true);
    // Simulated audit - in production, use axe-core or similar library
    const mockResults: AuditResult[] = [
      {
        id: "1",
        rule: "Image alt text missing",
        severity: "error",
        element: "<img src='logo.png'>",
        fixSuggestion: 'Add alt="Company Logo" attribute',
      },
      {
        id: "2",
        rule: "Low contrast ratio",
        severity: "warning",
        element: "<p class='subtitle'>",
        fixSuggestion: "Increase foreground contrast to 4.5:1",
      },
      {
        id: "3",
        rule: "Form label missing",
        severity: "error",
        element: "<input id='email'>",
        fixSuggestion: 'Add <label htmlFor="email">Email</label>',
      },
    ];
    setResults(mockResults);
    setComplianceScore(78);
    setIsScanning(false);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">WCAG Compliance Audit</h2>
        <Button onClick={runAudit} disabled={isScanning}>
          {isScanning ? "Scanning..." : "Run Audit"}
        </Button>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-sm font-medium">Compliance Score: {complianceScore}%</p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${complianceScore}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <div
            key={result.id}
            className={`p-3 rounded-lg border-l-4 ${
              result.severity === "error"
                ? "bg-red-50 border-red-400"
                : result.severity === "warning"
                  ? "bg-yellow-50 border-yellow-400"
                  : "bg-blue-50 border-blue-400"
            }`}
          >
            <div className="flex items-start gap-2">
              {result.severity === "error" && (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              {result.severity === "warning" && (
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              )}
              {result.severity === "info" && (
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">{result.rule}</p>
                <p className="text-xs text-gray-600 mt-1">Element: {result.element}</p>
                <p className="text-xs text-gray-700 mt-1">Fix: {result.fixSuggestion}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
