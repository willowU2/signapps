import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/scheduling/types/scheduling';
import { cn } from '@/lib/utils';

/** API tasks may carry denormalized assignee fields not in the base type */
type TaskWithAssignee = Task & {
  assignee_name?: string;
  assignee_avatar?: string;
};
import { Clock, CheckSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TaskCardProps {
  task: TaskWithAssignee;
  isOverlay?: boolean;
  onClick?: () => void;
}

export function TaskCard({ task, isOverlay = false, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-full h-[100px] bg-primary/5 border-2 border-dashed border-primary/20 rounded-lg opacity-50"
      />
    );
  }

  const priorityColors = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Prevent sorting constraints from triggering click if it was a drag
        if (onClick) onClick();
      }}
      className={cn(
        "bg-background p-3 rounded-lg border shadow-sm cursor-grab hover:shadow-md hover:border-blue-200 transition-all active:cursor-grabbing group",
        isOverlay && "rotate-2 scale-105 shadow-xl cursor-grabbing"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-wrap gap-1">
          <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm", priorityColors[task.priority as keyof typeof priorityColors || 'medium'])}>
            {task.priority || 'medium'}
          </span>
          {task.tags && task.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>
      
      <h4 className="text-sm font-semibold text-foreground leading-tight mb-1 truncate">
        {task.title}
      </h4>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
        <div className="flex items-center gap-2">
          {task.dueDate ? (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span className={cn("font-medium", task.dueDate < new Date() && "text-red-600")}>
                {format(task.dueDate, "d MMM", { locale: fr })}
              </span>
            </div>
          ) : <div />}
        </div>

        <div className="flex items-center gap-2">
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="font-medium">
                {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
              </span>
            </div>
          )}

          {/* Assignee avatar */}
          {task.assignee_name && (
            <Avatar className="h-5 w-5" title={task.assignee_name}>
              <AvatarImage src={task.assignee_avatar} />
              <AvatarFallback className="text-[8px] bg-blue-100 text-blue-700">
                {(task.assignee_name || '').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
