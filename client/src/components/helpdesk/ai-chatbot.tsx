"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  AlertTriangle,
  Ticket,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api/ai";

// ── Types ──
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  timestamp: Date;
  isEscalation?: boolean;
}

interface EscalationFormData {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
}

// ── FAQ articles for RAG context ──
const FAQ_CONTEXT = `
Contexte de support SignApps:
- Creer un compte: page de connexion > "Creer un compte" > email professionnel > email de verification
- Inviter des membres: Parametres > Membres > Inviter > role (Admin/Editeur/Lecteur) > 7 jours de validite
- Changer mot de passe: Parametres > Securite > Mot de passe > 8 car. min + majuscule + chiffre
- 2FA: Parametres > Securite > Authentification > QR code > app Google Authenticator ou Authy
- Plans: Starter (gratuit 5 users), Business (19€/user/mois), Enterprise (sur mesure)
- Telecharger facture: Parametres > Facturation > Historique > icone telechargement > PDF
- Formulaire signature: App Formulaires > Nouveau > palette champs > Signature electronique
- Integrations: Slack, Teams, Zapier, Make, Google Workspace, Microsoft 365, Salesforce, HubSpot
- Donnees: hebergees en France, ISO 27001, HDS, conforme RGPD
- Export donnees: Parametres > Confidentialite > Exporter mes donnees
`.trim();

function extractConfidence(content: string): number {
  // Heuristic: if answer is short/vague, low confidence
  if (content.length < 50) return 0.45;
  if (
    content.includes("je ne sais pas") ||
    content.includes("incertain") ||
    content.includes("peut-etre")
  )
    return 0.55;
  if (content.includes("malheureusement") || content.includes("pas sur"))
    return 0.6;
  // Default: relatively high confidence for FAQ-based answers
  return 0.82 + Math.min(0.15, content.length / 2000);
}

let msgCounter = 0;
function mkId() {
  return `msg-${++msgCounter}-${Date.now()}`;
}

const WELCOME_MSG: ChatMessage = {
  id: mkId(),
  role: "assistant",
  content:
    "Bonjour ! Je suis l'assistant IA de SignApps. Je peux vous aider avec vos questions sur la plateforme. Comment puis-je vous aider ?",
  confidence: 1.0,
  timestamp: new Date(),
};

