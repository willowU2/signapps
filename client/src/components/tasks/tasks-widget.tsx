"use client";

import { useState } from "react";
import { useQuickTasksStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TasksWidget() {
    const { tasks, addTask, toggleTask, removeTask } = useQuickTasksStore();
    const [newTask, setNewTask] = useState("");

    const handleAddTask = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newTask.trim()) return;
        addTask(newTask.trim());
        setNewTask("");
    };

    const pendingCount = tasks.filter(t => !t.done).length;

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] pb-4">
            <div className="p-4 pb-2 shrink-0">
                <h3 className="text-lg font-semibold tracking-tight">Today's Tasks</h3>
                <p className="text-sm text-muted-foreground">
                    {pendingCount === 0 ? "All caught up! 🎉" : `${pendingCount} tasks remaining`}
                </p>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-1 pb-8">
                    {tasks.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            No tasks for today. Add one below!
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <div
                                key={task.id}
                                className="group flex items-start gap-3 py-3 px-2 rounded-md hover:bg-muted/50 transition-colors"
                                onClick={() => toggleTask(task.id)}
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
                                        removeTask(task.id);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            <div className="p-4 pt-0 mt-auto shrink-0 bg-background">
                <form onSubmit={handleAddTask} className="flex items-center gap-2">
                    <Input
                        placeholder="Add a new task..."
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!newTask.trim()}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
