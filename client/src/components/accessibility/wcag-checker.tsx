"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuditResult {
  id: string;
  rule: string;
  severity: "error" | "warning" | "info";
  element: string;
  fixSuggestion: string;
}

function serializeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const attrs = Array.from(el.attributes)
    .slice(0, 3)
    .map((a) => `${a.name}="${a.value}"`)
    .join(" ");
  return `<${tag}${attrs ? " " + attrs : ""}>`;
}

function runDomAudit(): AuditResult[] {
  const results: AuditResult[] = [];
  let idx = 0;

  // 1. Images without alt attribute
  document.querySelectorAll("img:not([alt])").forEach((el) => {
    results.push({
      id: String(++idx),
      rule: "Image alt text missing (WCAG 1.1.1)",
      severity: "error",
      element: serializeElement(el),
      fixSuggestion: 'Add alt="descriptive text" or alt="" for decorative images',
    });
  });

  // 2. Buttons without accessible label
  document.querySelectorAll("button:not([aria-label]):not([aria-labelledby])").forEach((el) => {
    const text = el.textContent?.trim();
    if (!text) {
      results.push({
        id: String(++idx),
        rule: "Button has no accessible label (WCAG 4.1.2)",
        severity: "error",
        element: serializeElement(el),
        fixSuggestion: "Add aria-label or visible text content to the button",
      });
    }
  });

  // 3. Inputs without a label (not hidden, not submit/button/image)
  const labelledInputTypes = new Set(["submit", "button", "image", "hidden", "reset"]);
  document.querySelectorAll("input:not([aria-label]):not([aria-labelledby])").forEach((el) => {
    const input = el as HTMLInputElement;
    if (labelledInputTypes.has(input.type)) return;
    // Check if a <label> references this input by id
    const id = input.id;
    if (id && document.querySelector(`label[for="${id}"]`)) return;
    // Check if input is wrapped in a label
    if (input.closest("label")) return;
    results.push({
      id: String(++idx),
      rule: "Form input has no label (WCAG 1.3.1)",
      severity: "error",
      element: serializeElement(el),
      fixSuggestion: `Add <label for="${input.id || "input-id"}"> or aria-label to the input`,
    });
  });

  // 4. Heading hierarchy — detect skipped levels (h1→h3, h2→h4, etc.)
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(
    (h) => parseInt(h.tagName[1], 10)
  );
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) {
      results.push({
        id: String(++idx),
        rule: `Heading level skipped: h${headings[i - 1]} → h${headings[i]} (WCAG 1.3.1)`,
        severity: "warning",
        element: `<h${headings[i]}>`,
        fixSuggestion: `Use sequential heading levels; do not skip from h${headings[i - 1]} to h${headings[i]}`,
      });
      break; // report once
    }
  }

  if (results.length === 0) {
    results.push({
      id: "ok",
      rule: "No violations found in the current DOM",
      severity: "info",
      element: "document",
      fixSuggestion: "Great! Run again after navigating to other pages.",
    });
  }

  return results;
}

export default function WcagChecker() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [complianceScore, setComplianceScore] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const runAudit = () => {
    setIsScanning(true);
    // DOM queries are synchronous; wrap in setTimeout to let "Scanning…" render
    setTimeout(() => {
      const auditResults = runDomAudit();
      setResults(auditResults);
      const errors = auditResults.filter((r) => r.severity === "error").length;
      const warnings = auditResults.filter((r) => r.severity === "warning").length;
      const total = auditResults.filter((r) => r.id !== "ok").length;
      // Score: start at 100, deduct 10 per error, 5 per warning (min 0)
      const score = total === 0 ? 100 : Math.max(0, 100 - errors * 10 - warnings * 5);
      setComplianceScore(score);
      setIsScanning(false);
    }, 0);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">WCAG Compliance Audit</h2>
        <Button onClick={runAudit} disabled={isScanning}>
          {isScanning ? "Scanning..." : "Run Audit"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm font-medium">Compliance Score: {complianceScore}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${complianceScore}%` }}
            />
          </div>
        </div>
      )}

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
