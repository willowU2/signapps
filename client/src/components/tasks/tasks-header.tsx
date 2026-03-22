import React from "react"
import { ExternalLink, X, Download, Upload, MoreVertical, Plus, List, KanbanSquare } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export interface TasksHeaderProps {
    projects: any[]
    selectedProjectId: string | null
    onSelectProject: (id: string) => void
    onExportTasks: () => void
    onImportTasks: () => void
    onAddTask: () => void
    viewMode: 'list' | 'board'
    onViewModeChange: (mode: 'list' | 'board') => void
}

export function TasksHeader({
    projects,
    selectedProjectId,
    onSelectProject,
    onExportTasks,
    onImportTasks,
    onAddTask,
    viewMode,
    onViewModeChange
}: TasksHeaderProps) {
    return (
        <>
            <div className="flex flex-col px-4 pt-6 pb-2 shrink-0 bg-background z-10 sticky top-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-bold text-[#5f6368] tracking-widest uppercase">
                        TASKS
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368] hover:bg-black/5 rounded-full">
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368] hover:bg-black/5 rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="flex items-center gap-2 cursor-pointer group rounded-md p-1 -ml-1 hover:bg-black/5">
                                <span className="text-[22px] text-[#202124] font-medium tracking-tight">
                                    Urgent
                                </span>
                                <svg width="24" height="24" viewBox="0 0 24 24" focusable="false" className="text-[#5f6368] fill-current">
                                    <path d="M7 10l5 5 5-5H7z"></path>
                                </svg>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 rounded-xl">
                            {projects.map(proj => (
                                <DropdownMenuItem 
                                    key={proj.id} 
                                    onClick={() => onSelectProject(proj.id)}
                                    className={selectedProjectId === proj.id ? "bg-blue-50 text-blue-700 font-medium" : ""}
                                >
                                    {proj.name}
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onExportTasks}>
                                <Download className="mr-2 h-4 w-4" />
                                <span>Export Tasks</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onImportTasks}>
                                <Upload className="mr-2 h-4 w-4" />
                                <span>Import Tasks</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex items-center gap-2">
                        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'list' | 'board')}>
                            <TabsList className="h-8 py-0 px-1">
                                <TabsTrigger value="list" className="h-6 px-2 text-xs">
                                    <List className="h-3.5 w-3.5 mr-1" /> List
                                </TabsTrigger>
                                <TabsTrigger value="board" className="h-6 px-2 text-xs">
                                    <KanbanSquare className="h-3.5 w-3.5 mr-1" /> Board
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368] hover:bg-black/5 rounded-full">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Paramètres</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                </div>
            </div>

            <div className="px-4 py-2 border-b">
                <div 
                    className="flex items-center gap-3 cursor-pointer group h-12"
                    onClick={onAddTask}
                >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-[#1a73e8] bg-transparent group-hover:bg-[#f6f8fb]">
                        <Plus className="h-6 w-6" />
                    </div>
                    <span className="text-[#1a73e8] font-medium text-[15px]">Ajouter une tâche</span>
                    <div className="flex-1"></div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368] hover:bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </>
    )
}
