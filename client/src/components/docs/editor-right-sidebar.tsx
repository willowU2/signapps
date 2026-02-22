"use client";

import { useState } from "react";
import { Calendar, CheckSquare, Sparkles } from "lucide-react";
import { CalendarWidget } from "./widgets/calendar-widget";
import { TasksWidget } from "./widgets/tasks-widget";
import { AiChatWidget } from "./widgets/ai-chat-widget";

interface EditorRightSidebarProps {
    isOpen: boolean;
}

type TabType = 'calendar' | 'tasks' | 'ai';

export function EditorRightSidebar({ isOpen }: EditorRightSidebarProps) {
    const [activeTab, setActiveTab] = useState<TabType>('ai');

    return (
        <div
            className={`flex flex-col h-full bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border-l border-gray-200/50 dark:border-gray-800/50 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.1)] ${isOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-10 overflow-hidden border-0'
                }`}
        >
            {/* Tabs Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200/50 dark:border-gray-800/50 shrink-0">
                <div className="flex bg-gray-100/80 dark:bg-gray-800/80 rounded-lg p-1 w-full gap-1">
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'calendar' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="Calendar"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'tasks' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="Tasks"
                    >
                        <CheckSquare className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'ai' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        title="AI Assistant"
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative bg-gray-50/30 dark:bg-transparent">
                {activeTab === 'calendar' && <CalendarWidget />}
                {activeTab === 'tasks' && <TasksWidget />}
                {activeTab === 'ai' && <AiChatWidget />}
            </div>
        </div>
    );
}
