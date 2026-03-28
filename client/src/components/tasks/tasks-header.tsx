import React from "react"
import { Download, Upload, MoreVertical, Plus, List, KanbanSquare, LayoutGrid, CheckSquare, Settings } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface TasksHeaderProps {
    projects: any[]
    selectedProjectId: string | null
    onSelectProject: (id: string) => void
    onExportTasks: () => void
    onImportTasks: () => void
    onAddTask: () => void
    viewMode: 'list' | 'board' | 'custom-board'
    onViewModeChange: (mode: 'list' | 'board' | 'custom-board') => void
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
    const selectedProjectName = projects.find(p => p.id === selectedProjectId)?.name || "Sélectionnez un projet"

    return (
        <div className="flex flex-col shrink-0 bg-background/80 backdrop-blur-xl border-b z-10 sticky top-0 px-6 pt-5 pb-4 space-y-4">
            
            {/* Top Level: Title & Project Selector */}
            <div className="flex items-start justify-between">
                
                <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-500 shrink-0">
                           <CheckSquare className="h-4 w-4" />
                        </div>
                        <h1 className="text-xl font-semibold tracking-tight">Tâches</h1>
                    </div>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 group ml-[2px] mt-1 text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer">
                                <span className="text-sm font-medium line-clamp-1 max-w-[200px] text-left">
                                    {projects.length === 0 ? "Aucun projet" : selectedProjectName}
                                </span>
                                <svg width="16" height="16" viewBox="0 0 24 24" className="fill-current opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                                    <path d="M7 10l5 5 5-5H7z"></path>
                                </svg>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 rounded-xl shadow-lg border-muted z-50">
                            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest px-2 py-1.5">
                                Projets récents
                            </DropdownMenuLabel>
                            {projects.length > 0 ? projects.map(proj => (
                                <DropdownMenuItem 
                                    key={proj.id} 
                                    onClick={() => onSelectProject(proj.id)}
                                    className={cn("rounded-md my-0.5 cursor-pointer", selectedProjectId === proj.id && "bg-primary/10 text-primary font-medium")}
                                >
                                    <div className="truncate">{proj.name}</div>
                                </DropdownMenuItem>
                            )) : (
                               <div className="px-2 py-3 text-sm text-muted-foreground text-center">Aucun projet trouvé.</div>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Top Right Actions */}
                <div className="flex items-center gap-2">
                    
                    {/* ADD TASK FAB/TOP BUTTON: Prominent primary button */}
                    <Button onClick={onAddTask} className="shadow-sm hover:shadow-md rounded-full px-4 h-9 font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer hidden sm:flex">
                        <Plus className="mr-2 h-4 w-4" />
                        Nouvelle Tâche
                    </Button>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-dashed shadow-sm">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg z-50">
                            <DropdownMenuItem onClick={onExportTasks} className="cursor-pointer">
                                <Download className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span>Exporter</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onImportTasks} className="cursor-pointer">
                                <Upload className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span>Importer</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                               <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                               <span>Paramètres</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Mobile "Add Task" icon (shown on small screens only) */}
                    <Button onClick={onAddTask} size="icon" className="h-9 w-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white sm:hidden shadow-md cursor-pointer">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

            </div>

            {/* Tabs Row */}
            <div className="flex items-center justify-between w-full pt-1">
               <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'list' | 'board' | 'custom-board')} className="w-auto">
                    <TabsList className="h-9 p-1 bg-muted/40 rounded-lg">
                        <TabsTrigger value="list" className="rounded-md px-3 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <List className="h-3.5 w-3.5 mr-2 opacity-70" /> Liste
                        </TabsTrigger>
                        <TabsTrigger value="board" className="rounded-md px-3 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <KanbanSquare className="h-3.5 w-3.5 mr-2 opacity-70" /> Board
                        </TabsTrigger>
                        <TabsTrigger value="custom-board" className="rounded-md px-3 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <LayoutGrid className="h-3.5 w-3.5 mr-2 opacity-70" /> Custom
                        </TabsTrigger>
                    </TabsList>
               </Tabs>

               <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                   <Badge variant="outline" className="font-normal rounded-full border-muted-foreground/20 text-muted-foreground">
                       {projects.length} projet{projects.length > 1 ? 's' : ''}
                   </Badge>
               </div>
            </div>
            
        </div>
    )
}
