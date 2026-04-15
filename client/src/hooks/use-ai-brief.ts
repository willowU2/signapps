import { useQuery } from "@tanstack/react-query";
import { aiApi, type ChatResponse } from "@/lib/api";
import type { DashboardData } from "./use-dashboard";

export interface AiBriefResult {
  summary: string;
  sources?: ChatResponse["sources"];
  generatedAt: number;
}

function buildBriefPrompt(data?: DashboardData): string {
  if (!data) {
    return "Donne un résumé rapide de l'état de l'infrastructure SignApps. Réponds en 3-4 phrases concises en français.";
  }

  return `Tu es l'assistant IA de SignApps. Voici l'état actuel de l'infrastructure :
- Containers : ${data.runningContainers}/${data.containers} actifs
- CPU : ${data.cpu}%
- RAM : ${data.memory}%
- Disque : ${data.disk}%
- Routes : ${data.routes}
- Stockage : ${data.storage}
- Uptime : ${Math.round(data.uptime / 3600)}h
- Réseau : ${formatBytes(data.networkRx)} reçu / ${formatBytes(data.networkTx)} envoyé

Génère un brief quotidien en français (3-4 phrases). Mentionne les points critiques (CPU/RAM > 80%, containers arrêtés). Sois concis et actionnable. Ne mets pas de titre ni de bullet points, juste un paragraphe fluide.`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function useAiBrief(data?: DashboardData) {
  return useQuery<AiBriefResult>({
    queryKey: ["ai-brief", data?.containers, data?.cpu, data?.routes],
    queryFn: async () => {
      const prompt = buildBriefPrompt(data);
      const res = await aiApi.chat(prompt, {
        language: "fr",
        systemPrompt:
          "Tu es un assistant DevOps concis. Réponds toujours en français, en 3-4 phrases maximum.",
      });
      return {
        summary: res.data.answer,
        sources: res.data.sources,
        generatedAt: Date.now(),
      };
    },
    enabled: !!data,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // refresh every 10 minutes
    retry: 1,
  });
}
