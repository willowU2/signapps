'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MessageSquare,
  Trash2,
  Play,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  useAiConversations,
  type Conversation,
} from '@/hooks/use-ai-conversations';
import { SpinnerInfinity } from 'spinners-react';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatRelativeDate(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'A l\'instant';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Il y a ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days}j`;
    return new Date(isoDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '-';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION ROW
// ═══════════════════════════════════════════════════════════════════════════

function ConversationRow({
  conversation,
  onResume,
  onDelete,
}: {
  conversation: Conversation;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group">
      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{conversation.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeDate(conversation.updated_at)}
          </span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1">
            {conversation.message_count} msg
          </Badge>
          {conversation.model && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {conversation.model}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onResume(conversation.id)}
          title="Reprendre la conversation"
        >
          <Play className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(conversation.id)}
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

export function ConversationHistory() {
  const router = useRouter();
  const {
    conversations,
    loading,
    error,
    fetchConversations,
    deleteConversation,
  } = useAiConversations();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleResume = (conversationId: string) => {
    // Navigate to AI chat with the conversation_id as query param
    router.push(`/ai?conversation=${conversationId}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    await deleteConversation(deleteTargetId);
    setDeleteTargetId(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations recentes
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConversations}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-6 w-6"
              />
            </div>
          ) : error && conversations.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchConversations}>
                Reessayer
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucune conversation. Commencez a discuter avec l&apos;IA !
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-1.5">
                {conversations.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conversation={conv}
                    onResume={handleResume}
                    onDelete={setDeleteTargetId}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. La conversation et tous ses messages
              seront definitivement supprimes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
