/* eslint-disable @next/next/no-img-element */
"use client";

import { SpinnerInfinity } from "spinners-react";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ExternalLink,
  FileText,
  Square,
  Paperclip,
  ImageIcon,
  AudioLines,
  Video,
  Wand2,
  Plus,
  History,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ToolCallDisplay,
  ToolCallInfo,
} from "@/components/ai/tool-call-display";
import { VoiceInput } from "@/components/ui/voice-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useAiConversations, Conversation } from "@/hooks/use-ai-conversations";
import { useUIStore } from "@/lib/store";
import { AI_URL } from "@/lib/api/core";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: {
    document_id: string;
    filename: string;
    score: number;
    excerpt: string;
  }[];
  toolCalls?: ToolCallInfo[];
  generatedMedia?: GeneratedMedia[];
  timestamp: number;
}

interface Attachment {
  id: string;
  file: File;
  preview?: string; // data URL for images
  type: "image" | "document" | "audio" | "video";
}

interface GeneratedMedia {
  type: "image" | "audio" | "video";
  url: string;
  alt?: string;
}

type MediaGenMode = "auto" | "image" | "audio" | "none";

// ─── Constants ──────────────────────────────────────────────────────────────

const suggestions = [
  "Résumer les emails de cette semaine",
  "État des containers",
  "Montrer le pipeline CRM",
];

const MEDIA_MODE_LABELS: Record<
  MediaGenMode,
  { label: string; icon: typeof Wand2 }
> = {
  auto: { label: "Auto", icon: Wand2 },
  image: { label: "Image", icon: ImageIcon },
  audio: { label: "Audio", icon: AudioLines },
  none: { label: "Aucun", icon: X },
};

