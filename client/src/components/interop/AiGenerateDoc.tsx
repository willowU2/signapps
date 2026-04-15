"use client";

/**
 * Feature 10: AI → generate doc from prompt
 */

import { useState } from "react";
import { Sparkles, Loader2, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { driveApi } from "@/lib/api/drive";
import { useGenerateDocFromPrompt } from "@/hooks/use-cross-module";
import { useRouter } from "next/navigation";

export function AiGenerateDoc() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [docName, setDocName] = useState("");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const generateDoc = useGenerateDocFromPrompt();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Entrez un sujet");
      return;
    }
    setLoading(true);
    setPreview("");
    try {
      const content = await generateDoc(prompt);
      setPreview(content);
      if (!docName.trim()) {
        const firstLine = content
          .split("\n")[0]
          .replace(/^#+\s*/, "")
          .trim();
        setDocName(firstLine.slice(0, 80) || "Document généré par IA");
      }
    } catch {
      toast.error("Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!preview || !docName.trim()) {
      toast.error("Générez d'abord le document");
      return;
    }
    setCreating(true);
    try {
      const targetId = crypto.randomUUID();
      const newNode = await driveApi.createNode({
        name: docName.trim(),
        node_type: "document",
        parent_id: null,
        target_id: targetId,
      });
      const finalId = newNode.target_id || newNode.id;
      localStorage.setItem(`doc-template:${finalId}`, preview);
      toast.success("Document créé");
      setOpen(false);
      router.push(
        `/docs/editor?id=${finalId}&name=${encodeURIComponent(newNode.name)}`,
      );
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Générer un doc IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Générer un document avec l'IA
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Décrivez le document souhaité</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Rédige un rapport trimestriel sur les ventes avec analyse des tendances..."
                rows={3}
                className="text-sm"
              />
            </div>

            <Button
              className="w-full gap-1.5"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Générer
            </Button>

            {preview && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Titre du document</Label>
                  <Input
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Aperçu
                    </span>
                  </div>
                  <div className="text-xs whitespace-pre-wrap max-h-52 overflow-y-auto text-foreground">
                    {preview}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!preview || creating || !docName.trim()}
              className="gap-1.5"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Créer et ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
