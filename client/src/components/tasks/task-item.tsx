"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Trash2, Calendar, CalendarCheck, User, MessageSquare, Paperclip, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { QuickTask, AttachedFile } from "@/lib/store";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface TaskItemProps {
    task: QuickTask;
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
    onRemoveFile?: (taskId: string, fileId: string) => void;
}

function formatDueDate(dateStr?: string): { text: string; isOverdue: boolean } | null {
    if (!dateStr) return null;

    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const absDays = Math.abs(diffDays);
        if (absDays === 1) return { text: "Hier", isOverdue: true };
        if (absDays < 7) return { text: `Il y a ${absDays} jours`, isOverdue: true };
        if (absDays < 14) return { text: "Il y a 1 semaine", isOverdue: true };
        if (absDays < 30) return { text: `Il y a ${Math.floor(absDays / 7)} semaines`, isOverdue: true };
        return { text: `Il y a ${Math.floor(absDays / 30)} mois`, isOverdue: true };
    }
    if (diffDays === 0) return { text: "Aujourd'hui", isOverdue: false };
    if (diffDays === 1) return { text: "Demain", isOverdue: false };
    if (diffDays < 7) return { text: date.toLocaleDateString('fr-FR', { weekday: 'long' }), isOverdue: false };
    return { text: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), isOverdue: false };
}

function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getFileIcon(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
        return <ImageIcon className="w-3 h-3 text-purple-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
        return <FileText className="w-3 h-3 text-red-500" />;
    }
    return <File className="w-3 h-3 text-gray-500" />;
}

export function TaskItem({ task, onToggle, onRemove, onRemoveFile }: TaskItemProps) {
    const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
        id: `task-drag-${task.id}`,
        data: {
            type: "task",
            task: { id: task.id, title: task.label, done: task.done }
        },
    });

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `task-drop-${task.id}`,
        data: {
            type: "task",
            accepts: ["file"], // Accept file drops
            task: { id: task.id, title: task.label, done: task.done }
        }
    });

    const hasAttachments = task.attachedFiles && task.attachedFiles.length > 0;
    const hasLinkedEvent = !!task.linkedEventId;

    const dueInfo = formatDueDate(task.dueDate);

    return (
        <div
            ref={(node) => {
                setDraggableRef(node);
                setDroppableRef(node);
            }}
            {...attributes}
            {...listeners}
            className={cn(
                "group flex items-start gap-3 py-3 px-4 transition-all cursor-grab active:cursor-grabbing border-l-2 border-l-transparent border-b border-b-[#f1f3f4]",
                isOver ? "bg-[#e8f0fe] border-l-[#1a73e8]" : "hover:bg-[#f8f9fa]",
                isDragging && "opacity-50 shadow-lg bg-background border-l-gray-300"
            )}
        >
            {/* Google Tasks Style Radio Checkbox - Rounded circle with border */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle(task.id);
                }}
                className={cn(
                    "mt-1 shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200",
                    task.done
                        ? "bg-[#1a73e8] border-[#1a73e8] shadow-sm"
                        : "border-[#80868b] hover:border-[#1a73e8] hover:bg-[#e8f0fe] bg-transparent"
                )}
            >
                {task.done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </button>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
                <div
                    className={cn(
                        "text-[14px] leading-snug select-none cursor-pointer text-[#202124]",
                        task.done && "text-[#80868b] line-through decoration-[#80868b]"
                    )}
                    onClick={() => onToggle(task.id)}
                >
                    {task.label}
                </div>

                {/* Meta row: date chip, chat indicator and assignee - Google Tasks Style */}
                {(dueInfo || task.assignee || hasAttachments || hasLinkedEvent) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Linked Event Chip - Green indicating scheduled */}
                        {hasLinkedEvent && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#e6f4ea] text-[#137333] border border-[#ceead6] transition-colors">
                                <CalendarCheck className="w-3.5 h-3.5" />
                                Planifié
                            </span>
                        )}

                        {/* Date Chip - Google Tasks rounded pill style */}
                        {dueInfo && (
                            <span className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-colors",
                                dueInfo.isOverdue && !task.done
                                    ? "bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf]"
                                    : task.done
                                        ? "bg-gray-100 text-gray-400"
                                        : "bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc]"
                            )}>
                                <Calendar className="w-3.5 h-3.5" />
                                {dueInfo.text}
                            </span>
                        )}

                        {/* Chat/Conversation Chip - Google Tasks style */}
                        {task.assignee && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] hover:bg-[#e8eaed] transition-colors cursor-pointer">
                                <MessageSquare className="w-3.5 h-3.5 text-[#5f6368]" />
                                Chat
                            </span>
                        )}

                        {/* Assignee Chip - Google Tasks avatar pill style */}
                        {task.assignee && (
                            <span className="inline-flex items-center gap-2 pl-1 pr-3 py-0.5 rounded-full text-[12px] font-medium bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0] hover:bg-[#e8eaed] transition-colors cursor-pointer">
                                <Avatar className="w-5 h-5 border border-white shadow-sm">
                                    <AvatarImage src={task.assignee.avatar} />
                                    <AvatarFallback className="text-[9px] bg-[#1a73e8] text-white font-semibold">
                                        {getInitials(task.assignee.name)}
                                    </AvatarFallback>
                                </Avatar>
                                {task.assignee.name.split(' ')[0]}
                            </span>
                        )}

                        {/* Attached Files Chips */}
                        {hasAttachments && (
                            <TooltipProvider>
                                {task.attachedFiles!.map((file) => (
                                    <Tooltip key={file.id}>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium bg-[#fef7e0] text-[#b45309] border border-[#fde68a] hover:bg-[#fef3c7] transition-colors cursor-pointer group/file">
                                                {getFileIcon(file.name)}
                                                <span className="max-w-[80px] truncate">{file.name}</span>
                                                {onRemoveFile && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRemoveFile(task.id, file.id);
                                                        }}
                                                        className="ml-0.5 p-0.5 rounded-full hover:bg-[#fde68a] opacity-0 group-hover/file:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                            <p>{file.name}</p>
                                            {file.size && <p className="text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>}
                                        </TooltipContent>
                                    </Tooltip>
                                ))}
                            </TooltipProvider>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Button - Google Tasks style */}
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] rounded-full shrink-0"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(task.id);
                }}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}
