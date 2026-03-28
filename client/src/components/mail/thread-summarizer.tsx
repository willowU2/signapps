"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ThreadMessage {
  id: string;
  from: string;
  date: string;
  body: string;
}

interface ThreadSummarizerProps {
  threadId: string;
  messages: ThreadMessage[];
}

interface SummaryResult {
  key_points: string[];
  action_items: string[];
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
}

export function ThreadSummarizer({ threadId, messages }: ThreadSummarizerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSummarize = async () => {
    if (messages.length === 0) {
      toast.error("Aucun message à résumer.");
      return;
    }
    setLoading(true);
    setSummary(null);
    setOpen(true);
    try {
      const resp = await fetch("/api/ai/thread-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          messages: messages.map((m) => ({
            from: m.from,
            date: m.date,
            body: m.body.slice(0, 800),
          })),
        }),
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data: SummaryResult = await resp.json();
      setSummary(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Summarization failed: ${msg}`);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!summary) return;
    const text = [
      summary.summary,
      "",
      "Key points:",
      ...summary.key_points.map((p) => `• ${p}`),
      "",
      "Action items:",
      ...summary.action_items.map((a) => `• ${a}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sentimentColor =
    summary?.sentiment === "positive"
      ? "bg-green-500/10 text-green-600"
      : summary?.sentiment === "negative"
      ? "bg-red-500/10 text-red-600"
      : "bg-muted text-muted-foreground";

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSummarize}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs"
      >
        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
        {loading ? "Summarizing…" : `Summarize (${messages.length})`}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-96">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Thread Summary
            </SheetTitle>
          </SheetHeader>

          {loading && (
            <div className="mt-8 flex flex-col items-center gap-3 text-center">
              <Sparkles className="h-8 w-8 animate-pulse text-purple-400" />
              <p className="text-sm text-muted-foreground">
                Analysing {messages.length} messages…
              </p>
            </div>
          )}

          {summary && !loading && (
            <ScrollArea className="mt-4 h-[calc(100vh-120px)]">
              <div className="space-y-5 pr-4">
                <div className="flex items-center justify-between">
                  <Badge className={sentimentColor}>
                    {summary.sentiment}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyAll}
                    className="h-7 px-2"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Summary
                  </p>
                  <p className="text-sm leading-relaxed">{summary.summary}</p>
                </div>

                {summary.key_points.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Key Points
                    </p>
                    <ul className="space-y-1.5">
                      {summary.key_points.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.action_items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Action Items
                    </p>
                    <ul className="space-y-1.5">
                      {summary.action_items.map((ai, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 text-orange-500">→</span>
                          {ai}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
