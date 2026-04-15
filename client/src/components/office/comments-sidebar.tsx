"use client";

/**
 * CommentsSidebar
 *
 * Enhanced comments panel with filtering, threading, and actions.
 */

import React, { useState, useMemo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MessageSquare,
  Check,
  CheckCheck,
  Reply,
  MoreHorizontal,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Trash2,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// Types
// ============================================================================

export interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  replies: CommentReply[];
  // Position in document
  anchorText?: string;
  anchorPosition?: { from: number; to: number };
}

type FilterStatus = "all" | "open" | "resolved";
type SortBy = "newest" | "oldest" | "position";

interface CommentsSidebarProps {
  comments: Comment[];
  currentUserId: string;
  onResolve: (commentId: string) => void;
  onUnresolve: (commentId: string) => void;
  onReply: (commentId: string, content: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onCommentClick?: (comment: Comment) => void;
  className?: string;
}

// ============================================================================
// Comment Thread Component
// ============================================================================

interface CommentThreadProps {
  comment: Comment;
  currentUserId: string;
  onResolve: () => void;
  onUnresolve: () => void;
  onReply: (content: string) => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onClick?: () => void;
}

function CommentThread({
  comment,
  currentUserId,
  onResolve,
  onUnresolve,
  onReply,
  onEdit,
  onDelete,
  onClick,
}: CommentThreadProps) {
  const [isExpanded, setIsExpanded] = useState(!comment.resolved);
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState(comment.content);

  const isOwner = comment.authorId === currentUserId;

  const handleSubmitReply = () => {
    if (replyContent.trim()) {
      onReply(replyContent.trim());
      setReplyContent("");
      setIsReplying(false);
    }
  };

  const handleSubmitEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit(editContent.trim());
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group rounded-lg border bg-card transition-colors",
        comment.resolved
          ? "border-muted bg-muted/30"
          : "border-border hover:border-primary/50",
        "cursor-pointer",
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.authorAvatar} />
          <AvatarFallback>
            {comment.authorName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {comment.authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
            {comment.resolved && (
              <Badge variant="secondary" className="ml-auto text-xs">
                <CheckCheck className="mr-1 h-3 w-3" />
                Résolu
              </Badge>
            )}
          </div>

          {/* Anchor text preview */}
          {comment.anchorText && (
            <div className="mt-1 text-xs text-muted-foreground italic truncate">
              "{comment.anchorText}"
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {comment.resolved ? (
                <DropdownMenuItem onClick={onUnresolve}>
                  <X className="mr-2 h-4 w-4" />
                  Rouvrir
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onResolve}>
                  <Check className="mr-2 h-4 w-4" />
                  Marquer comme résolu
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReplying(true);
                }}
              >
                <Reply className="mr-2 h-4 w-4" />
                Répondre
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                      setEditContent(comment.content);
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3">
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[80px] resize-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(false);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubmitEdit();
                      }}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div className="mt-3 space-y-3 border-l-2 border-muted pl-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={reply.authorAvatar} />
                        <AvatarFallback className="text-xs">
                          {reply.authorName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {reply.authorName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(reply.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90">
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {isReplying && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Écrire une réponse..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="min-h-[60px] resize-none"
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsReplying(false);
                        setReplyContent("");
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubmitReply();
                      }}
                      disabled={!replyContent.trim()}
                    >
                      Répondre
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// Main Sidebar Component
// ============================================================================

export function CommentsSidebar({
  comments,
  currentUserId,
  onResolve,
  onUnresolve,
  onReply,
  onEdit,
  onDelete,
  onCommentClick,
  className,
}: CommentsSidebarProps) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and sort comments
  const filteredComments = useMemo(() => {
    let result = [...comments];

    // Filter by status
    if (filterStatus === "open") {
      result = result.filter((c) => !c.resolved);
    } else if (filterStatus === "resolved") {
      result = result.filter((c) => c.resolved);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.content.toLowerCase().includes(query) ||
          c.authorName.toLowerCase().includes(query) ||
          c.anchorText?.toLowerCase().includes(query),
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "position":
        result.sort(
          (a, b) =>
            (a.anchorPosition?.from || 0) - (b.anchorPosition?.from || 0),
        );
        break;
    }

    return result;
  }, [comments, filterStatus, sortBy, searchQuery]);

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="font-semibold">Commentaires</h2>
          <Badge variant="secondary">{comments.length}</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 border-b p-3">
        <Input
          placeholder="Rechercher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8"
        />

        <div className="flex gap-2">
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as FilterStatus)}
          >
            <SelectTrigger className="h-8 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous ({comments.length})</SelectItem>
              <SelectItem value="open">Ouverts ({openCount})</SelectItem>
              <SelectItem value="resolved">
                Résolus ({resolvedCount})
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Plus récent</SelectItem>
              <SelectItem value="oldest">Plus ancien</SelectItem>
              <SelectItem value="position">Position</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          <AnimatePresence mode="popLayout">
            {filteredComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">Aucun commentaire</p>
              </div>
            ) : (
              filteredComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onResolve={() => onResolve(comment.id)}
                  onUnresolve={() => onUnresolve(comment.id)}
                  onReply={(content) => onReply(comment.id, content)}
                  onEdit={(content) => onEdit(comment.id, content)}
                  onDelete={() => onDelete(comment.id)}
                  onClick={() => onCommentClick?.(comment)}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

export default CommentsSidebar;
