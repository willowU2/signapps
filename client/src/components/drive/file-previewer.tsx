"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);
const VIDEO_EXTS = new Set(["mp4", "webm"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg"]);
const TEXT_EXTS = new Set([
  "txt",
  "md",
  "json",
  "js",
  "ts",
  "py",
  "rs",
  "css",
  "html",
  "xml",
  "yaml",
  "yml",
  "toml",
]);
const DOCX_EXTS = new Set(["docx", "doc", "odt"]);
const PDF_EXTS = new Set(["pdf"]);

type PreviewKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "docx"
  | "unsupported";

function resolveKind(filename: string, mimeType?: string | null): PreviewKind {
  const ext = getExtension(filename);

  if (PDF_EXTS.has(ext) || mimeType === "application/pdf") return "pdf";
  if (IMAGE_EXTS.has(ext) || mimeType?.startsWith("image/")) return "image";
  if (VIDEO_EXTS.has(ext) || mimeType?.startsWith("video/")) return "video";
  if (AUDIO_EXTS.has(ext) || mimeType?.startsWith("audio/")) return "audio";
  if (TEXT_EXTS.has(ext) || mimeType?.startsWith("text/")) return "text";
  if (DOCX_EXTS.has(ext) || mimeType?.includes("wordprocessing")) return "docx";

  return "unsupported";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FilePreviewerProps {
  url: string;
  filename: string;
  mimeType?: string | null;
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function PdfPreview({ url, filename }: { url: string; filename: string }) {
  const [zoom, setZoom] = useState(100);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{filename}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(z - 25, 25))}
            className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent"
          >
            -
          </button>
          <span className="text-xs font-mono w-10 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(z + 25, 200))}
            className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent"
          >
            +
          </button>
          <a
            href={url}
            download
            className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent"
          >
            Telecharger
          </a>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/10">
        <iframe
          src={url}
          className="w-full h-full border-none"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
            width: `${10000 / zoom}%`,
            height: `${10000 / zoom}%`,
          }}
          title={filename}
        />
      </div>
    </div>
  );
}

function ImagePreview({ url, filename }: { url: string; filename: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{filename}</span>
        <a
          href={url}
          download
          className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent"
        >
          Telecharger
        </a>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/10 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename}
          className="max-w-full max-h-full object-contain rounded"
        />
      </div>
    </div>
  );
}

function VideoPreview({ url, filename }: { url: string; filename: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{filename}</span>
        <a
          href={url}
          download
          className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent"
        >
          Telecharger
        </a>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center bg-black p-4">
        <video src={url} controls className="max-w-full max-h-full rounded">
          Votre navigateur ne supporte pas la lecture video.
        </video>
      </div>
    </div>
  );
}

function AudioPreview({ url, filename }: { url: string; filename: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{filename}</span>
        <a
          href={url}
          download
          className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent"
        >
          Telecharger
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center bg-muted/10 p-8">
        <div className="w-full max-w-lg space-y-4 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            {filename}
          </p>
          <audio src={url} controls className="w-full">
            Votre navigateur ne supporte pas la lecture audio.
          </audio>
        </div>
      </div>
    </div>
  );
}

function TextPreview({ url, filename }: { url: string; filename: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setContent(null);
    setError(false);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [url]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{filename}</span>
        <a
          href={url}
          download
          className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent"
        >
          Telecharger
        </a>
      </div>
      <div className="flex-1 overflow-auto bg-muted/5 p-4">
        {error && (
          <p className="text-sm text-destructive">
            Impossible de charger le fichier.
          </p>
        )}
        {!error && content === null && (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        )}
        {content !== null && (
          <pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

function DocxPreview({ url, filename }: { url: string; filename: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{filename}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-muted/10 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Apercu via Office — Telecharger pour voir
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={url} download>
            <Download className="h-4 w-4 mr-2" />
            Telecharger {filename}
          </a>
        </Button>
      </div>
    </div>
  );
}

function UnsupportedPreview({
  url,
  filename,
}: {
  url: string;
  filename: string;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{filename}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-muted/10 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Apercu non disponible pour ce type de fichier.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={url} download>
            <Download className="h-4 w-4 mr-2" />
            Telecharger {filename}
          </a>
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilePreviewer({ url, filename, mimeType }: FilePreviewerProps) {
  const kind = resolveKind(filename, mimeType);

  const inner = (() => {
    switch (kind) {
      case "pdf":
        return <PdfPreview url={url} filename={filename} />;
      case "image":
        return <ImagePreview url={url} filename={filename} />;
      case "video":
        return <VideoPreview url={url} filename={filename} />;
      case "audio":
        return <AudioPreview url={url} filename={filename} />;
      case "text":
        return <TextPreview url={url} filename={filename} />;
      case "docx":
        return <DocxPreview url={url} filename={filename} />;
      default:
        return <UnsupportedPreview url={url} filename={filename} />;
    }
  })();

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      {inner}
    </div>
  );
}