const ACCEPTED_FILE_TYPES =
  "image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,audio/*,video/*";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFileType(file: File): Attachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AiChatBar() {
  const router = useRouter();

  // ── Existing state ──
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [interimText, setInterimText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── New state: conversation tracking ──
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>(
    "Nouvelle conversation",
  );

  // ── New state: attachments ──
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── New state: media generation mode ──
  const [mediaGenMode, setMediaGenMode] = useState<MediaGenMode>("auto");

  // ── Conversation history store ──
  const {
    conversations,
    fetchConversations,
    fetchConversation,
    currentConversation,
    deleteConversation,
  } = useAiConversations();
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // ── Voice transcription ──
  const handleTranscription = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setValue(
        (prev) => prev + (prev && !prev.endsWith(" ") ? " " : "") + text + " ",
      );
      setInterimText("");
    } else {
      setInterimText(text);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, expanded]);

  // Load conversation when selected from history
  useEffect(() => {
    if (currentConversation) {
      setConversationId(currentConversation.id);
      setConversationTitle(currentConversation.title || "Conversation");
      const loaded: ChatMessage[] = currentConversation.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at).getTime(),
        }));
      setMessages(loaded);
      setExpanded(true);
    }
  }, [currentConversation]);

  // ── Attachment handling ──
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment: Attachment = {
          id: `${Date.now()}-${i}`,
          file,
          type: getFileType(file),
        };

        // Generate preview for images
        if (attachment.type === "image") {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id
                  ? { ...a, preview: ev.target?.result as string }
                  : a,
              ),
            );
          };
          reader.readAsDataURL(file);
        }

        newAttachments.push(attachment);
      }

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // ── Stop streaming ──
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  // ── Send message (enhanced) ──
  // Navigation commands — intercept before sending to AI
  const tryNavigate = useCallback(
    (input: string): boolean => {
      const q = input.toLowerCase().trim();
      const NAV_COMMANDS: Record<string, string> = {
        // Direct slash commands
        "/docs": "/docs",
        "/sheets": "/sheets",
        "/slides": "/slides",
        "/mail": "/mail",
        "/calendar": "/cal",
        "/cal": "/cal",
        "/chat": "/chat",
        "/meet": "/meet",
        "/tasks": "/tasks",
        "/drive": "/storage",
        "/storage": "/storage",
        "/social": "/social",
        "/design": "/design",
        "/keep": "/keep",
        "/forms": "/forms",
        "/crm": "/crm",
        "/billing": "/billing",
        "/accounting": "/accounting",
        "/analytics": "/analytics",
        "/projects": "/projects",
        "/contacts": "/contacts",
        "/resources": "/resources",
        "/settings": "/settings",
        "/admin": "/admin/users",
        "/vpn": "/vpn",
        "/monitoring": "/monitoring",
        "/backups": "/backups",
        "/scheduler": "/scheduler",
        "/media": "/media",
        "/workforce": "/workforce/hr",
        "/compliance": "/compliance",
        "/lms": "/lms/catalog",
        "/dashboard": "/dashboard",
        // Natural language FR
        "ouvrir mail": "/mail",
        "ouvrir email": "/mail",
        "aller au mail": "/mail",
        "ouvrir docs": "/docs",
        "ouvrir documents": "/docs",
        "ouvrir le calendrier": "/cal",
        "ouvrir agenda": "/cal",
        "ouvrir chat": "/chat",
        "ouvrir social": "/social",
        "ouvrir design": "/design",
        "ouvrir crm": "/crm",
        "ouvrir meet": "/meet",
        "aller au dashboard": "/dashboard",
        accueil: "/dashboard",
        "ouvrir tâches": "/tasks",
        "ouvrir contacts": "/contacts",
        "ouvrir drive": "/storage",
        "ouvrir notes": "/keep",
        "ouvrir formulaires": "/forms",
        "ouvrir slides": "/slides",
        "ouvrir sheets": "/sheets",
        "ouvrir facturation": "/billing",
        "ouvrir comptabilité": "/accounting",
        "ouvrir projets": "/projects",
        "ouvrir analytics": "/analytics",
        "ouvrir paramètres": "/settings",
        "ouvrir réglages": "/settings",
        "nouveau document": "/docs",
        "nouveau mail": "/mail",
        "nouvelle réunion": "/meet",
        // English
        "open mail": "/mail",
        "open docs": "/docs",
        "open calendar": "/cal",
        "go to dashboard": "/dashboard",
        "open chat": "/chat",
        "open tasks": "/tasks",
        "open drive": "/storage",
        "open settings": "/settings",
      };
      // Check exact match first
      if (NAV_COMMANDS[q]) {
        router.push(NAV_COMMANDS[q]);
        return true;
      }
      // Check partial match (starts with "ouvrir " or "open " or "/")
      for (const [cmd, path] of Object.entries(NAV_COMMANDS)) {
        if (q === cmd || q.startsWith(cmd + " ")) {
          router.push(path);
          return true;
        }
      }
      return false;
    },
    [router],
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const question = (text || value).trim();
      if (!question || isStreaming) return;

      // Try navigation first
      if (tryNavigate(question)) {
        setValue("");
        return;
      }

      const currentAttachments = [...attachments];

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: question,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setValue("");
      setAttachments([]);
      setExpanded(true);
      setIsStreaming(true);

      const assistantId = (Date.now() + 1).toString();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Build request body with new fields
      const requestBody: Record<string, unknown> = {
        question,
        language: "fr",
        include_sources: true,
        enable_tools: true,
      };

      if (conversationId) {
        requestBody.conversation_id = conversationId;
      }

      if (mediaGenMode !== "auto") {
        requestBody.generate_media =
          mediaGenMode === "none" ? false : mediaGenMode;
      }

      // Attach file metadata (names, types, sizes)
      if (currentAttachments.length > 0) {
        requestBody.attachments = currentAttachments.map((a) => ({
          filename: a.file.name,
          content_type: a.file.type,
          size: a.file.size,
          type: a.type,
        }));
      }

      try {
        const res = await fetch(`${AI_URL}/ai/chat/stream`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!res.ok) {
          // Fallback to non-streaming
          const fallbackRes = await fetch(`${AI_URL}/ai/chat`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            // Track conversation_id from response
            if (data.conversation_id) {
              setConversationId(data.conversation_id);
              if (data.conversation_title)
                setConversationTitle(data.conversation_title);
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: data.answer,
                      sources: data.sources,
                      generatedMedia: data.generated_media,
                    }
                  : m,
              ),
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: "Service IA indisponible. Réessayez plus tard.",
                    }
                  : m,
              ),
            );
          }
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;

          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content }
                      : m,
                  ),
                );
              } else if (event.type === "sources") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, sources: event.sources } : m,
                  ),
                );
              } else if (event.type === "tool_call") {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const existing = m.toolCalls || [];
                    return {
                      ...m,
                      toolCalls: [
                        ...existing,
                        {
                          tool: event.tool,
                          parameters: event.parameters || {},
                          pending: true,
                        },
                      ],
                    };
                  }),
                );
              } else if (event.type === "tool_result") {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const toolCalls = (m.toolCalls || []).map((tc) =>
                      tc.tool === event.tool && tc.pending
                        ? {
                            ...tc,
                            pending: false,
                            success: event.success,
                            result: event.result,
                            error: event.error,
                          }
                        : tc,
                    );
                    return { ...m, toolCalls };
                  }),
                );
              } else if (event.type === "media") {
                // Handle generated media in stream
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const existing = m.generatedMedia || [];
                    return {
                      ...m,
                      generatedMedia: [
                        ...existing,
                        {
                          type: event.media_type || "image",
                          url: event.url,
                          alt: event.alt,
                        },
                      ],
                    };
                  }),
                );
              } else if (event.type === "conversation") {
                // Track conversation ID from stream
                if (event.conversation_id) {
                  setConversationId(event.conversation_id);
                  if (event.title) setConversationTitle(event.title);
                }
              } else if (event.type === "done") {
                // Check for conversation_id in done event
                if (event.conversation_id) {
                  setConversationId(event.conversation_id);
                  if (event.title) setConversationTitle(event.title);
                }
                break;
              } else if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: m.content || `Erreur : ${event.message}`,
                        }
                      : m,
                  ),
                );
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content || "Erreur de connexion au service IA.",
                  }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [value, isStreaming, attachments, conversationId, mediaGenMode, tryNavigate],
  );

  const handleSuggestion = (suggestion: string) => {
    setFocused(false);
    handleSend(suggestion);
  };

  // ── New conversation ──
  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setConversationTitle("Nouvelle conversation");
    setMessages([]);
    setAttachments([]);
    setExpanded(false);
  }, []);

  // ── Load conversation from history ──
  const loadConversation = useCallback(
    (conv: Conversation) => {
      fetchConversation(conv.id);
    },
    [fetchConversation],
  );

  // ── Open history ──
  const handleOpenHistory = useCallback(() => {
    if (!historyLoaded) {
      fetchConversations();
      setHistoryLoaded(true);
    }
  }, [historyLoaded, fetchConversations]);

  const clearChat = () => {
    setMessages([]);
    setAttachments([]);
    setConversationId(null);
    setConversationTitle("Nouvelle conversation");
    setExpanded(false);
  };

  // Combined input value with interim text
  const displayValue =
    value +
    (interimText
      ? (value && !value.endsWith(" ") ? " " : "") + interimText
      : "");

  // ── Media generation mode icon ──
  const MediaIcon = MEDIA_MODE_LABELS[mediaGenMode].icon;

  const { sidebarCollapsed, rightSidebarOpen } = useUIStore();

  return (
    <div
      className={cn(
        "fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-200",
        sidebarCollapsed ? "md:pl-16" : "md:pl-64",
        rightSidebarOpen ? "md:pr-[24rem]" : "md:pr-16",
      )}
    >
      <div className="w-full max-w-2xl px-4 pointer-events-auto flex flex-col">
        {/* Suggestions (only when collapsed and focused) */}
        {focused && !expanded && (
          <div className="mb-3 rounded-lg border border-border bg-card p-3 shadow-xl">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Essayez...
            </p>
            <ul className="space-y-1.5">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSuggestion(s);
                    }}
                    className="w-full text-left text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    &ldquo;{s}&rdquo;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expanded chat panel */}
        {expanded && (
          <div className="mb-3 flex flex-col rounded-xl border border-border bg-card shadow-xl overflow-hidden">
            {/* Chat header with conversation selector */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 shrink-0 text-ai-purple" />
                <span
                  className="text-xs font-semibold truncate"
                  title={conversationTitle}
                >
                  {conversationTitle}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {messages.filter((m) => m.role === "user").length} msg
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* New conversation */}
                <button
                  onClick={startNewConversation}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Nouvelle conversation"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                {/* Conversation history dropdown */}
                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open) handleOpenHistory();
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Historique des conversations"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 max-h-72 overflow-y-auto"
                  >
                    <DropdownMenuLabel className="text-xs">
                      Conversations récentes
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {conversations.length === 0 ? (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        Aucune conversation
                      </div>
                    ) : (
                      conversations.slice(0, 20).map((conv) => (
                        <DropdownMenuItem
                          key={conv.id}
                          className="flex items-center justify-between gap-2 text-xs cursor-pointer"
                          onSelect={() => loadConversation(conv)}
                        >
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="truncate font-medium">
                              {conv.title || "Sans titre"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {conv.message_count} msg &middot;{" "}
                              {formatRelativeDate(conv.updated_at)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Open full AI page */}
                <button
                  onClick={() => router.push("/ai")}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Ouvrir dans l'assistant complet"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                {/* Collapse */}
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Réduire"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {/* Clear */}
                <button
                  onClick={clearChat}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  title="Effacer la conversation"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-4">
              {messages.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Posez une question à l&apos;IA SignApps
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 mt-0.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ai-purple/10">
                        <Bot className="h-3.5 w-3.5 text-ai-purple" />
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-white"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {/* Tool Calls */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="space-y-1 mb-1.5">
                        {msg.toolCalls.map((tc, i) => (
                          <ToolCallDisplay
                            key={`${tc.tool}-${i}`}
                            toolCall={tc}
                            compact
                          />
                        ))}
                      </div>
                    )}
                    {msg.content || (
                      <div className="flex items-center gap-2">
                        <SpinnerInfinity
                          size={24}
                          secondaryColor="rgba(128,128,128,0.2)"
                          color="currentColor"
                          speed={120}
                          className="h-3 w-3 "
                        />
                        <span className="text-xs text-muted-foreground">
                          Réflexion...
                        </span>
                      </div>
                    )}

                    {/* Generated media */}
                    {msg.generatedMedia && msg.generatedMedia.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.generatedMedia.map((media, i) => (
                          <div
                            key={`media-${i}`}
                            className="rounded-lg overflow-hidden border border-border/50"
                          >
                            {media.type === "image" && (
                              <img
                                src={media.url}
                                alt={media.alt || "Image générée"}
                                loading="lazy"
                                className="max-w-full max-h-48 object-contain"
                              />
                            )}
                            {media.type === "audio" && (
                              <audio
                                controls
                                className="w-full"
                                src={media.url}
                              >
                                <track kind="captions" />
                              </audio>
                            )}
                            {media.type === "video" && (
                              <video
                                controls
                                className="max-w-full max-h-48"
                                src={media.url}
                              >
                                <track kind="captions" />
                              </video>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.sources.slice(0, 3).map((src) => (
                          <span
                            key={src.document_id}
                            className="inline-flex items-center gap-1 rounded bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            title={src.excerpt}
                          >
                            <FileText className="h-2.5 w-2.5" />
                            {src.filename}
                            <span className="font-bold text-primary">
                              {Math.round(src.score * 100)}%
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group relative flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs shadow-sm"
              >
                {att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.file.name}
                    loading="lazy"
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                    {att.type === "audio" && (
                      <AudioLines className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {att.type === "video" && (
                      <Video className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {att.type === "document" && (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {att.type === "image" && (
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                )}
                <span className="max-w-24 truncate text-muted-foreground">
                  {att.file.name}
                </span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="glass-panel flex items-center rounded-full p-2 shadow-2xl ai-glow">
          {/* Bot icon */}
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30",
              isStreaming ? "bg-ai-purple animate-pulse" : "bg-primary",
            )}
          >
            <Bot className="h-5 w-5" />
          </div>

          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-background/10 hover:text-white"
            title="Joindre un fichier"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher, naviguer (/docs, /mail...) ou poser une question IA..."
            value={displayValue}
            onChange={(e) => {
              setValue(e.target.value);
              setInterimText("");
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(displayValue);
              }
            }}
            className="flex-1 border-none bg-transparent px-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />

          {/* Actions */}
          <div className="flex items-center gap-1 pr-2">
            {/* Media generation mode dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full px-2 text-xs transition-colors",
                    mediaGenMode !== "auto"
                      ? "bg-ai-purple/20 text-ai-purple"
                      : "text-slate-400 hover:bg-background/10 hover:text-white",
                  )}
                  title={`Génération média : ${MEDIA_MODE_LABELS[mediaGenMode].label}`}
                >
                  <MediaIcon className="h-3.5 w-3.5" />
                  {mediaGenMode !== "auto" && (
                    <span className="hidden sm:inline">
                      {MEDIA_MODE_LABELS[mediaGenMode].label}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-xs">
                  Génération média
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={mediaGenMode}
                  onValueChange={(v) => setMediaGenMode(v as MediaGenMode)}
                >
                  {(Object.keys(MEDIA_MODE_LABELS) as MediaGenMode[]).map(
                    (mode) => {
                      const { label, icon: Icon } = MEDIA_MODE_LABELS[mode];
                      return (
                        <DropdownMenuRadioItem
                          key={mode}
                          value={mode}
                          className="text-xs cursor-pointer"
                        >
                          <Icon className="mr-2 h-3.5 w-3.5" />
                          {label}
                        </DropdownMenuRadioItem>
                      );
                    },
                  )}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Expand/collapse toggle */}
            {messages.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-background/10 hover:text-white"
                title={expanded ? "Réduire" : "Voir la conversation"}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Stop streaming */}
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30"
                title="Arrêter"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <VoiceInput onTranscription={handleTranscription} />
                <button
                  onClick={() => handleSend(displayValue)}
                  disabled={
                    !(
                      value.trim() ||
                      interimText.trim() ||
                      attachments.length > 0
                    )
                  }
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    value.trim() || attachments.length > 0
                      ? "bg-background/20 text-white hover:bg-background/30"
                      : "text-slate-500",
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
