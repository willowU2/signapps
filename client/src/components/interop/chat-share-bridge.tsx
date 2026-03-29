'use client';

// Idea 14: Chat → share any entity (doc, contact, task, file)
// Idea 15: Chat → create task from message
// Idea 24: Cross-module drag-drop → drag file to chat shares it

import { useState } from 'react';
import { Send, CheckSquare, Paperclip, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';
import { getClient, ServiceName } from '@/lib/api/factory';

const chatClient = () => getClient(ServiceName.CHAT);
const identityClient = () => getClient(ServiceName.IDENTITY);

export type ShareableEntityType = 'document' | 'contact' | 'task' | 'drive_node' | 'spreadsheet' | 'presentation';

const ENTITY_ICONS: Record<ShareableEntityType, string> = {
  document: '📄',
  contact: '👤',
  task: '✅',
  drive_node: '📁',
  spreadsheet: '📊',
  presentation: '📽️',
};

/** Idea 14 – Share any entity into a chat channel */
export function ShareEntityToChat({
  entityType,
  entityId,
  entityTitle,
  entityUrl,
}: {
  entityType: ShareableEntityType;
  entityId: string;
  entityTitle: string;
  entityUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [loading, setLoading] = useState(false);

  const share = async () => {
    if (!channelId.trim()) return;
    setLoading(true);
    try {
      await chatClient().post(`/channels/${channelId}/messages`, {
        type: 'entity_share',
        entity_type: entityType,
        entity_id: entityId,
        entity_title: entityTitle,
        entity_url: entityUrl || `/${entityType.replace('_', '-')}s/${entityId}`,
        text: `${ENTITY_ICONS[entityType]} *${entityTitle}*`,
      });
      setOpen(false);
      setChannelId('');
      toast.success('Partagé dans le chat');
    } catch {
      toast.error('Chat indisponible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
          <Send className="w-3.5 h-3.5" />Partager dans Chat
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium">Envoyer dans un canal</p>
          <div className="space-y-1">
            <Label className="text-xs">ID du canal</Label>
            <Input
              placeholder="canal-id"
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && share()}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <Button size="sm" onClick={share} disabled={loading || !channelId.trim()} className="w-full h-7 text-xs">
            {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Partager
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Idea 15 – Create task from a chat message */
export function ChatMessageToTask({
  messageId,
  messageText,
  channelId,
}: {
  messageId: string;
  messageText: string;
  channelId: string;
}) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createTask = async () => {
    setLoading(true);
    try {
      const { data } = await identityClient().post<{ id: string }>('/tasks', {
        title: messageText.slice(0, 100),
        source: 'chat_message',
        source_id: messageId,
        channel_id: channelId,
        status: 'todo',
      });
      setTaskId(data.id);
      toast.success('Tâche créée depuis le message');
    } catch {
      const pending = JSON.parse(localStorage.getItem('interop-chat-tasks') || '[]');
      pending.push({ messageId, messageText: messageText.slice(0, 100), channelId, queued_at: new Date().toISOString() });
      localStorage.setItem('interop-chat-tasks', JSON.stringify(pending));
      toast.info('Tâche en attente de création');
    } finally {
      setLoading(false);
    }
  };

  if (taskId) return (
    <Button size="sm" variant="ghost" asChild className="h-6 gap-1 text-[10px]">
      <Link href={`/tasks/${taskId}`}>
        <CheckSquare className="w-3 h-3" />Voir la tâche
        <ExternalLink className="w-2.5 h-2.5" />
      </Link>
    </Button>
  );

  return (
    <Button size="sm" variant="ghost" onClick={createTask} disabled={loading} className="h-6 gap-1 text-[10px] opacity-70 hover:opacity-100">
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
      Créer tâche
    </Button>
  );
}

/** Idea 24 – Drag-and-drop file to chat: share button shortcut */
export function FileShareToChat({
  fileId,
  fileName,
  fileUrl,
}: {
  fileId: string;
  fileName: string;
  fileUrl?: string;
}) {
  return (
    <ShareEntityToChat
      entityType="drive_node"
      entityId={fileId}
      entityTitle={fileName}
      entityUrl={fileUrl}
    />
  );
}
