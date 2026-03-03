"use client"

import { Menu, Mail, MessageSquare, Users, Video } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface WorkspaceRailProps {
    activeApp?: "mail" | "chat" | "spaces" | "meet"
    onMenuClick?: () => void
}

const apps = [
    { id: "mail" as const, icon: Mail, label: "Mail", color: "text-red-500" },
    { id: "chat" as const, icon: MessageSquare, label: "Chat", color: "text-green-600" },
    { id: "spaces" as const, icon: Users, label: "Spaces", color: "text-purple-600" },
    { id: "meet" as const, icon: Video, label: "Meet", color: "text-blue-600" },
]

export function WorkspaceRail({ activeApp = "mail", onMenuClick }: WorkspaceRailProps) {
    return (
        <div className="w-[68px] shrink-0 flex flex-col items-center py-2 gap-0.5">
            {/* Hamburger Menu */}
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <button
                        onClick={onMenuClick}
                        className="h-12 w-12 rounded-full flex items-center justify-center text-[#5f6368] dark:text-[#e3e3e3] hover:bg-[#e8eaed] dark:hover:bg-gray-800 transition-colors mb-3"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="rounded-lg px-3 py-1.5">
                    Menu principal
                </TooltipContent>
            </Tooltip>

            {/* App Icons */}
            {apps.map((app) => (
                <Tooltip key={app.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                        <button
                            className={cn(
                                "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-200",
                                activeApp === app.id
                                    ? "bg-[#d3e3fd] dark:bg-[#004a77]"
                                    : "hover:bg-[#e8eaed] dark:hover:bg-gray-800"
                            )}
                        >
                            <app.icon
                                className={cn(
                                    "h-5 w-5",
                                    activeApp === app.id
                                        ? app.color
                                        : "text-[#5f6368] dark:text-[#e3e3e3]"
                                )}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="rounded-lg px-3 py-1.5">
                        {app.label}
                    </TooltipContent>
                </Tooltip>
            ))}
        </div>
    )
}
