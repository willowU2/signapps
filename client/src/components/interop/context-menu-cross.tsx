'use client';

// Idea 26: Context menu → "Open in..." show related modules
// Idea 27: Quick actions → right-click any entity for cross-module actions
// Idea 23: Cross-module drag-drop → drag email to tasks creates task

import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  FileText, CheckSquare, UserPlus, Send, Star, Tag,
  ExternalLink, Copy, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { addLocalBookmark } from '@/components/crosslinks/CrossModuleFavorites';
import { getClient, ServiceName } from '@/lib/api/factory';

const identityClient = () => getClient(ServiceName.IDENTITY);

export type EntityType =
  | 'document' | 'mail_message' | 'contact' | 'task'
  | 'calendar_event' | 'chat_message' | 'drive_node'
  | 'form_response' | 'spreadsheet' | 'presentation';

const OPEN_IN_ROUTES: Partial<Record<EntityType, string>> = {
  document: '/docs',
  spreadsheet: '/sheets',
  presentation: '/slides',
  drive_node: '/drive',
  mail_message: '/mail',
  contact: '/contacts',
  task: '/tasks',
  calendar_event: '/calendar',
  chat_message: '/chat',
  form_response: '/forms',
};

interface CrossModuleContextMenuProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  entityUrl?: string;
  children: React.ReactNode;
}

/** Idea 26 + 27 – Right-click context menu with cross-module actions */
export function CrossModuleContextMenu({
  entityType,
  entityId,
  entityTitle,
  entityUrl,
  children,
}: CrossModuleContextMenuProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const openIn = (route: string) => {
    router.push(`${route}/${entityId}`);
  };

  const createTask = async () => {
    setCreating(true);
    try {
      const { data } = await identityClient().post<{ id: string }>('/tasks', {
        title: entityTitle,
        source: entityType,
        source_id: entityId,
        status: 'todo',
      });
      toast.success('Tâche créée', {
        action: { label: 'Ouvrir', onClick: () => router.push(`/tasks/${data.id}`) },
      });
    } catch {
      toast.info('Tâche mise en attente');
    } finally {
      setCreating(false);
    }
  };

  const bookmark = () => {
    addLocalBookmark({ entity_type: entityType, entity_id: entityId, entity_title: entityTitle, entity_url: entityUrl });
    toast.success('Ajouté aux favoris');
  };

  const copyLink = () => {
    const url = entityUrl || `${OPEN_IN_ROUTES[entityType] || ''}/${entityId}`;
    navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
    toast.success('Lien copié');
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem disabled className="text-xs font-medium text-muted-foreground">
          {entityTitle.slice(0, 30)}{entityTitle.length > 30 ? '…' : ''}
        </ContextMenuItem>
        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger className="text-xs gap-2">
            <ExternalLink className="w-3.5 h-3.5" />Ouvrir dans…
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {Object.entries(OPEN_IN_ROUTES).map(([type, route]) => (
              type !== entityType && (
                <ContextMenuItem key={type} onClick={() => openIn(route)} className="text-xs">
                  {type.replace('_', ' ')}
                </ContextMenuItem>
              )
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={createTask} disabled={creating} className="text-xs gap-2">
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
          Créer une tâche
        </ContextMenuItem>

        <ContextMenuItem onClick={bookmark} className="text-xs gap-2">
          <Star className="w-3.5 h-3.5" />Ajouter aux favoris
        </ContextMenuItem>

        <ContextMenuItem onClick={copyLink} className="text-xs gap-2">
          <Copy className="w-3.5 h-3.5" />Copier le lien
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => router.push(`/chat?share=${entityType}:${entityId}`)}
          className="text-xs gap-2"
        >
          <Send className="w-3.5 h-3.5" />Partager dans Chat
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Idea 23 – Drag email to tasks: utility to handle the drop */
export function useEmailToTaskDrop() {
  const [dragging, setDragging] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/signapps-mail')) {
      e.preventDefault();
      setDragging(true);
    }
  };

  const onDragLeave = () => setDragging(false);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const raw = e.dataTransfer.getData('application/signapps-mail');
    if (!raw) return;
    try {
      const mail = JSON.parse(raw) as { id: string; subject: string };
      await identityClient().post('/tasks', {
        title: mail.subject || 'Email sans sujet',
        source: 'mail_message',
        source_id: mail.id,
        status: 'todo',
      });
      toast.success(`Tâche créée depuis l'email "${mail.subject}"`);
    } catch {
      toast.info('Tâche mise en attente');
    }
  };

  return { dragging, onDragOver, onDragLeave, onDrop };
}
