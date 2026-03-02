import React from "react"
import { ExternalLink, X, Download, Upload, MoreVertical, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export interface TasksHeaderProps {
    calendars: any[]
    selectedCalendarId: string | null
    onSelectCalendar: (id: string) => void
    onExportTasks: () => void
    onImportTasks: () => void
    onAddTask: () => void
}

export function TasksHeader({
    calendars,
    selectedCalendarId,
    onSelectCalendar,
    onExportTasks,
    onImportTasks,
    onAddTask
}: TasksHeaderProps) {
    return (
        <>
            <div className="flex flex-col px-4 pt-6 pb-2 shrink-0 bg-white z-10 sticky top-0">
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
                            {calendars.map(cal => (
                                <DropdownMenuItem 
                                    key={cal.id} 
                                    onClick={() => onSelectCalendar(cal.id)}
                                    className={selectedCalendarId === cal.id ? "bg-blue-50 text-blue-700 font-medium" : ""}
                                >
                                    {cal.name}
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
