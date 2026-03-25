'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Check,
  RotateCcw,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CommentData, CommentReply } from '../extensions/comment';
import { CommentInput } from './comment-input';

// ============================================================================
// Types
// ============================================================================

export interface CommentThreadProps {
  comment: CommentData;
  isActive?: boolean;
  currentUserId?: string;
  onClick?: () => void;
  onResolve?: (commentId: string) => void;
  onReopen?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onReply?: (commentId: string, content: string) => void;
  onDeleteReply?: (commentId: string, replyId: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CommentThread({
  comment,
  isActive = false,
  currentUserId,
  onClick,
  onResolve,
  onReopen,
  onDelete,
  onReply,
  onDeleteReply,
  className,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);

  const handleReply = (content: string) => {
    onReply?.(comment.id, content);
    setShowReplyInput(false);
  };

  const isAuthor = currentUserId === comment.authorId;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-all',
        isActive && 'ring-2 ring-primary shadow-sm',
        comment.resolved && 'opacity-60',
        className
      )}
      onClick={onClick}
    >
      {/* Main comment */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={undefined} />
            <AvatarFallback className="text-xs">
              {comment.author.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-sm truncate">
                  {comment.author}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {comment.resolved && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Check className="h-3 w-3" />
                    Resolu
                  </Badge>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {comment.resolved ? (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onReopen?.(comment.id);
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Rouvrir
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve?.(comment.id);
                        }}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Resoudre
                      </DropdownMenuItem>
                    )}
                    {isAuthor && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(comment.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="border-t">
          {comment.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              commentId={comment.id}
              currentUserId={currentUserId}
              onDeleteReply={onDeleteReply}
            />
          ))}
        </div>
      )}

      {/* Reply input */}
      <div className="border-t px-3 py-2">
        {showReplyInput ? (
          <CommentInput
            placeholder="Ecrire une reponse..."
            onSubmit={handleReply}
            onCancel={() => setShowReplyInput(false)}
            autoFocus
            compact
          />
        ) : (
          <button
            className="w-full text-left text-sm text-muted-foreground hover:text-foreground py-1 px-2 rounded hover:bg-muted/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowReplyInput(true);
            }}
          >
            Repondre...
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ReplyItem sub-component
// ============================================================================

interface ReplyItemProps {
  reply: CommentReply;
  commentId: string;
  currentUserId?: string;
  onDeleteReply?: (commentId: string, replyId: string) => void;
}

function ReplyItem({ reply, commentId, currentUserId, onDeleteReply }: ReplyItemProps) {
  const isAuthor = currentUserId === reply.authorId;

  return (
    <div className="flex items-start gap-2 px-3 py-2 group">
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarImage src={undefined} />
        <AvatarFallback className="text-xs">
          {reply.author.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs">{reply.author}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(reply.createdAt), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
        </div>
        <p className="text-xs mt-0.5 whitespace-pre-wrap">{reply.content}</p>
      </div>

      {isAuthor && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteReply?.(commentId, reply.id);
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      )}
    </div>
  );
}

export default CommentThread;
