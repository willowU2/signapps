import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskItemProps {
    task: { id: string, label: string, done: boolean };
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
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

    return (
        <div
            ref={(node) => {
                setDraggableRef(node);
                setDroppableRef(node);
            }}
            {...attributes}
            {...listeners}
            className={cn(
                "group flex items-start gap-3 py-3 px-2 rounded-md transition-colors cursor-grab active:cursor-grabbing",
                isOver ? "bg-blue-50 ring-2 ring-blue-500" : "hover:bg-muted/50",
                isDragging && "opacity-50 ring-2 ring-gray-400"
            )}
            onClick={() => onToggle(task.id)}
        >
            <div className="mt-0.5 shrink-0 cursor-pointer">
                {task.done ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                )}
            </div>
            <div
                className={cn(
                    "flex-1 text-sm leading-tight select-none cursor-pointer",
                    task.done && "text-muted-foreground line-through"
                )}
            >
                {task.label}
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(task.id);
                }}
            >
                <Trash2 className="h-3 w-3" />
            </Button>
        </div>
    );
}
