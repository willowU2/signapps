"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Layers,
  CheckCircle,
  Loader2,
  Download,
  X,
} from "lucide-react";

interface BatchFile {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  outputUrl?: string;
  outputName?: string;
}

type OutputFormat = "png" | "jpeg" | "webp";

export function BatchMediaProcessor() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [maxWidth, setMaxWidth] = useState("1920");
  const [quality, setQuality] = useState("85");
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const items: BatchFile[] = Array.from(newFiles)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        id: `${f.name}-${Date.now()}`,
        file: f,
        status: "pending",
      }));
    setFiles((prev) => [...prev, ...items]);
  }, []);

  const processFile = (item: BatchFile): Promise<BatchFile> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(item.file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const mw = parseInt(maxWidth) || 1920;
        const scale = img.naturalWidth > mw ? mw / img.naturalWidth : 1;
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ ...item, status: "error" });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const mimeType = `image/${format}`;
        const q = format === "png" ? undefined : parseInt(quality) / 100;
        const outputUrl = canvas.toDataURL(mimeType, q);
        const ext = format;
        const base = item.file.name.replace(/\.[^.]+$/, "");
        resolve({
          ...item,
          status: "done",
          outputUrl,
          outputName: `${base}_${canvas.width}x${canvas.height}.${ext}`,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ ...item, status: "error" });
      };
      img.src = url;
    });
  };

  const runBatch = async () => {
    setProcessing(true);
    const pending = files.filter((f) => f.status === "pending");
    for (const item of pending) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "processing" } : f,
        ),
      );
      const result = await processFile(item);
      setFiles((prev) => prev.map((f) => (f.id === item.id ? result : f)));
    }
    setProcessing(false);
  };

  const downloadFile = (item: BatchFile) => {
    if (!item.outputUrl || !item.outputName) return;
    const a = document.createElement("a");
    a.href = item.outputUrl;
    a.download = item.outputName;
    a.click();
  };

  const remove = (id: string) => setFiles((f) => f.filter((x) => x.id !== id));

  const doneCount = files.filter((f) => f.status === "done").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const progress = files.length > 0 ? (doneCount / files.length) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-500" />
          Batch Media Processor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Options */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Max Width (px)</Label>
            <Input
              type="number"
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quality (%)</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="h-8 text-sm"
              disabled={format === "png"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Output Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as OutputFormat)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-sm text-muted-foreground">
            Drop images here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WebP supported
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {files.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border px-3 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.status === "processing" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
                  )}
                  {item.status === "done" && (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  )}
                  {item.status === "pending" && (
                    <div className="h-3.5 w-3.5 rounded-full bg-muted shrink-0" />
                  )}
                  {item.status === "error" && (
                    <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <span className="text-sm truncate">{item.file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(item.file.size / 1024).toFixed(0)}KB
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {item.status === "done" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => downloadFile(item)}
                      aria-label="Télécharger"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => remove(item.id)}
                    aria-label="Fermer"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && processing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Processing…</span>
              <span>
                {doneCount} / {files.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {files.length > 0 && (
          <div className="flex items-center gap-3">
            <Button
              onClick={runBatch}
              disabled={processing || pendingCount === 0}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4 mr-2" />
                  Process {pendingCount} files
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setFiles([])}>
              Clear
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
