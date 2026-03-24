'use client';

import { useEffect, useState } from 'react';
import { auditApi } from '@/lib/api/crosslinks';
import type { AuditLogEntry } from '@/types/crosslinks';

interface Props {
  entityType: string;
  entityId: string;
  limit?: number;
}

export function AuditTrail({ entityType, entityId, limit = 100 }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditApi.query({ entity_type: entityType, entity_id: entityId, limit })
      .then(({ data }) => setEntries(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityType, entityId, limit]);

  if (loading) return <div className="animate-pulse h-20" />;

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">Audit Trail</h3>
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
            <time className="text-muted-foreground whitespace-nowrap">
              {new Date(e.created_at).toLocaleString()}
            </time>
            <span className="font-mono">{e.action}</span>
            {e.actor_id && <span className="text-muted-foreground">par {e.actor_id.slice(0, 8)}</span>}
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Aucune entrée</p>}
      </div>
    </div>
  );
}
