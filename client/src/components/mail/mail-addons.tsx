import React from "react"
import { Calendar as CalendarIcon, Lightbulb, CheckCircle2, Users, Plus } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function MailAddons() {
    return (
        <div className="w-14 shrink-0 bg-transparent flex flex-col items-center py-3 px-1 gap-1 z-10 mb-3">
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="w-10 h-10 rounded-full hover:bg-muted cursor-pointer flex items-center justify-center transition-colors">
                        <CalendarIcon className="w-5 h-5 text-primary" />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="rounded-lg px-3 py-1.5">
                    Agenda
                </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="w-10 h-10 rounded-full hover:bg-muted cursor-pointer flex items-center justify-center transition-colors">
                        <Lightbulb className="w-5 h-5 text-amber-400" />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="rounded-lg px-3 py-1.5">
                    Notes
                </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="w-10 h-10 rounded-full hover:bg-muted cursor-pointer flex items-center justify-center transition-colors">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="rounded-lg px-3 py-1.5">
                    Tâches
                </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="w-10 h-10 rounded-full hover:bg-muted cursor-pointer flex items-center justify-center transition-colors">
                        <Users className="w-5 h-5 text-primary" />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="rounded-lg px-3 py-1.5">
                    Contacts
                </TooltipContent>
            </Tooltip>

            <div className="w-6 h-px bg-border my-3"></div>

            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <div className="w-10 h-10 rounded-full hover:bg-muted cursor-pointer flex items-center justify-center transition-colors">
                        <Plus className="w-5 h-5 text-muted-foreground" />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="rounded-lg px-3 py-1.5">
                    Télécharger des modules complémentaires
                </TooltipContent>
            </Tooltip>
        </div>
    )
}
