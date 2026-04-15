"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Eye,
  Loader2,
  Upload,
  MessageSquareText,
  ScanText,
  X,
  ImageIcon,
  Layers,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAiVision } from "@/hooks/use-ai-vision";

// ─── File drop helper ────────────────────────────────────────────────────────

function ImageDropZone({
  label,
  file,
  onFile,
  previewUrl,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
  previewUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) onFile(f);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors overflow-hidden
        ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
        ${previewUrl ? "p-0" : "p-8"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {previewUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Aperçu"
            className="w-full max-h-64 object-contain"
          />
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2 h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : file ? (
        <div className="flex items-center justify-center gap-2 text-sm p-4">
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="truncate max-w-[200px]">{file.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP</p>
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VisionAnalyzer() {
  const { analyzing, result, vqaResult, error, describe, vqa, reset } =
    useAiVision();

  // --- Describe mode ---
  const [describeFile, setDescribeFile] = useState<File | null>(null);
  const [describePreview, setDescribePreview] = useState<string | null>(null);
  const [describePrompt, setDescribePrompt] = useState("");

  // --- VQA mode ---
  const [vqaFile, setVqaFile] = useState<File | null>(null);
  const [vqaPreview, setVqaPreview] = useState<string | null>(null);
  const [vqaQuestion, setVqaQuestion] = useState("");

  // --- Batch mode ---
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchPreviews, setBatchPreviews] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<
    { file: string; description: string; tags?: string[] }[]
  >([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Generate preview URLs for file changes
  const updatePreview = useCallback(
    (file: File | null, setter: (url: string | null) => void) => {
      if (file) {
        const url = URL.createObjectURL(file);
        setter(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setter(null);
      }
    },
    [],
  );

  useEffect(
    () => updatePreview(describeFile, setDescribePreview),
    [describeFile, updatePreview],
  );
  useEffect(
    () => updatePreview(vqaFile, setVqaPreview),
    [vqaFile, updatePreview],
  );

  // --- Handlers ---

  const handleDescribe = useCallback(() => {
    if (!describeFile) {
      toast.error("Veuillez fournir une image");
      return;
    }
    describe(describeFile, describePrompt.trim() || undefined);
  }, [describeFile, describePrompt, describe]);

  const handleVqa = useCallback(() => {
    if (!vqaFile) {
      toast.error("Veuillez fournir une image");
      return;
    }
    if (!vqaQuestion.trim()) {
      toast.error("Veuillez poser une question");
      return;
    }
    vqa(vqaFile, vqaQuestion.trim());
  }, [vqaFile, vqaQuestion, vqa]);

  const handleBatchAdd = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      setBatchFiles((prev) => [...prev, ...imageFiles]);
      const previews = imageFiles.map((f) => URL.createObjectURL(f));
      setBatchPreviews((prev) => [...prev, ...previews]);

      // Reset input so same files can be re-selected
      if (batchInputRef.current) batchInputRef.current.value = "";
    },
    [],
  );

  const handleBatchRemove = useCallback((index: number) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
    setBatchPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setBatchResults((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleBatchDescribe = useCallback(async () => {
    if (batchFiles.length === 0) {
      toast.error("Veuillez ajouter au moins une image");
      return;
    }

    setBatchProcessing(true);
    setBatchResults([]);

    const results: { file: string; description: string; tags?: string[] }[] =
      [];

    for (const file of batchFiles) {
      try {
        await describe(file);
        // Read the result from the store after each describe call
        const state = useAiVision.getState();
        if (state.result) {
          results.push({
            file: file.name,
            description: state.result.description,
            tags: state.result.tags,
          });
        }
      } catch {
        results.push({
          file: file.name,
          description: "Erreur lors de l'analyse",
        });
      }
    }

    setBatchResults(results);
    setBatchProcessing(false);
    toast.success(`${results.length} image(s) analysée(s)`);
  }, [batchFiles, describe]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="h-5 w-5 text-amber-500" />
          Analyse d&apos;images
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Décrivez, interrogez et analysez des images avec l&apos;IA.
        </p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="describe" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="describe" className="flex-1">
              <ScanText className="h-4 w-4 mr-1" />
              Décrire
            </TabsTrigger>
            <TabsTrigger value="vqa" className="flex-1">
              <MessageSquareText className="h-4 w-4 mr-1" />
              Q&amp;R visuelle
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex-1">
              <Layers className="h-4 w-4 mr-1" />
              Lot
            </TabsTrigger>
          </TabsList>

          {/* ════════════════ DESCRIBE TAB ════════════════ */}
          <TabsContent value="describe" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Image</Label>
              <ImageDropZone
                label="Glissez ou cliquez pour importer une image"
                file={describeFile}
                onFile={setDescribeFile}
                previewUrl={describePreview}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc-prompt">
                Instructions supplémentaires (optionnel)
              </Label>
              <Textarea
                id="desc-prompt"
                placeholder="Ex: Décrivez les couleurs dominantes, identifiez les personnes..."
                value={describePrompt}
                onChange={(e) => setDescribePrompt(e.target.value)}
                rows={2}
                disabled={analyzing}
              />
            </div>

            <Button
              onClick={handleDescribe}
              disabled={analyzing || !describeFile}
              className="w-full"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <ScanText className="h-4 w-4 mr-2" />
                  Décrire l&apos;image
                </>
              )}
            </Button>

            {/* Description result */}
            {result && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Description</h3>
                    {result.confidence !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        Confiance : {(result.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">
                    {result.description}
                  </p>

                  {result.tags && result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {result.objects && result.objects.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                        Objets détectés
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {result.objects.map((obj, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                          >
                            <span>{obj.label}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {(obj.confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => reset()}>
                      <Eye className="h-4 w-4 mr-1" />
                      Nouvelle analyse
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ════════════════ VQA TAB ════════════════ */}
          <TabsContent value="vqa" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Image</Label>
              <ImageDropZone
                label="Glissez ou cliquez pour importer une image"
                file={vqaFile}
                onFile={setVqaFile}
                previewUrl={vqaPreview}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vqa-question">Question</Label>
              <Input
                id="vqa-question"
                placeholder="Posez une question sur l'image..."
                value={vqaQuestion}
                onChange={(e) => setVqaQuestion(e.target.value)}
                disabled={analyzing}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleVqa();
                  }
                }}
              />
            </div>

            <Button
              onClick={handleVqa}
              disabled={analyzing || !vqaFile || !vqaQuestion.trim()}
              className="w-full"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Réponse en cours...
                </>
              ) : (
                <>
                  <MessageSquareText className="h-4 w-4 mr-2" />
                  Poser la question
                </>
              )}
            </Button>

            {/* VQA result */}
            {vqaResult && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Réponse</h3>
                    {vqaResult.confidence !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        Confiance : {(vqaResult.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm leading-relaxed">
                      {vqaResult.answer}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => reset()}>
                      <MessageSquareText className="h-4 w-4 mr-1" />
                      Nouvelle question
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ════════════════ BATCH TAB ════════════════ */}
          <TabsContent value="batch" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Images (lot)</Label>
              <p className="text-xs text-muted-foreground">
                Importez plusieurs images pour les décrire automatiquement.
              </p>

              <input
                ref={batchInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleBatchAdd}
              />

              {/* Thumbnail grid */}
              {batchPreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {batchPreviews.map((url, i) => (
                    <div
                      key={i}
                      className="relative rounded-lg border overflow-hidden group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={batchFiles[i]?.name ?? ""}
                        className="w-full h-20 object-cover"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleBatchRemove(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => batchInputRef.current?.click()}
                disabled={batchProcessing}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter des images
              </Button>
            </div>

            <Button
              onClick={handleBatchDescribe}
              disabled={batchProcessing || batchFiles.length === 0}
              className="w-full"
            >
              {batchProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement en cours...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4 mr-2" />
                  Analyser {batchFiles.length} image
                  {batchFiles.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>

            {/* Batch results */}
            {batchResults.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Résultats ({batchResults.length} image
                    {batchResults.length !== 1 ? "s" : ""})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {batchResults.map((r, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border bg-muted/30 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium truncate">
                            {r.file}
                          </span>
                        </div>
                        <p className="text-sm">{r.description}</p>
                        {r.tags && r.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {r.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
