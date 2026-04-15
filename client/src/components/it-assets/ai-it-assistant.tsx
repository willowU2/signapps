"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Cpu,
  HardDrive,
  AlertTriangle,
} from "lucide-react";
import { aiApi } from "@/lib/api/ai";
import {
  HardwareAsset,
  AgentMetric,
  ITAlert,
  Patch,
} from "@/lib/api/it-assets";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AiItAssistantProps {
  selectedAsset?: HardwareAsset | null;
  metrics?: AgentMetric[];
  alerts?: ITAlert[];
  patches?: Patch[];
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  asset?: HardwareAsset | null,
  metrics?: AgentMetric[],
  alerts?: ITAlert[],
  patches?: Patch[],
): string {
  const lines: string[] = [
    "Tu es un assistant IT expert. Tu aides les administrateurs systeme a diagnostiquer des problemes, optimiser les performances et planifier la maintenance.",
    "Reponds en francais, de facon concise et pratique. Utilise des listes a puces quand c'est pertinent.",
  ];

  if (asset) {
    lines.push(
      `\nEquipement selectionne: ${asset.name} (${asset.type}) — statut: ${asset.status ?? "inconnu"}, localisation: ${asset.location ?? "N/A"}`,
    );
    if (asset.manufacturer)
      lines.push(`Fabricant: ${asset.manufacturer} ${asset.model ?? ""}`);
  }

  if (metrics && metrics.length > 0) {
    const latest = metrics[0];
    lines.push(`\nDernieres metriques:`);
    if (latest.cpu_usage != null)
      lines.push(`  CPU: ${latest.cpu_usage.toFixed(1)}%`);
    if (latest.memory_usage != null)
      lines.push(`  RAM: ${latest.memory_usage.toFixed(1)}%`);
    if (latest.disk_usage != null)
      lines.push(`  Disque: ${latest.disk_usage.toFixed(1)}%`);

    // Trend: compare first vs last
    if (metrics.length > 1) {
      const oldest = metrics[metrics.length - 1];
      if (latest.disk_usage != null && oldest.disk_usage != null) {
        const diff = latest.disk_usage - oldest.disk_usage;
        lines.push(
          `  Tendance disque: ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}% sur la periode`,
        );
      }
    }
  }

  if (alerts && alerts.length > 0) {
    const active = alerts.filter((a) => !a.resolved_at);
    if (active.length > 0) {
      lines.push(`\nAlertes actives (${active.length}):`);
      active
        .slice(0, 5)
        .forEach((a) =>
          lines.push(
            `  - Alerte sur equipement ${a.hardware_id} (valeur: ${a.value ?? "N/A"})`,
          ),
        );
    }
  }

  if (patches && patches.length > 0) {
    const critical = patches.filter(
      (p) => p.severity === "critical" && p.status === "pending",
    );
    const pending = patches.filter((p) => p.status === "pending");
    lines.push(
      `\nPatches: ${pending.length} en attente dont ${critical.length} critiques`,
    );
    critical
      .slice(0, 3)
      .forEach((p) => lines.push(`  - [CRITIQUE] ${p.title}`));
  }

  return lines.join("\n");
}

// ─── Suggested Questions ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Pourquoi ce serveur est lent ?",
  "Quels patches sont critiques ?",
  "Comment reduire l'usage CPU ?",
  "Y a-t-il des risques de panne ?",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AiItAssistant({
  selectedAsset,
  metrics,
  alerts,
  patches,
}: AiItAssistantProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (open && !minimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, minimized]);

  const sendMessage = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: q,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const systemPrompt = buildSystemPrompt(
          selectedAsset,
          metrics,
          alerts,
          patches,
        );
        const res = await aiApi.chat(q, { systemPrompt, language: "fr" });
        const answer =
          (res.data as { answer?: string; response?: string })?.answer ??
          (res.data as { answer?: string; response?: string })?.response ??
          "Desolee, je n'ai pas pu generer de reponse.";

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: answer,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errMsg: ChatMessage = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "Erreur de connexion au service AI. Veuillez reessayer.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, selectedAsset, metrics, alerts, patches],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
        aria-label="Ouvrir l'assistant IT"
      >
        <Bot className="h-4 w-4" />
        Assistant IT
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-xl border bg-background shadow-2xl transition-all ${minimized ? "h-12 w-72" : "h-[500px] w-[420px]"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl border-b bg-primary px-4 py-2.5">
        <div className="flex items-center gap-2 text-primary-foreground">
          <Bot className="h-4 w-4" />
          <span className="text-sm font-semibold">Assistant IT</span>
          {selectedAsset && (
            <Badge className="bg-white/20 text-primary-foreground text-xs border-0">
              {selectedAsset.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="rounded p-1 text-primary-foreground/80 hover:bg-white/20"
          >
            {minimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-primary-foreground/80 hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Context pills */}
          {metrics?.length || alerts?.length || patches?.length ? (
            <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
              {metrics && metrics.length > 0 && (
                <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
                  <Cpu className="h-3 w-3" />
                  Metriques
                </Badge>
              )}
              {alerts && alerts.filter((a) => !a.resolved_at).length > 0 && (
                <Badge className="text-xs bg-red-500/10 text-red-600 border-red-500/20 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {alerts.filter((a) => !a.resolved_at).length} alertes
                </Badge>
              )}
              {patches &&
                patches.filter(
                  (p) => p.severity === "critical" && p.status === "pending",
                ).length > 0 && (
                  <Badge className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20 gap-1">
                    <HardDrive className="h-3 w-3" />
                    Patches critiques
                  </Badge>
                )}
            </div>
          ) : null}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Questions suggeries :
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">
                    {msg.content}
                  </pre>
                  <p className="mt-1 text-[10px] opacity-60">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-muted px-4 py-2.5">
                  <div className="flex gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t p-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Poser une question IT..."
              className="h-8 text-sm"
              disabled={loading}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
