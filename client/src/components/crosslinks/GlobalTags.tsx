'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Tag, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { getClient, ServiceName } from '@/lib/api/factory';

const client = () => getClient(ServiceName.IDENTITY);

interface EntityTag {
  id: string;
  label: string;
  color: string;
  entity_type: string;
  entity_id: string;
}

const TAG_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f97316',
  '#ec4899', '#8b5cf6', '#ef4444', '#eab308',
];

interface Props {
  entityType: string;
  entityId: string;
  readonly?: boolean;
}

export function GlobalTags({ entityType, entityId, readonly = false }: Props) {
  const [tags, setTags] = useState<EntityTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await client().get<EntityTag[]>('/tags', {
        params: { entity_type: entityType, entity_id: entityId },
      });
      setTags(data);
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const addTag = async () => {
    const label = newTag.trim();
    if (!label) return;
    try {
      const { data } = await client().post<EntityTag>('/tags', {
        entity_type: entityType,
        entity_id: entityId,
        label,
        color: selectedColor,
      });
      setTags(prev => [...prev, data]);
      setNewTag('');
      setOpen(false);
    } catch {
      // Store locally if API unavailable
      const local: EntityTag = {
        id: `local-${Date.now()}`,
        label,
        color: selectedColor,
        entity_type: entityType,
        entity_id: entityId,
      };
      setTags(prev => [...prev, local]);
      setNewTag('');
      setOpen(false);
    }
  };

  const removeTag = async (id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
    try {
      await client().delete(`/tags/${id}`);
    } catch { /* optimistic delete */ }
  };

  if (loading) return <div className="animate-pulse h-6 w-24 rounded bg-muted" />;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(tag => (
        <Badge
          key={tag.id}
          variant="outline"
          className="gap-1 text-xs font-normal py-0.5"
          style={{ borderColor: tag.color, color: tag.color }}
        >
          <Tag className="w-2.5 h-2.5" />
          {tag.label}
          {!readonly && (
            <button onClick={() => removeTag(tag.id)} className="hover:opacity-70">
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </Badge>
      ))}
      {!readonly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-xs text-muted-foreground">
              <Plus className="w-3 h-3 mr-0.5" />
              Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
              <p className="text-xs font-medium">Ajouter un tag</p>
              <Input
                placeholder="Nom du tag"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                className="h-7 text-xs"
                autoFocus
              />
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${selectedColor === c ? 'scale-125 ring-2 ring-offset-1 ring-current' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button size="sm" onClick={addTag} disabled={!newTag.trim()} className="w-full h-7 text-xs">
                Ajouter
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** Filter tags panel - shows all tagged entities by tag */
export function TagFilterPanel() {
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    client().get<{ label: string }[]>('/tags/labels')
      .then(({ data }) => setAllTags(data.map(t => t.label)))
      .catch(() => setAllTags([]));
  }, []);

  const toggle = (tag: string) => {
    setSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filtrer par tag</p>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map(tag => (
          <button key={tag} onClick={() => toggle(tag)}>
            <Badge
              variant={selected.includes(tag) ? 'default' : 'outline'}
              className="text-xs cursor-pointer"
            >
              <Tag className="w-2.5 h-2.5 mr-1" />
              {tag}
            </Badge>
          </button>
        ))}
        {allTags.length === 0 && <p className="text-xs text-muted-foreground">Aucun tag</p>}
      </div>
    </div>
  );
}
