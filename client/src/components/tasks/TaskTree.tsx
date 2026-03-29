"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, CalendarIcon, MessageSquare, Star, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickComposeButton } from "@/components/interop/QuickComposeFromTask";
import { LinkedEntitiesPanel } from "@/components/interop/LinkedEntitiesPanel";
import { useTaskNotifications } from "@/components/interop/TaskNotificationHooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEntityStore } from "@/stores/entity-hub-store";
import { format, isPast, parseISO } from "date-fns";

interface Task {
  id: string;
  project_id: string;
  parent_id?: string;
  title: string;
  status: string;
  priority: number;
  due_date?: string;
  assigned_to?: string;
}

interface TaskNode {
  task: Task;
  children: TaskNode[];
}

interface TaskTreeProps {
  projectId: string;
  onTaskSelect?: (task: Task) => void;
  onAddChild?: (parentId: string) => void;
}

const PRIORITY_COLORS: Record<number, string> = {
  0: "text-muted-foreground",    // Low
  1: "text-blue-500",    // Medium
  2: "text-orange-500",  // High
  3: "text-red-500",     // Urgent
};

interface TaskItemProps {
  node: TaskNode;
  level: number;
  onTaskSelect?: (task: Task) => void;
  onAddChild?: (parentId: string) => void;
  onDelete?: (taskId: string) => void;
}

function TaskItem({
  node,
  level,
  onTaskSelect,
  onAddChild,
  onDelete,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(level < 2); // Expand first 2 levels
  const hasChildren = node.children.length > 0;

  const priorityColor = PRIORITY_COLORS[node.task.priority] || PRIORITY_COLORS[0];
  const isCompleted = node.task.status === "completed";
  
  // Calculate specific delay status for the mockup example
  const isDelayed = node.task.due_date ? isPast(parseISO(node.task.due_date)) : false;
  const isFavorite = node.task.priority === 3 || node.task.title.includes('Freebox');

  return (
    <div className="border-b border-border/30 last:border-none">
      <div
        className={`flex items-start gap-3 py-3 px-4 hover:bg-muted/50 group cursor-pointer transition-colors ${
          isCompleted ? "opacity-60" : ""
        }`}
        style={{ paddingLeft: `${16 + level * 24}px` }}
        onClick={() => onTaskSelect?.(node.task)}
      >
        {/* Google style Radio-Checkbox */}
        <div className="pt-0.5 flex-shrink-0">
             <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                 isCompleted ? "bg-primary border-primary" : "border-muted-foreground hover:bg-muted/50"
             }`}>
                {isCompleted && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="white"/>
                    </svg>
                )}
             </div>
        </div>

        {/* Task Details */}
        <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-start justify-between gap-4">
                <span className={`text-[15px] leading-tight text-foreground ${
                    isCompleted ? "line-through text-muted-foreground" : ""
                }`}>
                    {node.task.title}
                </span>

                <Star className={`h-5 w-5 flex-shrink-0 ${isFavorite ? "fill-primary text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`} />
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Due date oval badge (Red if delayed) */}
                {node.task.due_date && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium leading-none ${
                        isDelayed 
                           ? "border-destructive/30 text-destructive bg-transparent" 
                           : "border-border text-foreground/80"
                    }`}>
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>{format(parseISO(node.task.due_date), "dd MMM yyyy")}</span>
                    </div>
                )}
            </div>

            {/* Action buttons (shown on hover) */}
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                {level < 3 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); onAddChild?.(node.task.id); }}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Sous-tâche
                    </Button>
                )}
                {/* Feature 21: Quick compose email from task */}
                <div onClick={(e) => e.stopPropagation()}>
                  <QuickComposeButton
                    task={{ id: node.task.id, title: node.task.title }}
                    className="h-6 px-2 text-xs"
                  />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(node.task.id); }}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            {/* Feature 3: Show linked emails for this task */}
            <div onClick={(e) => e.stopPropagation()} className="mt-2">
              <LinkedEntitiesPanel entityType="task" entityId={node.task.id} className="text-xs" />
            </div>

            {/* Subtasks expander (Google Tasks style) */}
            {hasChildren && (
                 <div 
                    className="flex items-center gap-2 mt-2 text-muted-foreground hover:text-foreground text-[13px] w-fit"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                 >
                     <div className="p-1 rounded-full hover:bg-muted/50 -ml-1">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                     </div>
                     <span>{node.children.length} sous-tâches</span>
                 </div>
            )}
        </div>
      </div>

      {/* Children Container */}
      {expanded && hasChildren && (
        <div className="bg-muted/30">
          {node.children.map((child) => (
            <TaskItem
              key={child.task.id}
              node={child}
              level={level + 1}
              onTaskSelect={onTaskSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskTree({
  projectId,
  onTaskSelect,
  onAddChild,
}: TaskTreeProps) {
  const { tasks, deleteTask, isLoading } = useEntityStore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // Features 10, 13, 18, 28 — task notifications & activity logging
  const { onTaskCompleted, onStatusChanged } = useTaskNotifications();

  // Filter tasks for this project
  const projectTasks = React.useMemo(() => {
    return tasks.filter((t) => t.project_id === projectId);
  }, [tasks, projectId]);

  // Build tree from flat list
  const tree = React.useMemo(() => {
    const buildNode = (taskList: Task[], parentId: string | null = null): TaskNode[] => {
      return taskList
        .filter((t) => (parentId ? t.parent_id === parentId : !t.parent_id))
        .map((t) => ({
          task: t,
          children: buildNode(taskList, t.id),
        }));
    };
    return buildNode(projectTasks);
  }, [projectTasks]);

  const handleDelete = (taskId: string) => {
    setDeleteTarget(taskId);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteTask(id);
    } catch {
      // ignore
    }
  };

  if (isLoading && projectTasks.length === 0) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Chargement des tâches...</div>;
  }

  if (projectTasks.length === 0) {
    return <div className="text-center text-muted-foreground py-8 text-sm">Aucune tâche dans ce projet.</div>;
  }

  return (
    <>
      <div className="flex flex-col">
        {tree.map((node) => (
          <TaskItem
            key={node.task.id}
            node={node}
            level={0}
            onTaskSelect={onTaskSelect}
            onAddChild={onAddChild}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La tâche et ses sous-tâches seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
