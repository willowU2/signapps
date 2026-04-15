"use client";

/**
 * Feature 3: AI → summarize any doc on demand
 * Feature 13: AI → extract keywords from doc for SEO
 * Feature 17: AI → proofread doc content
 * Feature 27: AI → suggest related docs (similarity)
 */

import { useState } from "react";
import {
  Sparkles,
  Hash,
  CheckCheck,
  BookOpen,
  Loader2,
  Copy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useSummarizeDoc,
  useExtractKeywords,
  useProofreadDoc,
  useSuggestRelatedDocs,
} from "@/hooks/use-cross-module";

interface AiDocActionsProps {
  docTitle: string;
  getText: () => string;
}

export function AiDocActions({ docTitle, getText }: AiDocActionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [proofread, setProofread] = useState("");
  const [related, setRelated] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("summary");

  const summarize = useSummarizeDoc();
  const extractKw = useExtractKeywords();
  const proofreadFn = useProofreadDoc();
  const suggest = useSuggestRelatedDocs();

  const run = async (tab: string) => {
    const text = getText();
    if (!text.trim()) {
      toast.error("Document vide");
      return;
    }
    setLoading(true);
    setActiveTab(tab);
    try {
      if (tab === "summary") setSummary(await summarize(text));
      if (tab === "keywords") setKeywords(await extractKw(text));
      if (tab === "proofread") setProofread(await proofreadFn(text));
      if (tab === "related") setRelated(await suggest(docTitle, text));
    } catch {
      toast.error("Erreur IA");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        IA
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-background shadow-sm p-3 space-y-3 min-w-[320px]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Actions IA
        </span>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded hover:bg-accent"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 h-8">
          <TabsTrigger value="summary" className="text-xs">
            Résumé
          </TabsTrigger>
          <TabsTrigger value="keywords" className="text-xs">
            SEO
          </TabsTrigger>
          <TabsTrigger value="proofread" className="text-xs">
            Correct.
          </TabsTrigger>
          <TabsTrigger value="related" className="text-xs">
            Liés
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-2 space-y-2">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => run("summary")}
            disabled={loading}
          >
            {loading && activeTab === "summary" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Résumer
          </Button>
          {summary && (
            <div className="text-xs rounded border bg-primary/5 p-2 whitespace-pre-wrap relative">
              {summary}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(summary);
                  toast.success("Copié");
                }}
                className="absolute top-1 right-1 p-1 rounded hover:bg-accent"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="keywords" className="mt-2 space-y-2">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => run("keywords")}
            disabled={loading}
          >
            {loading && activeTab === "keywords" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Hash className="h-3.5 w-3.5" />
            )}
            Extraire les mots-clés
          </Button>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {keywords.map((k) => (
                <Badge key={k} variant="secondary" className="text-xs">
                  {k}
                </Badge>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="proofread" className="mt-2 space-y-2">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => run("proofread")}
            disabled={loading}
          >
            {loading && activeTab === "proofread" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Corriger
          </Button>
          {proofread && (
            <div className="text-xs rounded border bg-primary/5 p-2 whitespace-pre-wrap relative">
              {proofread}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(proofread);
                  toast.success("Copié");
                }}
                className="absolute top-1 right-1 p-1 rounded hover:bg-accent"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="related" className="mt-2 space-y-2">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => run("related")}
            disabled={loading}
          >
            {loading && activeTab === "related" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookOpen className="h-3.5 w-3.5" />
            )}
            Suggestions
          </Button>
          {related.length > 0 && (
            <ul className="space-y-1">
              {related.map((r, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground flex items-center gap-1.5"
                >
                  <BookOpen className="h-3 w-3 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
