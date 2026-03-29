'use client';

/**
 * Feature 21: AI → auto-tag uploaded Drive files
 */

import { useState } from 'react';
import { Tag, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DriveNode } from '@/lib/api/drive';
import { useAutoTagFile } from '@/hooks/use-cross-module';

interface AiAutoTagDriveProps {
  node: DriveNode;
  onTagsGenerated?: (tags: string[]) => void;
}

const TAG_STORAGE_KEY = (id: string) => `drive-tags:${id}`;

export function AiAutoTagDrive({ node, onTagsGenerated }: AiAutoTagDriveProps) {
  const [tags, setTags] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(TAG_STORAGE_KEY(node.id));
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const autoTag = useAutoTagFile();

  const handleAutoTag = async () => {
    setLoading(true);
    try {
      const generated = await autoTag(node.name, node.mime_type ?? node.node_type);
      setTags(generated);
      localStorage.setItem(TAG_STORAGE_KEY(node.id), JSON.stringify(generated));
      onTagsGenerated?.(generated);
      toast.success('Tags générés');
    } catch {
      toast.error('Erreur lors de la génération des tags');
    } finally {
      setLoading(false);
    }
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    localStorage.setItem(TAG_STORAGE_KEY(node.id), JSON.stringify(updated));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={handleAutoTag}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Auto-tag IA
        </Button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs h-5 pl-2 pr-1">
              <Tag className="h-2.5 w-2.5" />
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Standalone button for use in upload workflows */
interface AutoTagButtonProps {
  nodeId: string;
  nodeName: string;
  mimeType: string;
}

export function AutoTagButton({ nodeId, nodeName, mimeType }: AutoTagButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const autoTag = useAutoTagFile();

  const handle = async () => {
    setLoading(true);
    try {
      const tags = await autoTag(nodeName, mimeType);
      localStorage.setItem(TAG_STORAGE_KEY(nodeId), JSON.stringify(tags));
      setDone(true);
      toast.success(`${tags.length} tags générés pour ${nodeName}`);
    } catch {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handle} disabled={loading || done}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
      {done ? 'Taggé' : 'Tag IA'}
    </Button>
  );
}
