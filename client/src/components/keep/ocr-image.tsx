/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScanText, Upload, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OcrImageProps {
  onTextExtracted: (text: string) => void;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OcrImage({ onTextExtracted }: OcrImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target?.result as string);
      setExtractedText("");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.items)
      .find((i) => i.type.startsWith("image/"))
      ?.getAsFile();
    if (file) handleFile(file);
  };

  // Simulated OCR — in production this would call an AI/OCR API
  const handleExtract = async () => {
    if (!imageUrl) return;
    setIsProcessing(true);

    try {
      // Try to use AI vision API if available
      const { getClient, ServiceName } = await import("@/lib/api/factory");
      const aiClient = getClient(ServiceName.AI);
      const response = await aiClient.post("/ai/vision/ocr", {
        image: imageUrl,
        prompt:
          "Extract all text from this image. Return only the extracted text, nothing else.",
      });
      const text = (response.data as { text?: string }).text ?? "";
      setExtractedText(text);
      if (text.trim()) {
        toast.success("Texte extrait avec succès.");
      } else {
        setExtractedText("Aucun texte détecté dans l'image.");
      }
    } catch {
      // Fallback: simulate OCR for demo
      await new Promise((r) => setTimeout(r, 1500));
      const simulated =
        "Texte extrait (simulation)\n\nOCR complet nécessite le service IA SignApps.\n\nActivez le service AI pour l'OCR réel.";
      setExtractedText(simulated);
      toast.info("Mode simulation — activez le service IA pour l'OCR réel.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(extractedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Texte copié.");
    });
  };

  const handleInsert = () => {
    if (!extractedText.trim()) return;
    onTextExtracted(extractedText);
    toast.success("Texte inséré dans la note.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b">
        <ScanText className="size-4 text-primary" />
        <h3 className="font-semibold text-sm">
          OCR — Extraire le texte d'une image
        </h3>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onPaste={handlePaste}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          imageUrl
            ? "border-primary/40 bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Image à analyser"
            className="max-h-40 mx-auto rounded object-contain"
          />
        ) : (
          <div className="space-y-2">
            <Upload className="size-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Glissez une image, collez (Ctrl+V) ou cliquez
            </p>
            <p className="text-xs text-muted-foreground">PNG, JPG, GIF, WebP</p>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {/* Extract button */}
      {imageUrl && (
        <Button
          className="w-full gap-2"
          onClick={handleExtract}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanText className="size-4" />
          )}
          {isProcessing ? "Extraction en cours..." : "Extraire le texte"}
        </Button>
      )}

      {/* Result */}
      {extractedText && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Texte extrait:
          </p>
          <div className="relative border rounded-lg p-3 bg-muted/20 min-h-[80px]">
            <pre className="text-sm whitespace-pre-wrap font-sans">
              {extractedText}
            </pre>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3" />
              )}
              Copier
            </Button>
            <Button size="sm" className="flex-1 gap-1" onClick={handleInsert}>
              Insérer dans la note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
