"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, ChevronDown, Copy, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Action =
  | "summarize"
  | "expand"
  | "formal"
  | "casual"
  | "translate_fr"
  | "translate_en"
  | "fix_grammar";

const ACTION_LABELS: Record<Action, string> = {
  summarize: "Summarize",
  expand: "Expand",
  formal: "Make formal",
  casual: "Make casual",
  translate_fr: "Translate to French",
  translate_en: "Translate to English",
  fix_grammar: "Fix grammar",
};

const ACTION_PROMPTS: Record<Action, string> = {
  summarize: "Summarize the following text concisely:",
  expand: "Expand the following text with more detail while keeping the same tone:",
  formal: "Rewrite the following text in a professional, formal tone:",
  casual: "Rewrite the following text in a friendly, casual tone:",
  translate_fr: "Translate the following text to French:",
  translate_en: "Translate the following text to English:",
  fix_grammar: "Fix grammar and spelling in the following text, keeping the same style:",
};

interface InlineWritingAssistantProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export function InlineWritingAssistant({
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
  disabled,
}: InlineWritingAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const originalRef = useRef(value);

  const runAction = async (action: Action) => {
    const text = value.trim();
    if (!text) {
      toast.error("Write some text first.");
      return;
    }
    originalRef.current = value;
    setLoading(true);
    setSuggestion(null);
    try {
      const resp = await fetch("/api/ai/inline-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text, prompt: ACTION_PROMPTS[action] }),
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setSuggestion(data.result ?? data.text ?? "");
      setOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`AI assistant error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion !== null) {
      onChange(suggestion);
      setSuggestion(null);
      setOpen(false);
    }
  };

  const revert = () => {
    onChange(originalRef.current);
    setSuggestion(null);
    setOpen(false);
  };

  const copySuggestion = () => {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`relative space-y-1 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <span className="sr-only">Writing area</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || loading}
              className="ml-auto flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              {loading ? "Thinking…" : "AI"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(ACTION_LABELS) as Action[]).map((action) => (
              <DropdownMenuItem key={action} onSelect={() => runAction(action)}>
                {ACTION_LABELS[action]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled || loading}
        className="resize-none"
      />

      {/* Suggestion popover */}
      {suggestion !== null && open && (
        <div className="rounded-lg border bg-card p-3 shadow-md space-y-2">
          <p className="text-xs font-medium text-muted-foreground">AI Suggestion</p>
          <p className="text-sm whitespace-pre-wrap">{suggestion}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={applySuggestion}>
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={copySuggestion}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={revert}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Revert
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSuggestion(null); setOpen(false); }}
              className="ml-auto"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
