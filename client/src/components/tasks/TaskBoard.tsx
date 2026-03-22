import React, { useMemo, useState } from 'react';
import { useTasks, useUpdateTask } from '@/lib/scheduling/api/tasks';
import { TaskStatus } from '@/lib/scheduling/types/scheduling';
import { Loader2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskSheet } from './TaskSheet';
import type { Task } from '@/lib/scheduling/types/scheduling';

export interface TaskBoardProps {
  projectId: string;
}

export function TaskBoard({ projectId }: TaskBoardProps) {
  const { data: tasks = [], isLoading } = useTasks();
  const updateTask = useUpdateTask();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columns: { id: TaskStatus; title: string }[] = useMemo(() => [
    { id: 'backlog', title: 'Backlog' },
    { id: 'today', title: 'Aujourd\'hui' },
    { id: 'in-progress', title: 'En cours' },
    { id: 'done', title: 'Terminé' },
  ], []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground text-sm">Chargement du Kanban...</span>
      </div>
    );
  }

  // TODO: Add strict projectId filtering if the API eventually pushes tasks per project
  // Right now, the tasks API is universal MVP, but we can filter by some project criteria later.
  const boardTasks = tasks;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    const activeTask = boardTasks.find((t) => t.id === activeTaskId);
    if (!activeTask) return;

    // Has it been dropped over a column?
    const overColumn = columns.find((c) => c.id === overId);
    if (overColumn) {
      if (activeTask.status !== overColumn.id) {
        updateTask.mutate({ id: activeTaskId, updates: { status: overColumn.id } });
      }
      return;
    }

    // Has it been dropped over another task?
    const overTask = boardTasks.find((t) => t.id === overId);
    if (overTask && overTask.status !== activeTask.status) {
      updateTask.mutate({ id: activeTaskId, updates: { status: overTask.status } });
    }
  };

  const activeTask = useMemo(
    () => boardTasks.find((t) => t.id === activeId),
    [activeId, boardTasks]
  );

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsSheetOpen(true);
  };

  return (
    <div className="flex h-full w-full gap-4 overflow-x-auto p-4 bg-black/[0.02]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {columns.map((col) => {
          const columnTasks = boardTasks.filter(t => t.status === col.id);
          return (
            <TaskColumn 
              key={col.id} 
              column={col} 
              tasks={columnTasks} 
              onTaskClick={handleTaskClick}
            />
          );
        })}
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
      
      <TaskSheet
        task={selectedTask}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </div>
  );
}