// ── Escalation Form ──
function EscalationForm({
  initialDesc,
  onSubmit,
  onCancel,
}: {
  initialDesc: string;
  onSubmit: (data: EscalationFormData) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(initialDesc);
  const [priority, setPriority] =
    useState<EscalationFormData["priority"]>("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-200"
    >
      <p className="text-xs font-semibold text-orange-800">
        Transfert vers un agent humain
      </p>
      <div className="space-y-1">
        <label htmlFor="escalation-title" className="text-xs font-medium">
          Titre du ticket *
        </label>
        <Input
          id="escalation-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resumez votre probleme"
          className="text-xs h-7"
          required
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="escalation-desc" className="text-xs font-medium">
          Description
        </label>
        <Textarea
          id="escalation-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="text-xs resize-none"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="escalation-priority" className="text-xs font-medium">
          Priorite
        </label>
        <select
          id="escalation-priority"
          value={priority}
          onChange={(e) =>
            setPriority(e.target.value as EscalationFormData["priority"])
          }
          className="w-full text-xs border rounded-md px-2 py-1 bg-background"
        >
          <option value="low">Basse</option>
          <option value="medium">Moyenne</option>
          <option value="high">Haute</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1 h-7 text-xs">
          <Ticket className="w-3 h-3 mr-1" />
          Creer le ticket
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

// ── Message bubble ──
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isLowConfidence =
    typeof message.confidence === "number" && message.confidence < 0.7;

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-primary" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] space-y-1",
          isUser ? "items-end" : "items-start",
          "flex flex-col",
        )}
      >
        <div
          className={cn(
            "px-3 py-2 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm",
            message.isEscalation &&
              "bg-orange-50 border border-orange-200 text-orange-900",
          )}
        >
          {message.content}
        </div>
        {!isUser &&
          typeof message.confidence === "number" &&
          message.confidence < 1.0 && (
            <div className="flex items-center gap-1">
              <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    message.confidence >= 0.7
                      ? "bg-green-500"
                      : message.confidence >= 0.5
                        ? "bg-orange-400"
                        : "bg-red-400",
                  )}
                  style={{ width: `${message.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(message.confidence * 100)}% confiance
              </span>
              {isLowConfidence && (
                <AlertTriangle className="w-3 h-3 text-orange-400" />
              )}
            </div>
          )}
      </div>
    </div>
  );
}

// ── Main Chatbot ──
export function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [escalationDesc, setEscalationDesc] = useState("");
  const [ticketCreated, setTicketCreated] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: mkId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const systemPrompt = `Tu es un assistant de support pour SignApps, une plateforme collaborative.
Reponds en francais de maniere concise et utile.
Base tes reponses sur ces informations:
${FAQ_CONTEXT}
Si tu n'es pas sur de la reponse, dis-le clairement.`;

        const response = await aiApi.chat(text.trim(), {
          systemPrompt,
          language: "fr",
          includesSources: false,
        });

        const answerContent =
          (
            response as {
              data?: { answer?: string; response?: string };
              answer?: string;
              response?: string;
            }
          )?.data?.answer ??
          (
            response as {
              data?: { answer?: string; response?: string };
              answer?: string;
              response?: string;
            }
          )?.data?.response ??
          (response as { answer?: string; response?: string })?.answer ??
          (response as { answer?: string; response?: string })?.response ??
          "Je suis desole, je n'ai pas pu traiter votre demande. Voulez-vous que je vous mette en contact avec un agent ?";

        const confidence = extractConfidence(answerContent);

        const assistantMsg: ChatMessage = {
          id: mkId(),
          role: "assistant",
          content: answerContent,
          confidence,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Auto-suggest escalation if confidence < 70%
        if (confidence < 0.7) {
          const escalationHint: ChatMessage = {
            id: mkId(),
            role: "assistant",
            content:
              "Ma reponse n'est pas certaine a 100%. Souhaitez-vous parler a un agent humain ?",
            confidence: 1.0,
            isEscalation: true,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, escalationHint]);
          setEscalationDesc(
            `Question: ${text}\n\nReponse IA: ${answerContent}`,
          );
        }
      } catch {
        const errMsg: ChatMessage = {
          id: mkId(),
          role: "assistant",
          content:
            "Desolee, le service IA est temporairement indisponible. Puis-je vous rediriger vers notre equipe de support ?",
          confidence: 1.0,
          isEscalation: true,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setEscalationDesc(`Question: ${text}`);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleEscalate = () => {
    setShowEscalation(true);
    setEscalationDesc(
      messages
        .filter((m) => m.role === "user")
        .slice(-2)
        .map((m) => m.content)
        .join("\n"),
    );
  };

  const handleTicketSubmit = (data: EscalationFormData) => {
    // Store in localStorage (helpdesk page will pick it up)
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const ticket = {
      id: ticketId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: "open",
      category: "support",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + 24 * 3600000).toISOString(),
    };

    try {
      const existing = JSON.parse(
        localStorage.getItem("signapps-helpdesk-tickets") ?? "[]",
      );
      localStorage.setItem(
        "signapps-helpdesk-tickets",
        JSON.stringify([ticket, ...existing]),
      );
    } catch {
      /* ignore */
    }

    setShowEscalation(false);
    setTicketCreated(ticketId);

    const confirmMsg: ChatMessage = {
      id: mkId(),
      role: "assistant",
      content: `Ticket cree avec succes ! Votre demande a ete transmise a notre equipe sous la reference ${ticketId}. Vous recevrez une reponse dans les meilleurs delais.`,
      confidence: 1.0,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  const QUICK_QUESTIONS = [
    "Comment creer un compte ?",
    "Comment inviter des membres ?",
    "Ou trouver mes factures ?",
    "Comment activer la 2FA ?",
  ];

  return (
    <>
      {/* Chat window */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 shadow-2xl animate-in slide-in-from-bottom-3 duration-200"
          role="dialog"
          aria-label="Assistant IA SignApps"
          aria-modal="false"
        >
          <Card className="border-2 border-primary/20">
            {/* Header */}
            <CardHeader className="pb-2 bg-primary/5 rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  Assistant SignApps
                  <div
                    className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                    aria-label="En ligne"
                  />
                </CardTitle>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Fermer le chat"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Messages */}
              <div
                className="h-72 overflow-y-auto p-3 space-y-3"
                role="log"
                aria-live="polite"
                aria-label="Historique du chat"
              >
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}

                {loading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-2xl rounded-tl-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}

                {/* Escalation form */}
                {showEscalation && (
                  <EscalationForm
                    initialDesc={escalationDesc}
                    onSubmit={handleTicketSubmit}
                    onCancel={() => setShowEscalation(false)}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick questions */}
              {messages.length === 1 && (
                <div className="px-3 pb-2">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Questions frequentes :
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
                        disabled={loading}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Escalation CTA */}
              {!showEscalation && messages.length > 2 && (
                <div className="px-3 pb-2">
                  <button
                    onClick={handleEscalate}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Parler a un humain →
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="flex items-center gap-2 p-3 border-t">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez votre question..."
                  className="text-sm h-8"
                  disabled={loading}
                  aria-label="Votre message"
                />
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  aria-label="Envoyer le message"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center justify-center",
          isOpen
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
        aria-label={isOpen ? "Fermer le chat" : "Ouvrir l'assistant IA"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6" />
            {ticketCreated && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-white text-xs flex items-center justify-center">
                1
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
