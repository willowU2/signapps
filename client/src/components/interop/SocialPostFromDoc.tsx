"use client";

/**
 * Feature 2: Social post → create from doc content
 * Feature 20: Social → import content from doc as post draft
 * Feature 24: AI → generate social post from doc summary
 */

import { useState } from "react";
import { FileText, Sparkles, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { driveApi } from "@/lib/api/drive";
import {
  useSummarizeDoc,
  useGenerateSocialPost,
} from "@/hooks/use-cross-module";
import { useRouter } from "next/navigation";

const PLATFORMS = ["Twitter", "LinkedIn", "Instagram", "Facebook"];

export function SocialPostFromDoc() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [platform, setPlatform] = useState("Twitter");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  const summarizeDoc = useSummarizeDoc();
  const generatePost = useGenerateSocialPost();

  const { data: docs = [] } = useQuery({
    queryKey: ["drive-docs-for-social"],
    queryFn: async () => {
      const nodes = await driveApi.listNodes(null);
      return nodes.filter((n) => n.node_type === "document");
    },
    enabled: open,
  });

  const handleGenerate = async () => {
    if (!selectedDoc) {
      toast.error("Sélectionnez un document");
      return;
    }
    setLoading(true);
    try {
      const summary = await summarizeDoc(selectedDoc.name);
      const post = await generatePost(summary, platform);
      setDraft(post);
    } catch {
      toast.error("Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const handleUseDraft = () => {
    if (!draft) {
      toast.error("Générez un brouillon d'abord");
      return;
    }
    const encoded = encodeURIComponent(draft);
    router.push(`/social/compose?draft=${encoded}`);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <FileText className="h-3.5 w-3.5" />
        Depuis un doc
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Post social depuis un document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Document source</label>
              <select
                className="w-full border rounded-md p-2 text-sm bg-background"
                value={selectedDoc?.id ?? ""}
                onChange={(e) =>
                  setSelectedDoc(
                    docs.find((d) => d.id === e.target.value) ?? null,
                  )
                }
              >
                <option value="">Sélectionner un document...</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => (
                <Badge
                  key={p}
                  variant={platform === p ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setPlatform(p)}
                >
                  {p}
                </Badge>
              ))}
            </div>

            <Button
              className="w-full gap-1.5"
              onClick={handleGenerate}
              disabled={loading || !selectedDoc}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Générer avec l'IA
            </Button>

            {draft && (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="text-sm"
                placeholder="Brouillon du post..."
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleUseDraft}
              disabled={!draft}
              className="gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ouvrir dans le Composer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
