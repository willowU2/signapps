"use client";

import { useState } from "react";

interface PdfViewerProps {
  url: string;
  title?: string;
}

export function PdfViewer({ url, title }: PdfViewerProps) {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{title || "Document PDF"}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(z - 25, 25))} className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent">-</button>
          <span className="text-xs font-mono w-10 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(z + 25, 200))} className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent">+</button>
          <a href={url} download className="px-2 py-0.5 text-xs rounded bg-muted hover:bg-accent">Telecharger</a>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/10">
        <iframe
          src={url}
          className="w-full h-full border-none"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left", width: `${10000 / zoom}%`, height: `${10000 / zoom}%` }}
          title={title || "PDF"}
        />
      </div>
    </div>
  );
}
