"use client";

// Feature 29: Project → generate status report as doc

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ProjectStatusData {
  projectName: string;
  date: string;
  overallStatus: "On Track" | "At Risk" | "Delayed";
  progress: number;
  budget: { total: number; spent: number };
  completedMilestones: string[];
  upcomingMilestones: string[];
  risks: string[];
  teamHighlights: string[];
  nextSteps: string[];
}

const DEMO_DATA: ProjectStatusData = {
  projectName: "Refonte Backend Auth",
  date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  overallStatus: "On Track",
  progress: 62,
  budget: { total: 45000, spent: 28500 },
  completedMilestones: ["Spécifications API JWT", "Prototype POC Axum", "Revue sécurité"],
  upcomingMilestones: ["Tests de charge (15 avr.)", "Staging deployment (25 avr.)"],
  risks: ["Disponibilité QA pour sprint 4", "Dépendance librairie externe non confirmée"],
  teamHighlights: ["Alice Martin: 92% taux de livraison dans les délais", "Bob Dupont: infrastructure stabilisée"],
  nextSteps: ["Finaliser les tests unitaires", "Planifier la revue de sécurité finale", "Préparer le plan de déploiement"],
};

function generateReport(data: ProjectStatusData): string {
  const statusEmoji = data.overallStatus === "On Track" ? "✅" : data.overallStatus === "At Risk" ? "⚠️" : "🔴";
  const budgetPct = Math.round((data.budget.spent / data.budget.total) * 100);

  return `# Rapport de statut — ${data.projectName}
**Date:** ${data.date}
**Statut global:** ${statusEmoji} ${data.overallStatus}
**Avancement:** ${data.progress}%

---

## Budget
- Total alloué: ${data.budget.total.toLocaleString("fr-FR")} €
- Consommé: ${data.budget.spent.toLocaleString("fr-FR")} € (${budgetPct}%)
- Restant: ${(data.budget.total - data.budget.spent).toLocaleString("fr-FR")} €

## Jalons complétés
${data.completedMilestones.map((m) => `- ✅ ${m}`).join("\n")}

## Jalons à venir
${data.upcomingMilestones.map((m) => `- 🔵 ${m}`).join("\n")}

## Risques identifiés
${data.risks.map((r) => `- ⚠️ ${r}`).join("\n")}

## Temps forts de l'équipe
${data.teamHighlights.map((h) => `- ${h}`).join("\n")}

## Prochaines étapes
${data.nextSteps.map((s) => `- ${s}`).join("\n")}

---
*Généré automatiquement par AgentIQ — SignApps Platform*`;
}

const STATUS_CONFIG = {
  "On Track": "bg-green-100 text-green-800",
  "At Risk": "bg-yellow-100 text-yellow-800",
  Delayed: "bg-red-100 text-red-800",
};

export function ProjectStatusReport() {
  const [report, setReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setReport(generateReport(DEMO_DATA));
    setGenerating(false);
  }

  function copyToClipboard() {
    if (!report) return;
    navigator.clipboard.writeText(report);
    toast.success("Rapport copié dans le presse-papier");
  }

  function downloadAsMarkdown() {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${DEMO_DATA.projectName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rapport téléchargé");
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Rapport de statut
          </CardTitle>
          <Badge className={STATUS_CONFIG[DEMO_DATA.overallStatus]}>{DEMO_DATA.overallStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {DEMO_DATA.projectName} · Avancement: {DEMO_DATA.progress}% · Budget: {Math.round((DEMO_DATA.budget.spent / DEMO_DATA.budget.total) * 100)}% consommé
        </div>

        {!report ? (
          <Button className="w-full h-8 gap-1 text-xs" onClick={generate} disabled={generating}>
            {generating ? <RefreshCw className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
            {generating ? "Génération en cours..." : "Générer le rapport"}
          </Button>
        ) : (
          <>
            <Textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              className="min-h-[220px] font-mono text-[11px] resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-7 gap-1 text-xs" onClick={copyToClipboard}>
                <Copy className="size-3.5" /> Copier
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-7 gap-1 text-xs" onClick={downloadAsMarkdown}>
                <Download className="size-3.5" /> .md
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={generate}>
                <RefreshCw className="size-3.5" /> Refaire
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
