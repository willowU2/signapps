'use client';

// Idea 28: Linked entities panel — show related items from other modules
// Idea 39: Smart links — auto-detect and link related entities
// Idea 33: Duplicate detection — cross-module dedup

import { useState, useEffect, useCallback } from 'react';
import { Link2, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { linksApi } from '@/lib/api/crosslinks';
import type { EntityReference } from '@/types/crosslinks';
import { getClient, ServiceName } from '@/lib/api/factory';

const identityClient = () => getClient(ServiceName.IDENTITY);

const TYPE_ICON: Record<string, string> = {
  document: '📄', drive_node: '📁', mail_message: '✉️',
  calendar_event: '📅', contact: '👤', task: '✅',
  form_response: '📝', chat_message: '💬', spreadsheet: '📊',
  presentation: '📽️', compliance_document: '⚖️', legal_form: '📜',
};

const TYPE_HREF: Record<string, (id: string) => string> = {
  document: id => `/docs/${id}`,
  drive_node: id => `/drive/${id}`,
  mail_message: id => `/mail/${id}`,
  contact: id => `/contacts/${id}`,
  task: id => `/tasks/${id}`,
  spreadsheet: id => `/sheets/${id}`,
  presentation: id => `/slides/${id}`,
  calendar_event: id => `/calendar/${id}`,
};

interface Props {
  entityType: string;
  entityId: string;
  entityTitle?: string;
  allowAdd?: boolean;
}

/** Idea 28 – Linked entities side panel */
export function LinkedEntitiesPanel({ entityType, entityId, allowAdd = true }: Props) {
  const [links, setLinks] = useState<EntityReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await linksApi.find(entityType, entityId);
      setLinks(data);
    } catch { setLinks([]); }
    finally { setLoading(false); }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const removeLink = async (linkId: string) => {
    setRemoving(linkId);
    setLinks(prev => prev.filter(l => l.id !== linkId));
    try { await linksApi.remove(linkId); }
    catch { toast.error('Impossible de supprimer le lien'); }
    finally { setRemoving(null); }
  };

  if (loading) return <div className="animate-pulse h-20 rounded bg-muted" />;

  const grouped = links.reduce<Record<string, EntityReference[]>>((acc, l) => {
    const t = l.source_type === entityType ? l.target_type : l.source_type;
    (acc[t] = acc[t] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="w-4 h-4" />
          Entités liées
          {links.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{links.length}</Badge>}
        </div>
        {allowAdd && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => toast.info('Glissez une entité ici pour créer un lien')}>
            <Plus className="w-3 h-3 mr-0.5" />Lier
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Aucun élément lié</p>
      ) : (
        <ScrollArea className="max-h-64">
          <div className="space-y-3 pr-1">
            {Object.entries(grouped).map(([type, refs]) => (
              <div key={type}>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">{type.replace('_', ' ')} ({refs.length})</p>
                <div className="space-y-1">
                  {refs.map(r => {
                    const otherId = r.source_type === entityType ? r.target_id : r.source_id;
                    const href = TYPE_HREF[type]?.(otherId);
                    return (
                      <div key={r.id} className="flex items-center gap-2 p-1.5 rounded border hover:bg-muted/40 group">
                        <span className="text-sm">{TYPE_ICON[type] || '🔗'}</span>
                        <div className="flex-1 min-w-0">
                          {href ? (
                            <a href={href} className="text-xs hover:underline truncate block">{otherId.slice(0, 12)}…</a>
                          ) : (
                            <p className="text-xs truncate">{otherId.slice(0, 12)}…</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">{r.relation}</p>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => removeLink(r.id)}
                          disabled={removing === r.id}
                        >
                          {removing === r.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Separator className="mt-2" />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface DuplicateEntry {
  id: string;
  module: string;
  title: string;
  similarity: number;
}

/** Idea 33 – Cross-module duplicate detection */
export function DuplicateDetector({
  entityType,
  entityId,
  entityTitle,
}: {
  entityType: string;
  entityId: string;
  entityTitle: string;
}) {
  const [dupes, setDupes] = useState<DuplicateEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const { data } = await identityClient().get<DuplicateEntry[]>('/dedup/check', {
        params: { entity_type: entityType, entity_id: entityId, title: entityTitle },
      });
      setDupes(data);
      setChecked(true);
    } catch {
      setDupes([]);
      setChecked(true);
    } finally {
      setLoading(false);
    }
  };

  if (!checked) return (
    <Button size="sm" variant="ghost" onClick={check} disabled={loading} className="h-7 gap-1 text-xs">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
      Détecter les doublons
    </Button>
  );

  if (!dupes.length) return (
    <Badge variant="outline" className="text-xs gap-1 text-green-600">
      Aucun doublon détecté
    </Badge>
  );

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5" />{dupes.length} doublon(s) potentiel(s)
      </p>
      {dupes.map(d => (
        <div key={d.id} className="text-xs flex items-center gap-2 pl-2">
          <span className="text-muted-foreground">{d.module}</span>
          <span className="font-medium">{d.title}</span>
          <Badge variant="outline" className="text-[10px] h-3.5 px-1">{Math.round(d.similarity * 100)}%</Badge>
        </div>
      ))}
    </div>
  );
}
