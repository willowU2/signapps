"use client";

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MessageSquare,
  Check,
  RotateCcw,
  Reply,
  X,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CommentData, CommentReply } from "../extensions/comment";

interface CommentsSidebarProps {
  comments: CommentData[];
  activeCommentId: string | null;
  onCommentClick: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  onReopen: (commentId: string) => void;
  onReply: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  className?: string;
}

type FilterType = "all" | "open" | "resolved";
type SortType = "date" | "position";

export function CommentsSidebar({
  comments,
  activeCommentId,
  onCommentClick,
  onResolve,
  onReopen,
  onReply,
  onDelete,
  className,
}: CommentsSidebarProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("date");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const filteredComments = useMemo(() => {
    let filtered = comments;

    if (filter === "open") {
      filtered = comments.filter((c) => !c.resolved);
    } else if (filter === "resolved") {
      filtered = comments.filter((c) => c.resolved);
    }

    if (sort === "date") {
      filtered = [...filtered].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    // Position sorting would require document position info

    return filtered;
  }, [comments, filter, sort]);

  const handleReplySubmit = (commentId: string) => {
    if (replyContent.trim()) {
      onReply(commentId, replyContent.trim());
      setReplyContent("");
      setReplyingTo(null);
    }
  };

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  return (
    <div
      className={cn("flex flex-col h-full bg-background border-l", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="font-semibold">Commentaires</span>
          <Badge variant="secondary">{comments.length}</Badge>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter("all")}>
                Tous ({comments.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("open")}>
                Ouverts ({openCount})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("resolved")}>
                Résolus ({resolvedCount})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSort("date")}>
                Par date
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("position")}>
                Par position
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredComments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Aucun commentaire</p>
              <p className="text-sm">
                Sélectionnez du texte et cliquez sur le bouton commentaire
              </p>
            </div>
          ) : (
            filteredComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                isActive={comment.id === activeCommentId}
                isReplying={replyingTo === comment.id}
                replyContent={replyContent}
                onClick={() => onCommentClick(comment.id)}
                onResolve={() => onResolve(comment.id)}
                onReopen={() => onReopen(comment.id)}
                onDelete={() => onDelete(comment.id)}
                onStartReply={() => setReplyingTo(comment.id)}
                onCancelReply={() => {
                  setReplyingTo(null);
                  setReplyContent("");
                }}
                onReplyContentChange={setReplyContent}
                onSubmitReply={() => handleReplySubmit(comment.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface CommentItemProps {
  comment: CommentData;
  isActive: boolean;
  isReplying: boolean;
  replyContent: string;
  onClick: () => void;
  onResolve: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onStartReply: () => void;
  onCancelReply: () => void;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: () => void;
}

function CommentItem({
  comment,
  isActive,
  isReplying,
  replyContent,
  onClick,
  onResolve,
  onReopen,
  onDelete,
  onStartReply,
  onCancelReply,
  onReplyContentChange,
  onSubmitReply,
}: CommentItemProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 cursor-pointer transition-colors",
        isActive && "ring-2 ring-primary",
        comment.resolved && "opacity-60",
      )}
      onClick={onClick}
    >
      {/* Comment Header */}
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={undefined} />
          <AvatarFallback>
            {comment.author.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {comment.author}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>

          <p className="text-sm mt-1">{comment.content}</p>
        </div>

        {comment.resolved ? (
          <Badge variant="secondary" className="shrink-0">
            <Check className="h-3 w-3 mr-1" />
            Résolu
          </Badge>
        ) : null}
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-3 ml-10 space-y-2">
          {comment.replies.map((reply) => (
            <ReplyItem key={reply.id} reply={reply} />
          ))}
        </div>
      )}

      {/* Reply Form */}
      {isReplying && (
        <div className="mt-3 ml-10 space-y-2">
          <Textarea
            placeholder="Écrire une réponse..."
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            className="min-h-[80px] text-sm"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSubmitReply();
              }}
            >
              Répondre
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onCancelReply();
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 ml-10">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onStartReply();
          }}
        >
          <Reply className="h-4 w-4 mr-1" />
          Répondre
        </Button>

        {comment.resolved ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onReopen();
            }}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Rouvrir
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onResolve();
            }}
          >
            <Check className="h-4 w-4 mr-1" />
            Résoudre
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ReplyItem({ reply }: { reply: CommentReply }) {
  return (
    <div className="flex items-start gap-2">
      <Avatar className="h-6 w-6">
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
        <p className="text-xs mt-0.5">{reply.content}</p>
      </div>
    </div>
  );
}

export default CommentsSidebar;
