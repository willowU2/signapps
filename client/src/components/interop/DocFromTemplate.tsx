'use client';

/**
 * Feature 9: Doc template → use in social post
 * Feature 22: Drive → create doc from template
 */

import { useState } from 'react';
import { Layout, Plus, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { driveApi } from '@/lib/api/drive';
import { BUILTIN_DOC_TEMPLATES } from '@/lib/document-templates';
import { useRouter } from 'next/navigation';

interface DocFromTemplateProps {
  /** When provided, after creating doc, set the content in the composer */
  onInsertContent?: (content: string) => void;
  triggerLabel?: string;
}

export function DocFromTemplate({ onInsertContent, triggerLabel = 'Modèle' }: DocFromTemplateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [docName, setDocName] = useState('');
  const [loading, setLoading] = useState(false);

  const templates = BUILTIN_DOC_TEMPLATES;

  const handleCreate = async () => {
    if (!docName.trim()) { toast.error('Donnez un titre au document'); return; }
    setLoading(true);
    try {
      const targetId = crypto.randomUUID();
      const newNode = await driveApi.createNode({
        name: docName.trim(),
        node_type: 'document',
        parent_id: null,
        target_id: targetId,
      });
      const finalId = newNode.target_id || newNode.id;
      if (selectedTemplate?.content) {
        localStorage.setItem(`doc-template:${finalId}`, selectedTemplate.content);
      }
      toast.success('Document créé depuis le modèle');
      setOpen(false);
      router.push(`/docs/editor?id=${finalId}&name=${encodeURIComponent(newNode.name)}`);
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleUseInPost = () => {
    if (!selectedTemplate?.content) { toast.error('Sélectionnez un modèle'); return; }
    if (onInsertContent) {
      onInsertContent(selectedTemplate.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500));
      setOpen(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Layout className="h-3.5 w-3.5" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              Créer depuis un modèle
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => { setSelectedTemplate(tpl); setDocName(tpl.title); }}
                  className={`p-3 rounded-lg border text-left text-sm transition-all ${
                    selectedTemplate?.id === tpl.id
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <p className="font-medium text-xs">{tpl.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Titre du document</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Nom du document..."
                className="h-8 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            {onInsertContent && (
              <Button variant="outline" onClick={handleUseInPost} disabled={!selectedTemplate} className="gap-1.5">
                Utiliser dans le post
              </Button>
            )}
            <Button onClick={handleCreate} disabled={loading || !docName.trim()} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Créer le document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
