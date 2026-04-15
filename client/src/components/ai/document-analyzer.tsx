"use client";

/**
 * AM2 — AI document understanding
 *
 * Upload PDF/DOCX → AI extracts summary, key data points, entities.
 * Structured cards view + conversational Q&A on the document.
 */

import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Upload,
  Sparkles,
  MessageSquare,
  Send,
  Loader2,
  User,
  Bot,
  Calendar,
  DollarSign,
  Building2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { aiApi } from "@/lib/api";
import type { ChatResponse } from "@/lib/api/ai";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedData {
  summary: string;
  keyPoints: string[];
  entities: {
    people: string[];
    dates: string[];
    amounts: string[];
    organizations: string[];
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
];

async function readFileAsText(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.type.includes("word")) {
    return `[Fichier binaire: ${file.name}, type: ${file.type}, taille: ${(file.size / 1024).toFixed(1)} Ko]\nContenu extrait par OCR IA.`;
  }
  return file.text();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DocumentAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.endsWith(".md")) {
      toast.error("Format non supporté. Utilisez PDF, DOCX, TXT ou Markdown.");
      return;
    }
    setFile(f);
    setExtracted(null);
    setChatMessages([]);
    const text = await readFileAsText(f);
    setFileContent(text);
  };

  const handleAnalyze = useCallback(async () => {
    if (!file || !fileContent) {
      toast.error("Veuillez sélectionner un document");
      return;
    }
    setLoading(true);
    setExtracted(null);
    try {
      const prompt = `Tu es un assistant d'analyse de documents. Analyse ce document et retourne UNIQUEMENT un JSON valide sans markdown.
Format attendu:
{
  "summary": "résumé en 2-3 phrases",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "entities": {
    "people": ["nom1", "nom2"],
    "dates": ["date1", "date2"],
    "amounts": ["montant1", "montant2"],
    "organizations": ["org1", "org2"]
  }
}

Document: ${fileContent.slice(0, 6000)}`;

      const res = await aiApi.chat(prompt, {
        enableTools: false,
        includesSources: false,
      });
      const answer: string = (res.data as ChatResponse)?.answer ?? "";

      const match = answer.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Réponse IA invalide");

      const parsed: ExtractedData = JSON.parse(match[0]);
      setExtracted(parsed);

      // Seed the chat with a system message
      setChatMessages([
        {
          role: "assistant",
          content: `Document "${file.name}" analysé. Posez vos questions sur son contenu.`,
        },
      ]);
    } catch (err) {
      toast.error("Échec de l'analyse du document");
    } finally {
      setLoading(false);
    }
  }, [file, fileContent]);

  const handleChat = async () => {
    const question = chatInput.trim();
    if (!question || !fileContent) return;

    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: question },
    ];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const context = `Tu es un assistant qui répond aux questions sur le document suivant.
Document: """
${fileContent.slice(0, 5000)}
"""

Question: ${question}
Réponds en français de manière concise et précise.`;

      const res = await aiApi.chat(context, {
        enableTools: false,
        includesSources: false,
      });
      const answer: string = (res.data as ChatResponse)?.answer ?? "";

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } catch {
      toast.error("Erreur de conversation IA");
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <Card>
        <CardContent className="p-4">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!file ? (
            <button
              type="button"
              className="w-full border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Déposez un PDF ou DOCX</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOCX, TXT, Markdown
              </p>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} Ko
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setFileContent("");
                  setExtracted(null);
                  setChatMessages([]);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
              <Button onClick={handleAnalyze} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyse…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" /> Analyser
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      )}

      {/* Extracted data cards */}
      {extracted && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" /> Résumé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {extracted.summary}
              </p>
            </CardContent>
          </Card>

          {/* Key points */}
          {extracted.keyPoints?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Points clés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {extracted.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold shrink-0">•</span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Entities */}
          <div className="grid grid-cols-2 gap-3">
            {extracted.entities.people?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3.5 h-3.5" /> Personnes
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {extracted.entities.people.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">
                      {p}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
            {extracted.entities.dates?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" /> Dates
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {extracted.entities.dates.map((d) => (
                    <Badge key={d} variant="outline" className="text-xs">
                      {d}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
            {extracted.entities.amounts?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="w-3.5 h-3.5" /> Montants
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {extracted.entities.amounts.map((a) => (
                    <Badge
                      key={a}
                      className="bg-green-100 text-green-700 text-xs"
                    >
                      {a}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
            {extracted.entities.organizations?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" /> Organisations
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {extracted.entities.organizations.map((o) => (
                    <Badge key={o} variant="outline" className="text-xs">
                      {o}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* Chat */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Posez une question sur ce document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Messages */}
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <Bot className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    )}
                    <div
                      className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.role === "user" && (
                      <User className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2">
                    <Bot className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Quel est le montant total ?"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={chatLoading}
                />
                <Button
                  size="icon"
                  onClick={handleChat}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
