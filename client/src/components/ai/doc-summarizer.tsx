"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { aiApi } from "@/lib/api/ai";
import { toast } from "sonner";

export function DocSummarizer() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error("File size must be less than 50MB");
        return;
      }
      setFile(selectedFile);
      setSummary("");
      toast.info(`Selected: ${selectedFile.name}`);
    }
  };

  const handleGenerateSummary = async () => {
    if (!file) {
      toast.error("Please upload a document");
      return;
    }

    setIsLoading(true);
    setSummary("");

    try {
      const content = await file.text();
      const truncated = content.slice(0, 8000);

      const res = await aiApi.chat(
        `Summarize the following document concisely with key bullet points:\n\n${truncated}`,
        {
          systemPrompt:
            "You are a professional document summarizer. Provide a clear, structured summary with key points as bullet points (use • for each). Be concise and informative.",
          language: "en",
        },
      );

      const answer = res.data?.answer || "";
      if (!answer) {
        toast.error("No summary generated");
        return;
      }
      setSummary(answer);
      toast.success("Résumé généré");
    } catch {
      toast.error("Impossible de générer le résumé");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setIsCopied(true);
    toast.success("Copié dans le presse-papier");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Summarizer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-3 block">
              Upload Document
            </label>
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-primary/50 transition cursor-pointer">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.pdf,.doc,.docx,.md"
                className="hidden"
                id="doc-upload"
              />
              <label htmlFor="doc-upload" className="cursor-pointer">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {file ? file.name : "Click to upload or drag file"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 50MB (TXT, PDF, DOC, MD)
                </p>
              </label>
            </div>
          </div>

          <Button
            onClick={handleGenerateSummary}
            disabled={isLoading || !file}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating summary...
              </>
            ) : (
              "Generate Summary"
            )}
          </Button>

          {summary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  AI Summary
                </span>
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="ghost"
                  className="gap-2 h-7"
                >
                  {isCopied ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg border bg-primary/5 p-4 text-sm whitespace-pre-wrap text-foreground">
                {summary}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
