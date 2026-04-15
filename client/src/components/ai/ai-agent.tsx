"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  Sparkles,
  User,
  RefreshCw,
} from "lucide-react";
import { aiApi } from "@/lib/api/ai";
import { contactsApi } from "@/lib/api/contacts";
import { calendarApi } from "@/lib/api/calendar";
import { mailApi } from "@/lib/api/mail";
import { driveApi } from "@/lib/api/drive";
import { toast } from "sonner";

// Default calendar ID used when none is specified (the agent picks the first available)
const DEFAULT_CALENDAR_ID = "default";

// ── Types ──────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "error";

interface AgentStep {
  id: string;
  label: string;
  status: StepStatus;
  result?: string;
}

interface AgentMessage {
  role: "user" | "agent";
  content: string;
  steps?: AgentStep[];
  timestamp: Date;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AiAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;

    setInput("");
    setIsRunning(true);

    // Add user message
    const userMsg: AgentMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    // Prepare agent message with pending steps (we'll update them)
    const agentMsgId = Date.now().toString();
    const planSteps: AgentStep[] = [];

    // We'll build steps dynamically — add a placeholder agent message first
    const agentMsg: AgentMessage = {
      role: "agent",
      content: "",
      steps: planSteps,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, agentMsg]);
    scrollToBottom();

    try {
      // First pass: get the plan
      const planResponse = await aiApi.chat(trimmed, {
        systemPrompt: `You are an autonomous agent for SignApps (a Google Workspace alternative).
When given a task in natural language, respond ONLY with a JSON object (no markdown, no extra text):
{
  "intent": "short description of overall goal",
  "steps": [
    { "id": "step_1", "action": "search_contact", "label": "Recherche du contact", "params": { "name": "..." } }
  ],
  "summary": "What will be done"
}
Supported actions: search_contact, check_calendar, create_event, send_email, find_document, list_team_members.
Only include steps actually needed. Use ISO dates for dates.`,
        enableTools: false,
      });

      let parsedPlan: {
        steps: Array<{
          id: string;
          action: string;
          label: string;
          params: Record<string, string>;
        }>;
        intent: string;
        summary: string;
      } | null = null;
      try {
        const raw = planResponse.data.answer.trim();
        const jsonStr = raw.startsWith("{") ? raw : raw.slice(raw.indexOf("{"));
        parsedPlan = JSON.parse(jsonStr);
      } catch {
        // Non-structured response — treat as direct answer
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: planResponse.data.answer, steps: [] }
              : m,
          ),
        );
        scrollToBottom();
        return;
      }

      if (!parsedPlan) return;

      // Populate steps immediately so user sees them
      const initialSteps: AgentStep[] = parsedPlan.steps.map((s) => ({
        id: s.id,
        label: s.label,
        status: "pending" as StepStatus,
      }));

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, steps: initialSteps } : m,
        ),
      );
      scrollToBottom();

      // Execute steps one by one, updating state as we go
      const results: Record<string, unknown> = {};

      const updateStep = (
        stepId: string,
        status: StepStatus,
        result?: string,
      ) => {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? {
                  ...m,
                  steps: m.steps?.map((s) =>
                    s.id === stepId ? { ...s, status, result } : s,
                  ),
                }
              : m,
          ),
        );
        scrollToBottom();
      };

      for (const step of parsedPlan.steps) {
        updateStep(step.id, "running");

        try {
          switch (step.action) {
            case "search_contact": {
              const contacts = await contactsApi.list();
              const name = (step.params.name ?? "").toLowerCase();
              const found = contacts.data.filter(
                (c) =>
                  `${c.first_name} ${c.last_name}`
                    .toLowerCase()
                    .includes(name) ||
                  (c.email ?? "").toLowerCase().includes(name),
              );
              results[step.id] = found;
              updateStep(
                step.id,
                "done",
                found.length
                  ? `${found.length} contact(s) trouvé(s)`
                  : "Aucun contact trouvé",
              );
              break;
            }

            case "check_calendar": {
              const now = new Date();
              const nextWeek = new Date(
                now.getTime() + 7 * 24 * 60 * 60 * 1000,
              );
              const events = await calendarApi.listEvents(
                DEFAULT_CALENDAR_ID,
                now,
                nextWeek,
              );
              results[step.id] = events.data;
              updateStep(
                step.id,
                "done",
                `${Array.isArray(events.data) ? events.data.length : 0} événement(s) récupéré(s)`,
              );
              break;
            }

            case "create_event": {
              const startDate = step.params.date
                ? new Date(step.params.date)
                : (() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(10, 0, 0, 0);
                    return d;
                  })();
              const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
              const ev = await calendarApi.createEvent(DEFAULT_CALENDAR_ID, {
                title: step.params.title ?? parsedPlan!.intent,
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                description: "Créé automatiquement par l'agent IA",
              });
              results[step.id] = ev.data;
              updateStep(
                step.id,
                "done",
                `Événement créé : ${ev.data?.title ?? step.params.title}`,
              );
              break;
            }

            case "send_email": {
              const prevContacts = results["step_1"] as
                | Array<{ email?: string }>
                | undefined;
              const toEmail = step.params.to ?? prevContacts?.[0]?.email ?? "";
              if (!toEmail) {
                updateStep(step.id, "error", "Adresse email introuvable");
                break;
              }
              await mailApi.sendEmail({
                account_id: "default",
                recipient: toEmail,
                subject: step.params.subject ?? parsedPlan!.intent,
                body_text:
                  step.params.body ??
                  `Bonjour,\n\n${parsedPlan!.summary}\n\nCordialement`,
              });
              updateStep(step.id, "done", `Email envoyé à ${toEmail}`);
              break;
            }

            case "find_document": {
              const nodes = await driveApi.listNodes();
              const query = (step.params.name ?? "").toLowerCase();
              const found = nodes?.filter((n) =>
                n.name.toLowerCase().includes(query),
              );
              results[step.id] = found;
              updateStep(
                step.id,
                "done",
                found?.length
                  ? `Document trouvé : ${found[0].name}`
                  : "Document non trouvé",
              );
              break;
            }

            case "list_team_members": {
              const contacts = await contactsApi.list();
              results[step.id] = contacts.data;
              updateStep(
                step.id,
                "done",
                `${contacts.data.length} membre(s) récupéré(s)`,
              );
              break;
            }

            default:
              updateStep(step.id, "done", "Étape exécutée");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erreur";
          updateStep(step.id, "error", msg);
        }
      }

      // Final AI summary
      const summaryResp = await aiApi.chat(
        `Résume en 1-2 phrases ce qui a été accompli pour la tâche : "${trimmed}". Résultats: ${JSON.stringify(
          Object.fromEntries(
            Object.entries(results).map(([k, v]) => [
              k,
              Array.isArray(v) ? `${(v as unknown[]).length} items` : String(v),
            ]),
          ),
        )}`,
        {
          enableTools: false,
          systemPrompt:
            "Tu es un assistant qui résume des actions. Réponds en français, de façon concise et positive.",
        },
      );

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: summaryResp.data.answer }
            : m,
        ),
      );
    } catch (err) {
      toast.error("Erreur lors de l'exécution de l'agent");
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? {
                ...m,
                content: "Une erreur s'est produite lors de l'exécution.",
                steps: [],
              }
            : m,
        ),
      );
    } finally {
      setIsRunning(false);
      scrollToBottom();
    }
  }, [input, isRunning, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const StepIcon = ({ status }: { status: StepStatus }) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
      case "done":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="w-full flex flex-col h-[600px]">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          Agent IA autonome
          <Badge variant="secondary" className="text-xs font-normal">
            multi-étapes
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Décrivez une action complexe en langage naturel. L'agent la décompose
          et l'exécute automatiquement.
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
              <Sparkles className="h-10 w-10 opacity-30" />
              <div>
                <p className="text-sm font-medium">Exemples de commandes</p>
                <p className="text-xs mt-1 opacity-75">
                  "Organise une reunion avec Jean mardi"
                </p>
                <p className="text-xs opacity-75">
                  "Envoie le rapport Q1 à l'équipe"
                </p>
                <p className="text-xs opacity-75">
                  "Crée un événement de formation vendredi 14h"
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "agent" && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}

              <div
                className={`max-w-[80%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}
              >
                {msg.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 text-sm">
                    {msg.content}
                  </div>
                ) : (
                  <>
                    {/* Steps */}
                    {msg.steps && msg.steps.length > 0 && (
                      <div className="bg-muted/50 border rounded-xl p-3 space-y-2 w-full">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Exécution
                        </p>
                        {msg.steps.map((step) => (
                          <div key={step.id} className="flex items-start gap-2">
                            <div className="mt-0.5">
                              <StepIcon status={step.status} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs font-medium ${step.status === "error" ? "text-red-600" : ""}`}
                              >
                                {step.label}
                              </p>
                              {step.result && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {step.result}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Final content */}
                    {msg.content && (
                      <div className="bg-background border rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                        {msg.steps &&
                        msg.steps.some((s) => s.status === "running") ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            En cours...
                          </span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    )}

                    {/* Running indicator while no content yet */}
                    {!msg.content &&
                      msg.steps &&
                      msg.steps.some((s) => s.status === "running") && (
                        <div className="bg-background border rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Analyse en cours...
                          </span>
                        </div>
                      )}
                  </>
                )}

                <p className="text-[10px] text-muted-foreground px-1">
                  {msg.timestamp.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {msg.role === "user" && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="border-t p-3 flex gap-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setMessages([])}
              disabled={isRunning}
              title="Nouvelle conversation"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Input
            placeholder="Décrivez une action complexe..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            className="flex-1"
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isRunning}
            size="icon"
            className="shrink-0"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
