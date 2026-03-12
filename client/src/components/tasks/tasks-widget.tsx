"use client";

import { useState, useRef } from "react";
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
import { Plus, Calendar as CalendarIcon, ListTodo, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskItem } from "./task-item";
import { format, parseISO } from "date-fns";
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
    const [dueDate, setDueDate] = useState<string>("");
    const dateInputRef = useRef<HTMLInputElement>(null);

    const selectedList = lists.find(l => l.id === selectedListId) || lists[0];
    const filteredTasks = selectedListId
        ? tasks.filter(t => t.listId === selectedListId)
        : tasks;

    const pendingTasks = filteredTasks.filter(t => !t.done);
    const completedTasks = filteredTasks.filter(t => t.done);

    const handleAddTask = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newTask.trim()) return;
        const dateToSave = dueDate ? new Date(dueDate).toISOString() : undefined;
        addTask(newTask.trim(), dateToSave);
        setNewTask("");
        setDueDate("");
    };

    const handleDateClick = () => {
        dateInputRef.current?.showPicker();
    };

    const formattedDate = dueDate ? format(parseISO(dueDate), "d MMM", { locale: fr }) : null;

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background">
            {/* Google Tasks Style Header - Clean white design */}
            <div className="px-4 pt-5 pb-3 border-b border-[#f1f3f4]">
                {/* TASKS label */}
                <div className="text-[11px] font-semibold text-[#5f6368] tracking-widest uppercase mb-2">
                    TASKS
                </div>

                {/* List Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 text-[22px] font-normal text-[#202124] hover:bg-[#f1f3f4] rounded-md px-2 py-1 -ml-2 transition-colors">
                            {selectedList?.name || "My Tasks"}
                            <svg width="20" height="20" viewBox="0 0 24 24" className="text-[#5f6368] fill-current ml-1">
                                <path d="M7 10l5 5 5-5H7z"></path>
                            </svg>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 rounded-xl shadow-lg border-[#dadce0]">
                        {lists.map((list) => (
                            <DropdownMenuItem
                                key={list.id}
                                onClick={() => setSelectedList(list.id)}
                                className="flex items-center justify-between rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-3 h-3 rounded-sm"
                                        style={{ backgroundColor: list.color || '#4285f4' }}
                                    />
                                    <span className="text-[14px] text-[#202124]">{list.name}</span>
                                </div>
                                {selectedListId === list.id && (
                                    <Check className="w-4 h-4 text-[#1a73e8]" />
                                )}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => setSelectedList(null)}
                            className="text-[#5f6368] rounded-lg"
                        >
                            Voir toutes les tâches
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <p className="text-[13px] text-[#5f6368] mt-1.5">
                    {pendingTasks.length === 0
                        ? "Aucune tâche en attente"
                        : `${pendingTasks.length} tâche${pendingTasks.length > 1 ? 's' : ''} en attente`}
                </p>
            </div>

            {/* Tasks List - Google Tasks clean white style */}
            <ScrollArea className="flex-1 bg-background">
                <div className="py-1">
                    {filteredTasks.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <div className="w-16 h-16 rounded-full bg-[#f1f3f4] mx-auto mb-4 flex items-center justify-center">
                                <ListTodo className="w-8 h-8 text-[#9aa0a6]" />
                            </div>
                            <p className="text-[14px] text-[#5f6368] font-medium">
                                Aucune tâche pour le moment
                            </p>
                            <p className="text-[13px] text-[#9aa0a6] mt-1">
                                Ajoutez une tâche ci-dessous
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Pending Tasks */}
                            {pendingTasks.length > 0 && (
                                <div>
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
                                <div className="mt-2 border-t border-[#f1f3f4]">
                                    <div className="px-4 py-3">
                                        <span className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-wider">
                                            Terminées ({completedTasks.length})
                                        </span>
                                    </div>
                                    <div className="opacity-70">
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
            <div className="p-4 border-t border-[#f1f3f4] bg-background">
                <form onSubmit={handleAddTask} className="space-y-3">
                    <div className="flex items-center gap-3">
                        {/* Plus icon like Google Tasks */}
                        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-[#80868b] flex items-center justify-center shrink-0">
                            <Plus className="w-3 h-3 text-[#80868b]" />
                        </div>
                        <Input
                            placeholder="Ajouter une tâche"
                            value={newTask}
                            onChange={(e) => setNewTask(e.target.value)}
                            className="border-0 border-b border-[#e8eaed] rounded-none px-0 h-9 text-[14px] text-[#202124] placeholder:text-[#80868b] focus-visible:ring-0 focus-visible:border-[#1a73e8] transition-colors"
                        />
                    </div>

                    {/* Date Picker Row - Google Tasks chip style */}
                    <div className="flex items-center gap-2 pl-7">
                        {/* Hidden native date input */}
                        <input
                            ref={dateInputRef}
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="sr-only"
                        />

                        {/* Date chip button */}
                        <button
                            type="button"
                            onClick={handleDateClick}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-colors",
                                formattedDate
                                    ? "bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc] hover:bg-[#d2e3fc]"
                                    : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed] border border-transparent"
                            )}
                        >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {formattedDate || "Date"}
                        </button>

                        {formattedDate && (
                            <button
                                type="button"
                                onClick={() => setDueDate("")}
                                className="text-[12px] text-[#5f6368] hover:text-[#202124] transition-colors"
                            >
                                Effacer
                            </button>
                        )}

                        {/* Submit button when task has content */}
                        {newTask.trim() && (
                            <Button
                                type="submit"
                                size="sm"
                                className="ml-auto bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full h-8 px-4 text-[13px] font-medium shadow-sm"
                            >
                                Enregistrer
                            </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
