import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, Smile, MoreHorizontal, Forward, Edit2, Trash2, CheckCircle2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUsersMap } from "@/lib/store/chat-store";

export interface ChatMessage {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    avatar?: string;
    reactions?: Record<string, number>; // emoji -> count
    isEdited?: boolean;
}

interface MessageItemProps {
    message: ChatMessage;
    isMe: boolean;
    showAvatar: boolean;
    onReplyInThread?: (msgId: string) => void;
    onAddReaction?: (msgId: string, emoji: string) => void;
}

export function MessageItem({ message, isMe, showAvatar, onReplyInThread, onAddReaction }: MessageItemProps) {
    const usersMap = useUsersMap();
    const [isHovered, setIsHovered] = useState(false);
    const date = new Date(message.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Resolve user avatar
    const targetUser = usersMap[message.senderId] || Object.values(usersMap).find(u => u.username === message.senderName);
    const resolvedAvatar = message.avatar || targetUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.senderId}`;

    // Quick reaction picker options
    const quickReactions = ["👍", "❤️", "😂", "🎉"];

    return (
        <div
            className={cn(
                "group relative flex gap-3 px-2 py-1.5 transition-colors hover:bg-muted/30 rounded-lg",
                !showAvatar && "mt-0.5",
                showAvatar && "mt-4"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Hover Toolbar */}
            {isHovered && (
                <div className="absolute -top-4 right-4 z-10 flex items-center gap-0.5 rounded-md border bg-background p-1 shadow-sm transition-opacity animate-in fade-in zoom-in-95 duration-200">
                    <TooltipProvider delayDuration={300}>
                        {quickReactions.map(emoji => (
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
                                <TooltipContent side="top" className="text-xs">React with {emoji}</TooltipContent>
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
                            <TooltipContent side="top" className="text-xs">Reply in thread</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem>
                                    <Forward className="mr-2 h-4 w-4" />
                                    Forward message
                                </DropdownMenuItem>
                                {isMe && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem>
                                            <Edit2 className="mr-2 h-4 w-4" />
                                            Edit message
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete message
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
                        <span className="text-sm font-semibold hover:underline cursor-pointer">{message.senderName}</span>
                        <span className="text-[11px] text-muted-foreground/70 font-medium">
                            {timeString}
                        </span>
                    </div>
                )}

                <div className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                    {message.isEdited && (
                        <span className="text-[10px] text-muted-foreground ml-2 select-none">(edited)</span>
                    )}
                </div>

                {/* Reactions (Mock Display) */}
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
                    </div>
                )}
            </div>
        </div>
    );
}
