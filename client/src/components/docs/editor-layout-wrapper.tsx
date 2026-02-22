"use client";

import { useState } from "react";
import { EditorRightSidebar } from "./editor-right-sidebar";
import { PanelRight } from "lucide-react";
import { useSimulatedMultiplayer } from "@/hooks/use-simulated-multiplayer"

interface EditorLayoutWrapperProps {
    documentId: string;
    children: React.ReactNode;
}

export function EditorLayoutWrapper({ documentId, children }: EditorLayoutWrapperProps) {
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

    // Fetch simulated collaborators for the header
    const { collaborators } = useSimulatedMultiplayer(documentId, true);

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50/50 dark:bg-[#0a0a0a]">
            {/* Minimal Header */}
            <div className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-800/60 px-6 py-3 flex items-center justify-between z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800/50">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <input
                            type="text"
                            defaultValue={`Document ${documentId}`}
                            className="text-lg font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 rounded px-1 -ml-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full max-w-[300px]"
                        />
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 font-medium">
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Saved to cloud</span>
                        </div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">

                    {/* Collaborator Avatars */}
                    <div className="flex items-center mr-4 -space-x-2">
                        {collaborators.map((user) => (
                            <div
                                key={user.id}
                                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-sm text-white shadow-sm transition-transform hover:-translate-y-1 hover:z-10 cursor-pointer"
                                style={{ backgroundColor: user.color }}
                                title={user.name}
                            >
                                {user.name.charAt(0)}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                        className={`p-2 rounded-lg transition-colors border ${isRightSidebarOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200 shadow-sm'}`}
                        title="Toggle Multi-function Panel"
                    >
                        <PanelRight className="w-5 h-5" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-md ml-2 cursor-pointer transition-transform hover:-translate-y-1">
                        ME
                    </div>
                </div>
            </div>

            {/* Editor Area & Sidebar */}
            <div className="flex-1 overflow-hidden relative flex">
                <div className="flex-1 h-full overflow-hidden transition-all duration-300">
                    {children}
                </div>

                {/* Right Sidebar Component */}
                <EditorRightSidebar isOpen={isRightSidebarOpen} />
            </div>
        </div>
    );
}
