"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, CalendarIcon, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  0: "text-gray-500",    // Low
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
    <div className="border-b border-[#f1f3f4] last:border-none">
      <div
        className={`flex items-start gap-3 py-3 px-4 hover:bg-[#f8f9fa] group cursor-pointer transition-colors ${
          isCompleted ? "opacity-60" : ""
        }`}
        style={{ paddingLeft: `${16 + level * 24}px` }}
        onClick={() => onTaskSelect?.(node.task)}
      >
        {/* Google style Radio-Checkbox */}
        <div className="pt-0.5 flex-shrink-0">
             <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                 isCompleted ? "bg-[#1a73e8] border-[#1a73e8]" : "border-[#5f6368] hover:bg-black/5"
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
                <span className={`text-[15px] leading-tight text-[#202124] ${
                    isCompleted ? "line-through text-[#70757a]" : ""
                }`}>
                    {node.task.title}
                </span>

                <Star className={`h-5 w-5 flex-shrink-0 ${isFavorite ? "fill-[#1a73e8] text-[#1a73e8]" : "text-[#5f6368] opacity-0 group-hover:opacity-100"}`} />
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* Due date oval badge (Red if delayed) */}
                {node.task.due_date && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium leading-none ${
                        isDelayed 
                           ? "border-[#fce8e6] text-[#c5221f] bg-transparent" 
                           : "border-[#dadce0] text-[#3c4043]"
                    }`}>
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>{format(parseISO(node.task.due_date), "dd MMM yyyy")}</span>
                    </div>
                )}
            </div>

            {/* Action buttons (shown on hover) */}
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {level < 3 && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs text-[#5f6368] hover:text-[#1a73e8]" 
                        onClick={(e) => { e.stopPropagation(); onAddChild?.(node.task.id); }}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Sous-tâche
                    </Button>
                )}
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-[#5f6368] hover:text-[#d93025] hover:bg-[#fce8e6]" 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(node.task.id); }}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Subtasks expander (Google Tasks style) */}
            {hasChildren && (
                 <div 
                    className="flex items-center gap-2 mt-2 text-[#5f6368] hover:text-[#202124] text-[13px] w-fit"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                 >
                     <div className="p-1 rounded-full hover:bg-black/5 -ml-1">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                     </div>
                     <span>{node.children.length} sous-tâches</span>
                 </div>
            )}
        </div>
      </div>

      {/* Children Container */}
      {expanded && hasChildren && (
        <div className="bg-[#f8f9fa]/50">
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
    return <div className="text-center text-[#5f6368] py-8 text-sm">Chargement des tâches...</div>;
  }

  if (projectTasks.length === 0) {
    return <div className="text-center text-[#5f6368] py-8 text-sm">Aucune tâche dans ce projet.</div>;
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
