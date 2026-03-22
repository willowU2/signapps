"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

interface AutoCategorizeProps {
  fileName: string;
  fileId: string;
  onCategorize?: (category: string, fileId: string) => Promise<void>;
  onDismiss?: () => void;
}

const CATEGORIES = ["Document", "Image", "Spreadsheet", "Presentation", "Code", "Other"];
const COLORS: Record<string, string> = {
  Document: "bg-blue-500",
  Image: "bg-purple-500",
  Spreadsheet: "bg-green-500",
  Presentation: "bg-orange-500",
  Code: "bg-slate-500",
  Other: "bg-gray-500",
};

export function AutoCategorize({
  fileName,
  fileId,
  onCategorize,
  onDismiss,
}: AutoCategorizeProps) {
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const suggestions = suggestCategories(fileName);

  const handleAccept = async (category: string) => {
    setLoading(true);
    try {
      await onCategorize?.(category, fileId);
      setAccepted(true);
      toast.success(`Categorized as "${category}"`);
    } catch (error) {
      toast.error("Failed to categorize file");
    } finally {
      setLoading(false);
    }
  };

  if (accepted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
        <Check className="h-4 w-4 text-green-600" />
        <span className="text-xs font-medium text-green-900">Categorization saved</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">
        File: <span className="text-foreground font-semibold">{fileName}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((cat) => (
          <Button
            key={cat}
            size="sm"
            disabled={loading}
            onClick={() => handleAccept(cat)}
            className={`${COLORS[cat]} text-white border-transparent hover:opacity-90`}
          >
            {cat}
            <span className="ml-1.5 text-xs font-semibold">95%</span>
          </Button>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={loading}
          className="text-xs"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

function suggestCategories(fileName: string): string[] {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const rules: Record<string, string[]> = {
    Document: ["pdf", "doc", "docx", "txt", "rtf", "odt"],
    Image: ["jpg", "jpeg", "png", "gif", "svg", "webp"],
    Spreadsheet: ["xls", "xlsx", "csv", "ods"],
    Presentation: ["ppt", "pptx", "odp"],
    Code: ["js", "ts", "py", "java", "cpp", "rs", "go"],
  };

  for (const [category, exts] of Object.entries(rules)) {
    if (exts.includes(ext)) return [category];
  }
  return ["Other"];
}
