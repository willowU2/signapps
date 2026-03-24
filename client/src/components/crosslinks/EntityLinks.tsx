'use client';

import { useEffect, useState } from 'react';
import { linksApi } from '@/lib/api/crosslinks';
import type { EntityReference } from '@/types/crosslinks';

const TYPE_LABELS: Record<string, string> = {
  calendar_event: 'Événement',
  mail_message: 'Email',
  drive_node: 'Fichier',
  document: 'Document',
  contact: 'Contact',
  task: 'Tâche',
  signature_envelope: 'Signature',
  form_response: 'Réponse formulaire',
  chat_message: 'Message',
};

interface Props {
  entityType: string;
  entityId: string;
}

export function EntityLinks({ entityType, entityId }: Props) {
  const [links, setLinks] = useState<EntityReference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    linksApi.find(entityType, entityId)
      .then(({ data }) => setLinks(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (loading) return <div className="animate-pulse h-10" />;

  const grouped = links.reduce<Record<string, EntityReference[]>>((acc, link) => {
    const otherType = link.source_type === entityType && link.source_id === entityId
      ? link.target_type : link.source_type;
    (acc[otherType] = acc[otherType] || []).push(link);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Liens associés</h3>
      {Object.entries(grouped).map(([type, refs]) => (
        <div key={type}>
          <p className="text-xs text-muted-foreground mb-1">{TYPE_LABELS[type] || type} ({refs.length})</p>
          {refs.map((ref) => {
            const otherId = ref.source_type === entityType ? ref.target_id : ref.source_id;
            return (
              <div key={ref.id} className="text-sm pl-2 py-0.5 border-l-2 border-muted">
                {otherId.slice(0, 8)}... <span className="text-xs text-muted-foreground">({ref.relation})</span>
              </div>
            );
          })}
        </div>
      ))}
      {links.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien</p>}
    </div>
  );
}
