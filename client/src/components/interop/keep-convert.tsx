'use client';

// Idea 8: Keep note → convert to doc
// Idea 9: Keep note → convert to task

import { useState } from 'react';
import { FileText, CheckSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';
import { getClient, ServiceName } from '@/lib/api/factory';

const docsClient = () => getClient(ServiceName.DOCS);
const identityClient = () => getClient(ServiceName.IDENTITY);

export interface KeepNote {
  id: string;
  title: string;
  content: string;
  checklist?: Array<{ text: string; checked: boolean }>;
  color?: string;
  created_at: string;
}

/** Idea 8 – Convert Keep note to a document */
export function NoteToDoc({ note }: { note: KeepNote }) {
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const convert = async () => {
    setLoading(true);
    try {
      const body = note.checklist
        ? `# ${note.title || 'Note'}\n\n${note.checklist.map(i => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n')}`
        : `# ${note.title || 'Note'}\n\n${note.content || ''}`;

      const { data } = await docsClient().post<{ id: string }>('/documents', {
        title: note.title || 'Note sans titre',
        content: body,
        source: 'keep_note',
        source_id: note.id,
      });
      setDocId(data.id);
      toast.success('Note convertie en document');
    } catch {
      // Local fallback
      const pending = JSON.parse(localStorage.getItem('interop-note-to-doc') || '[]');
      pending.push({ noteId: note.id, title: note.title, queued_at: new Date().toISOString() });
      localStorage.setItem('interop-note-to-doc', JSON.stringify(pending));
      toast.info('Conversion en attente (service docs indisponible)');
    } finally {
      setLoading(false);
    }
  };

  if (docId) return (
    <Button size="sm" variant="ghost" asChild className="h-7 gap-1 text-xs">
      <Link href={`/docs/${docId}`}>
        <FileText className="w-3.5 h-3.5" />Voir le doc
      </Link>
    </Button>
  );

  return (
    <Button size="sm" variant="ghost" onClick={convert} disabled={loading} title="Convertir en document" className="h-7 w-7 p-0">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
    </Button>
  );
}

/** Idea 9 – Convert Keep note to a task */
export function NoteToTask({ note }: { note: KeepNote }) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const convert = async () => {
    setLoading(true);
    try {
      const { data } = await identityClient().post<{ id: string }>('/tasks', {
        title: note.title || note.content?.slice(0, 60) || 'Tâche depuis note',
        description: note.content || '',
        source: 'keep_note',
        source_id: note.id,
        status: 'todo',
        created_at: new Date().toISOString(),
      });
      setTaskId(data.id);
      toast.success('Note convertie en tâche');
    } catch {
      const pending = JSON.parse(localStorage.getItem('interop-note-to-task') || '[]');
      pending.push({ noteId: note.id, title: note.title, content: note.content, queued_at: new Date().toISOString() });
      localStorage.setItem('interop-note-to-task', JSON.stringify(pending));
      toast.info('Tâche en attente de création');
    } finally {
      setLoading(false);
    }
  };

  if (taskId) return (
    <Button size="sm" variant="ghost" asChild className="h-7 gap-1 text-xs">
      <Link href={`/tasks/${taskId}`}>
        <CheckSquare className="w-3.5 h-3.5" />Voir la tâche
      </Link>
    </Button>
  );

  return (
    <Button size="sm" variant="ghost" onClick={convert} disabled={loading} title="Convertir en tâche" className="h-7 w-7 p-0">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
    </Button>
  );
}
