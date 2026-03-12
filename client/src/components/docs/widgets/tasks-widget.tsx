"use client";

import { useState } from "react";
import { Plus, Check, MoreVertical } from "lucide-react";

interface Task {
    id: string;
    title: string;
    completed: boolean;
}

export function TasksWidget() {
    const [tasks, setTasks] = useState<Task[]>([
        { id: '1', title: 'Review main layout document', completed: false },
        { id: '2', title: 'Email marketing about launch', completed: false },
        { id: '3', title: 'Prepare slide deck numbers', completed: true },
    ]);
    const [newTaskTitle, setNewTaskTitle] = useState("");

    const toggleTask = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        setTasks([{ id: Date.now().toString(), title: newTaskTitle, completed: false }, ...tasks]);
        setNewTaskTitle("");
    };

    const completedCount = tasks.filter(t => t.completed).length;

    return (
        <div className="p-4 flex flex-col gap-4 h-full animate-fade-in-up">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Tasks</h3>
                    <p className="text-xs text-gray-500">{completedCount} of {tasks.length} completed</p>
                </div>

                {/* Progress Circle Ring */}
                <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-gray-100 dark:text-gray-800" />
                        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent"
                            strokeDasharray={100}
                            strokeDashoffset={100 - (completedCount / Math.max(1, tasks.length) * 100)}
                            className="text-green-500 transition-all duration-500 ease-out"
                        />
                    </svg>
                </div>
            </div>

            <form onSubmit={addTask} className="relative">
                <input
                    type="text"
                    placeholder="Add a new task..."
                    className="w-full bg-background dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" disabled={!newTaskTitle.trim()}>
                    <Plus className="w-4 h-4" />
                </button>
            </form>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-10 mt-2">
                {tasks.map(task => (
                    <div
                        key={task.id}
                        className={`group flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${task.completed
                            ? 'bg-gray-50/50 dark:bg-gray-900/20 border-transparent'
                            : 'bg-background dark:bg-gray-800 border-gray-100 dark:border-gray-700/50 hover:border-indigo-200'
                            }`}
                        onClick={() => toggleTask(task.id)}
                    >
                        <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${task.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600 group-hover:border-indigo-400'
                            }`}>
                            {task.completed && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className={`text-sm flex-1 leading-snug transition-all ${task.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'
                            }`}>
                            {task.title}
                        </span>
                        <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
