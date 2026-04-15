"use client";

import { useState, useRef } from "react";
import { X, Upload, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as fabric from "fabric";

interface PptxImportDialogProps {
  onImport: (slides: ImportedSlide[]) => void;
  onClose: () => void;
}

export interface ImportedSlide {
  title: string;
  objects: Array<{
    type: "text" | "rect" | "image";
    left: number;
    top: number;
    width: number;
    height: number;
    text?: string;
    fill?: string;
    fontSize?: number;
    fontWeight?: string;
    src?: string;
  }>;
}

export function PptxImportDialog({ onImport, onClose }: PptxImportDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".pptx")) {
      toast.error("Seuls les fichiers .pptx sont supportés");
      return;
    }
    setFileName(file.name);
    setIsProcessing(true);

    try {
      // Parse PPTX using JSZip (browser-native approach)
      // PPTX is a ZIP file containing XML slides
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);

      const slides: ImportedSlide[] = [];

      // Find slide files: ppt/slides/slide1.xml, slide2.xml ...
      const slideKeys = Object.keys(zip.files)
        .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
        .sort((a, b) => {
          const na = parseInt(a.match(/(\d+)/)?.[1] ?? "0");
          const nb = parseInt(b.match(/(\d+)/)?.[1] ?? "0");
          return na - nb;
        });

      for (const key of slideKeys) {
        const xmlStr = await zip.files[key].async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlStr, "application/xml");

        const slide: ImportedSlide = {
          title: `Slide ${slides.length + 1}`,
          objects: [],
        };

        // Extract text shapes (a:sp elements)
        const shapes = xmlDoc.querySelectorAll("sp");
        shapes.forEach((sp) => {
          // Get position and size from xfrm
          const xfrm = sp.querySelector("xfrm");
          const off = xfrm?.querySelector("off");
          const ext = xfrm?.querySelector("ext");

          const EMU = 9144; // 1px ≈ 9144 EMU at 96dpi
          const left = parseInt(off?.getAttribute("x") ?? "0") / EMU;
          const top = parseInt(off?.getAttribute("y") ?? "0") / EMU;
          const width = parseInt(ext?.getAttribute("cx") ?? "100000") / EMU;
          const height = parseInt(ext?.getAttribute("cy") ?? "50000") / EMU;

          // Get text runs
          const paras = sp.querySelectorAll("p");
          const texts: string[] = [];
          paras.forEach((p) => {
            const runs = p.querySelectorAll("r");
            const line = Array.from(runs)
              .map((r) => r.querySelector("t")?.textContent ?? "")
              .join("");
            if (line) texts.push(line);
          });

          if (texts.length > 0) {
            const text = texts.join("\n");
            // Check if title placeholder
            const phType = sp.querySelector("ph")?.getAttribute("type");
            if (phType === "title" || phType === "ctrTitle") {
              slide.title = texts[0];
            }

            // Get font size
            const sz = sp.querySelector("sz");
            const fontSize = sz ? parseInt(sz.textContent ?? "18") / 100 : 18;

            // Get fill color
            const solidFill = sp.querySelector("solidFill srgbClr");
            const fill = solidFill
              ? `#${solidFill.getAttribute("val") ?? "000000"}`
              : "#000000";

            slide.objects.push({
              type: "text",
              left,
              top,
              width,
              height,
              text,
              fontSize,
              fill,
            });
          }
        });

        // Extract rect shapes (background rects)
        const rects = xmlDoc.querySelectorAll("sp:not(:has(txBody r))");
        rects.forEach((sp) => {
          const xfrm = sp.querySelector("xfrm");
          const off = xfrm?.querySelector("off");
          const ext = xfrm?.querySelector("ext");
          const EMU = 9144;
          const left = parseInt(off?.getAttribute("x") ?? "0") / EMU;
          const top = parseInt(off?.getAttribute("y") ?? "0") / EMU;
          const width = parseInt(ext?.getAttribute("cx") ?? "100000") / EMU;
          const height = parseInt(ext?.getAttribute("cy") ?? "50000") / EMU;
          const solidFill = sp.querySelector("solidFill srgbClr");
          const fill = solidFill
            ? `#${solidFill.getAttribute("val") ?? "cccccc"}`
            : "#cccccc";

          if (width > 10 && height > 10) {
            slide.objects.push({
              type: "rect",
              left,
              top,
              width,
              height,
              fill,
            });
          }
        });

        slides.push(slide);
      }

      if (slides.length === 0) {
        toast.error("Aucune diapositive trouvée dans le fichier");
        return;
      }

      onImport(slides);
      toast.success(
        `${slides.length} diapositive(s) importée(s) depuis ${file.name}`,
      );
      onClose();
    } catch (err) {
      console.error("PPTX import error", err);
      toast.error(
        "Erreur lors de l'import. Vérifiez que le fichier n'est pas corrompu.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="bg-background dark:bg-[#2d2e30] rounded-xl shadow-2xl p-5 w-[440px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-sm">
            Importer un fichier PPTX
          </span>
          <button onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
            isDragging
              ? "border-[#1a73e8] bg-[#1a73e8]/5"
              : "border-border dark:border-gray-600 hover:border-[#4a86e8] hover:bg-muted/50"
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-8 h-8 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
              <span className="text-[13px] text-muted-foreground">
                Traitement en cours...
              </span>
            </>
          ) : fileName ? (
            <>
              <FileText className="w-8 h-8 text-[#1a73e8]" />
              <span className="text-[13px] font-medium">{fileName}</span>
              <span className="text-[11px] text-muted-foreground">
                Traitement terminé
              </span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-[13px] font-medium">
                Glissez un fichier .pptx ici
              </span>
              <span className="text-[11px] text-muted-foreground">
                ou cliquez pour parcourir
              </span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pptx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>
            L'import est partiel : textes et formes simples. Les images,
            graphiques et animations complexes sont ignorés. Nécessite la
            bibliothèque JSZip.
          </span>
        </div>
      </div>
    </div>
  );
}
