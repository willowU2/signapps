"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Trash2, Calendar, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { QuickTask } from "@/lib/store";

interface TaskItemProps {
    task: QuickTask;
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
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

export function TaskItem({ task, onToggle, onRemove }: TaskItemProps) {
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
            task: { id: task.id, title: task.label, done: task.done }
        }
    });

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
                "group flex items-start gap-3 py-3 px-3 rounded-lg transition-all cursor-grab active:cursor-grabbing border border-transparent",
                isOver ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50",
                isDragging && "opacity-50 shadow-lg bg-white border-gray-200"
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
                        "text-sm leading-relaxed select-none cursor-pointer",
                        task.done && "text-gray-400 line-through"
                    )}
                    onClick={() => onToggle(task.id)}
                >
                    {task.label}
                </div>

                {/* Meta row: date chip, chat indicator and assignee - Google Tasks Style */}
                {(dueInfo || task.assignee) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                    </div>
                )}
            </div>

            {/* Delete Button */}
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
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
