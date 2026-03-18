'use client';

/**
 * TaskKanban Component
 *
 * Full Kanban board for task management.
 * Supports drag and drop between columns.
 */

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, Search, Filter, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskColumn, columnConfig } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskSheet } from './TaskSheet';
import type { Task, TaskStatus, Priority } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface TaskKanbanProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskCreate: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onTaskDelete: (taskId: string) => void;
  isLoading?: boolean;
}

// ============================================================================
// Filter Types
// ============================================================================

interface TaskFilters {
  search: string;
  priorities: Priority[];
  showCompleted: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskKanban({
  tasks,
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  isLoading,
}: TaskKanbanProps) {
  // State
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [localTasks, setLocalTasks] = React.useState<Task[]>(tasks);
  const [filters, setFilters] = React.useState<TaskFilters>({
    search: '',
    priorities: [],
    showCompleted: true,
  });
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = React.useState<TaskStatus | null>(null);

  // Sync local tasks with props
  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    return localTasks.filter((task) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower) ||
          task.tags?.some((t) => t.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Priority filter
      if (filters.priorities.length > 0) {
        if (!task.priority || !filters.priorities.includes(task.priority)) {
          return false;
        }
      }

      // Completed filter
      if (!filters.showCompleted && task.status === 'done') {
        return false;
      }

      return true;
    });
  }, [localTasks, filters]);

  // Group tasks by status
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      today: [],
      'in-progress': [],
      done: [],
    };

    filteredTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [filteredTasks]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = localTasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = localTasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if we're over a column
    const overData = over.data.current;
    if (overData?.type === 'column') {
      const newStatus = overData.status as TaskStatus;
      if (activeTask.status !== newStatus) {
        setLocalTasks((prev) =>
          prev.map((t) =>
            t.id === activeId ? { ...t, status: newStatus } : t
          )
        );
      }
      return;
    }

    // Check if we're over another task
    const overTask = localTasks.find((t) => t.id === overId);
    if (overTask && activeTask.status !== overTask.status) {
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: overTask.status } : t
        )
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = localTasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Get final status
    const overData = over.data.current;
    let finalStatus = activeTask.status;

    if (overData?.type === 'column') {
      finalStatus = overData.status as TaskStatus;
    } else {
      const overTask = localTasks.find((t) => t.id === overId);
      if (overTask) {
        finalStatus = overTask.status;
      }
    }

    // Reorder within column if same status
    if (activeId !== overId) {
      const tasksInColumn = localTasks.filter((t) => t.status === finalStatus);
      const oldIndex = tasksInColumn.findIndex((t) => t.id === activeId);
      const newIndex = tasksInColumn.findIndex((t) => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(tasksInColumn, oldIndex, newIndex);
        setLocalTasks((prev) => {
          const others = prev.filter((t) => t.status !== finalStatus);
          return [...others, ...reordered];
        });
      }
    }

    // Persist the status change
    const originalTask = tasks.find((t) => t.id === activeId);
    if (originalTask && originalTask.status !== finalStatus) {
      onTaskUpdate(activeId, { status: finalStatus });
    }
  };

  // Task actions
  const handleTaskClick = (task: Task) => {
    setEditingTask(task);
    setNewTaskStatus(null);
    setIsSheetOpen(true);
  };

  const handleTaskComplete = (taskId: string) => {
    const task = localTasks.find((t) => t.id === taskId);
    if (task) {
      const newStatus = task.status === 'done' ? 'today' : 'done';
      onTaskUpdate(taskId, {
        status: newStatus,
        completedAt: newStatus === 'done' ? new Date() : undefined,
      });
    }
  };

  const handleAddTask = (status: TaskStatus) => {
    setEditingTask(null);
    setNewTaskStatus(status);
    setIsSheetOpen(true);
  };

  const handleClearColumn = (status: TaskStatus) => {
    const tasksToDelete = localTasks.filter((t) => t.status === status);
    tasksToDelete.forEach((t) => onTaskDelete(t.id));
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    if (editingTask) {
      onTaskUpdate(editingTask.id, taskData);
    } else if (newTaskStatus) {
      onTaskCreate({
        type: 'task',
        title: taskData.title ?? 'Nouvelle tâche',
        status: newTaskStatus,
        allDay: false,
        start: new Date(),
        ...taskData,
      } as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>);
    }
    setIsSheetOpen(false);
    setEditingTask(null);
    setNewTaskStatus(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des tâches..."
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtres
              {(filters.priorities.length > 0 || !filters.showCompleted) && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {filters.priorities.length + (filters.showCompleted ? 0 : 1)}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Priorité</DropdownMenuLabel>
            {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={filters.priorities.includes(p)}
                onCheckedChange={(checked) => {
                  setFilters((prev) => ({
                    ...prev,
                    priorities: checked
                      ? [...prev.priorities, p]
                      : prev.priorities.filter((x) => x !== p),
                  }));
                }}
              >
                {p === 'urgent' && 'Urgente'}
                {p === 'high' && 'Haute'}
                {p === 'medium' && 'Moyenne'}
                {p === 'low' && 'Basse'}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={filters.showCompleted}
              onCheckedChange={(checked) =>
                setFilters((prev) => ({ ...prev, showCompleted: checked }))
              }
            >
              Afficher terminées
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" onClick={() => handleAddTask('today')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle tâche
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {(Object.keys(columnConfig) as TaskStatus[]).map((status) => (
              <TaskColumn
                key={status}
                id={status}
                title={columnConfig[status].title}
                tasks={tasksByStatus[status]}
                onAddTask={handleAddTask}
                onTaskClick={handleTaskClick}
                onTaskComplete={handleTaskComplete}
                onTaskDelete={onTaskDelete}
                onTaskEdit={(task) => {
                  setEditingTask(task);
                  setIsSheetOpen(true);
                }}
                onClearColumn={handleClearColumn}
              />
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isOverlay />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Edit Sheet */}
      <TaskSheet
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setEditingTask(null);
          setNewTaskStatus(null);
        }}
        task={editingTask}
        defaultStatus={newTaskStatus}
        onSave={handleSaveTask}
        onDelete={editingTask ? () => onTaskDelete(editingTask.id) : undefined}
      />
    </div>
  );
}

export default TaskKanban;
