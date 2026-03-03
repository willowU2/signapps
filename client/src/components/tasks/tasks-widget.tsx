"use client";

import { useState } from "react";
import { useQuickTasksStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, ChevronDown, Calendar as CalendarIcon, ListTodo, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskItem } from "./task-item";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function TasksWidget() {
    const {
        tasks,
        lists,
        selectedListId,
        addTask,
        toggleTask,
        removeTask,
        setSelectedList,
    } = useQuickTasksStore();

    const [newTask, setNewTask] = useState("");
    const [dueDate, setDueDate] = useState<Date | undefined>();
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const selectedList = lists.find(l => l.id === selectedListId) || lists[0];
    const filteredTasks = selectedListId
        ? tasks.filter(t => t.listId === selectedListId)
        : tasks;

    const pendingTasks = filteredTasks.filter(t => !t.done);
    const completedTasks = filteredTasks.filter(t => t.done);

    const handleAddTask = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newTask.trim()) return;
        addTask(newTask.trim(), dueDate?.toISOString());
        setNewTask("");
        setDueDate(undefined);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-white">
            {/* Google Tasks Style Header */}
            <div className="px-4 py-3 border-b border-gray-100">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:bg-gray-50 rounded-lg px-2 py-1 -ml-2 transition-colors">
                            <ListTodo className="w-5 h-5 text-blue-500" />
                            {selectedList?.name || "TASKS"}
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        {lists.map((list) => (
                            <DropdownMenuItem
                                key={list.id}
                                onClick={() => setSelectedList(list.id)}
                                className="flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: list.color || '#4285f4' }}
                                    />
                                    {list.name}
                                </div>
                                {selectedListId === list.id && (
                                    <Check className="w-4 h-4 text-blue-500" />
                                )}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => setSelectedList(null)}
                            className="text-gray-500"
                        >
                            Voir toutes les tâches
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <p className="text-sm text-gray-500 mt-1 pl-1">
                    {pendingTasks.length === 0
                        ? "Aucune tâche en attente"
                        : `${pendingTasks.length} tâche${pendingTasks.length > 1 ? 's' : ''} en attente`}
                </p>
            </div>

            {/* Tasks List */}
            <ScrollArea className="flex-1">
                <div className="px-2 py-2">
                    {filteredTasks.length === 0 ? (
                        <div className="text-center py-12">
                            <ListTodo className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-sm text-gray-400">
                                Aucune tâche pour le moment
                            </p>
                            <p className="text-xs text-gray-300 mt-1">
                                Ajoutez une tâche ci-dessous
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Pending Tasks */}
                            {pendingTasks.length > 0 && (
                                <div className="space-y-0.5">
                                    {pendingTasks.map((task) => (
                                        <TaskItem
                                            key={task.id}
                                            task={task}
                                            onToggle={toggleTask}
                                            onRemove={removeTask}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Completed Tasks */}
                            {completedTasks.length > 0 && (
                                <div className="mt-4">
                                    <div className="px-3 py-2">
                                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                            Terminées ({completedTasks.length})
                                        </span>
                                    </div>
                                    <div className="space-y-0.5 opacity-60">
                                        {completedTasks.map((task) => (
                                            <TaskItem
                                                key={task.id}
                                                task={task}
                                                onToggle={toggleTask}
                                                onRemove={removeTask}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ScrollArea>

            {/* Add Task Form - Google Tasks Style */}
            <div className="p-3 border-t border-gray-100 bg-white">
                <form onSubmit={handleAddTask} className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <Input
                                placeholder="Ajouter une tâche..."
                                value={newTask}
                                onChange={(e) => setNewTask(e.target.value)}
                                className="pr-10 border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                            />
                        </div>
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!newTask.trim()}
                            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full h-9 w-9 shadow-sm"
                        >
                            <Plus className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Date Picker Row */}
                    <div className="flex items-center gap-2 pl-1">
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                                        dueDate
                                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    )}
                                >
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    {dueDate
                                        ? format(dueDate, "d MMM", { locale: fr })
                                        : "Ajouter une date"}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={dueDate}
                                    onSelect={(date) => {
                                        setDueDate(date);
                                        setIsCalendarOpen(false);
                                    }}
                                    locale={fr}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        {dueDate && (
                            <button
                                type="button"
                                onClick={() => setDueDate(undefined)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                            >
                                Effacer
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
