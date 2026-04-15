import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageSquare,
  Smile,
  MoreHorizontal,
  Forward,
  Edit2,
  Trash2,
  Pin,
  PinOff,
  CheckSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatToTaskDialog } from "./chat-to-task-dialog";
import { cn } from "@/lib/utils";
import { useUsersMap } from "@/lib/store/chat-store";
import { ChatAttachment as Attachment, chatApi } from "@/lib/api/chat";
import { ChatMarkdown } from "./chat-markdown";
import { AttachmentPreview } from "./file-attachment";
import { VoiceMessagePlayer } from "./voice-message";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  avatar?: string;
  reactions?: Record<string, number>;
  isEdited?: boolean;
  isPinned?: boolean;
  attachment?: Attachment;
}

interface MessageItemProps {
  message: ChatMessage;
  isMe: boolean;
  showAvatar: boolean;
  channelId?: string;
  onReplyInThread?: (msgId: string) => void;
  onAddReaction?: (msgId: string, emoji: string) => void;
  onPin?: (msgId: string) => void;
  onUnpin?: (msgId: string) => void;
  canPin?: boolean;
  onMessageEdited?: (msgId: string, newContent: string) => void;
  onMessageDeleted?: (msgId: string) => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉"];

export function MessageItem({
  message,
  isMe,
  showAvatar,
  channelId,
  onReplyInThread,
  onAddReaction,
  onPin,
  onUnpin,
  canPin = true,
  onMessageEdited,
  onMessageDeleted,
}: MessageItemProps) {
  const usersMap = useUsersMap();
  const [isHovered, setIsHovered] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!channelId || !editContent.trim()) return;
    try {
      await chatApi.editMessage(channelId, message.id, editContent.trim());
      onMessageEdited?.(message.id, editContent.trim());
      toast.success("Message modifié");
    } catch {
      toast.error("Impossible de modifier le message");
    }
    setIsEditing(false);
  };

  const handleDeleteMessage = async () => {
    if (!channelId) return;
    setDeleting(true);
    try {
      await chatApi.deleteMessage(channelId, message.id);
      onMessageDeleted?.(message.id);
      toast.success("Message supprimé");
    } catch {
      toast.error("Impossible de supprimer le message");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const date = new Date(message.timestamp);
  const timeString = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const targetUser =
    usersMap[message.senderId] ||
    Object.values(usersMap).find((u) => u.username === message.senderName);
  const resolvedAvatar =
    message.avatar ||
    targetUser?.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.senderId}`;

  const isVoice = message.attachment?.content_type?.startsWith("audio/");

  return (
    <>
      <ChatToTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        message={{
          content: message.content,
          author: message.senderName,
          channel: "chat",
        }}
      />
      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm p-6 mx-4">
            <h2 className="text-base font-semibold mb-2">
              Supprimer ce message ?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-accent"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteMessage}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className={cn(
          "group relative flex gap-3 px-2 py-1.5 transition-colors hover:bg-muted/30 rounded-lg",
          !showAvatar && "mt-0.5",
          showAvatar && "mt-4",
          message.isPinned &&
            "border-l-2 border-primary/40 bg-primary/5 hover:bg-primary/10",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Hover Toolbar */}
        {isHovered && (
          <div className="absolute -top-4 right-4 z-10 flex items-center gap-0.5 rounded-md border bg-background p-1 shadow-sm animate-in fade-in zoom-in-95 duration-200">
            <TooltipProvider delayDuration={300}>
              {QUICK_REACTIONS.map((emoji) => (
                <Tooltip key={emoji}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-base hover:bg-muted"
                      onClick={() => onAddReaction?.(message.id, emoji)}
                    >
                      {emoji}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    React with {emoji}
                  </TooltipContent>
                </Tooltip>
              ))}

              <div className="w-px h-4 bg-border mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onReplyInThread?.(message.id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Reply in thread
                </TooltipContent>
              </Tooltip>

              {canPin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        message.isPinned
                          ? onUnpin?.(message.id)
                          : onPin?.(message.id)
                      }
                    >
                      {message.isPinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {message.isPinned ? "Unpin" : "Pin message"}
                  </TooltipContent>
                </Tooltip>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <Forward className="mr-2 h-4 w-4" />
                    Forward message
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* CH5: Create task from message */}
                  <DropdownMenuItem onClick={() => setTaskDialogOpen(true)}>
                    <CheckSquare className="mr-2 h-4 w-4 text-emerald-500" />
                    Créer une tâche
                  </DropdownMenuItem>
                  {isMe && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleStartEdit}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>
        )}

        {/* Avatar Gutter */}
        <div className="w-10 shrink-0 flex justify-center">
          {showAvatar ? (
            <Avatar className="h-9 w-9 ring-1 ring-border/50 transition-transform hover:scale-105 cursor-pointer">
              <AvatarImage src={resolvedAvatar} />
              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                {message.senderName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-full flex justify-center mt-1">
              <span className="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground transition-colors select-none">
                {timeString}
              </span>
            </div>
          )}
        </div>

        {/* Message Body */}
        <div className="flex flex-col flex-1 min-w-0">
          {showAvatar && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold hover:underline cursor-pointer">
                {message.senderName}
              </span>
              <span className="text-[11px] text-muted-foreground/70 font-medium">
                {timeString}
              </span>
              {message.isPinned && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary/70 font-medium">
                  <Pin className="h-2.5 w-2.5" />
                  pinned
                </span>
              )}
            </div>
          )}

          {/* Content — IDEA-143: render markdown / inline edit */}
          {!isVoice &&
            (isEditing ? (
              <div className="flex flex-col gap-2 mt-1">
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  rows={Math.max(2, editContent.split("\n").length)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Entrée pour enregistrer · Échap pour annuler</span>
                  <button
                    onClick={handleSaveEdit}
                    className="ml-auto px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                  >
                    Sauvegarder
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 rounded border text-xs hover:bg-accent"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : message.content ? (
              <div className="text-[15px] text-foreground/90 leading-relaxed break-words">
                <ChatMarkdown content={message.content} />
                {message.isEdited && (
                  <span className="text-[10px] text-muted-foreground ml-2 select-none">
                    (modifié)
                  </span>
                )}
              </div>
            ) : null)}

          {/* File attachment (IDEA-134) */}
          {message.attachment && !isVoice && (
            <AttachmentPreview attachment={message.attachment} />
          )}

          {/* Voice message (IDEA-135) */}
          {isVoice && message.attachment && (
            <VoiceMessagePlayer src={message.attachment.url} />
          )}

          {/* Reactions (IDEA-131) */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.entries(message.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 hover:bg-muted border border-transparent hover:border-border px-2 py-0.5 text-xs font-medium transition-colors"
                  onClick={() => onAddReaction?.(message.id, emoji)}
                >
                  <span>{emoji}</span>
                  <span className="text-muted-foreground">{count}</span>
                </button>
              ))}
              <button
                className="inline-flex items-center gap-1 rounded-full bg-muted/30 hover:bg-muted border border-transparent hover:border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors"
                onClick={() => {
                  /* open full emoji picker */
                }}
              >
                <Smile className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
