"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { aiApi } from "@/lib/api";

interface SuggestedTag {
  name: string;
  confidence: number;
  accepted?: boolean;
}

interface SmartTaggerProps {
  fileName?: string;
  onTagsAccepted?: (tags: string[]) => void;
}

export function SmartTagger({
  fileName = "document.pdf",
  onTagsAccepted,
}: SmartTaggerProps) {
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateTags = async () => {
    setIsLoading(true);
    try {
      const prompt = `Suggest 5-7 relevant tags for a document named "${fileName}". For each tag, estimate confidence (0-100).
Return JSON format: { tags: [{ name: string, confidence: number }] }`;

      const response = await aiApi.chat(prompt);

      try {
        const jsonMatch = response.data.answer.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { tags: [] };
        setSuggestedTags(
          parsed.tags.map((t: any) => ({
            name: t.name,
            confidence: Math.min(100, Math.max(0, t.confidence || 75)),
            accepted: false,
          })),
        );
        setHasGenerated(true);
        toast.success("Tags générés");
      } catch {
        toast.error("Format des tags invalide");
      }
    } catch (error) {
      toast.error("Impossible de générer les tags");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTag = (index: number) => {
    setSuggestedTags((prev) =>
      prev.map((tag, i) =>
        i === index ? { ...tag, accepted: !tag.accepted } : tag,
      ),
    );
  };

  const acceptAll = () => {
    setSuggestedTags((prev) => prev.map((tag) => ({ ...tag, accepted: true })));
    toast.success("All tags accepted");
  };

  const handleConfirm = () => {
    const accepted = suggestedTags.filter((t) => t.accepted).map((t) => t.name);
    if (accepted.length === 0) {
      toast.error("Please accept at least one tag");
      return;
    }
    onTagsAccepted?.(accepted);
    toast.success(`${accepted.length} tag(s) confirmed`);
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Smart Tagger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-slate-100 rounded-lg">
            <p className="text-sm text-slate-700">
              <span className="font-medium">File:</span> {fileName}
            </p>
          </div>

          {!hasGenerated ? (
            <Button
              onClick={generateTags}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Generate Tags"
              )}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                {suggestedTags.map((tag, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition"
                  >
                    <input
                      type="checkbox"
                      checked={tag.accepted}
                      onChange={() => toggleTag(i)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {tag.name}
                        </span>
                        <span className="text-xs text-slate-600 whitespace-nowrap">
                          {tag.confidence}%
                        </span>
                      </div>
                      <div className="mt-1 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${tag.confidence}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => toggleTag(i)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      {tag.accepted ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-slate-400" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={acceptAll}
                  variant="outline"
                  className="flex-1"
                >
                  Accept All
                </Button>
                <Button onClick={handleConfirm} className="flex-1">
                  Confirm Selection
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
