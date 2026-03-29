"use client"

import { Search, SlidersHorizontal, HelpCircle, Settings, Grid } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { UnifiedNotificationCenter } from "@/components/interop/UnifiedNotificationCenter"

export function WorkspaceHeader() {
    return (
        <header className="h-16 shrink-0 flex items-center justify-between px-4">
            {/* Left: Logo */}
            <div className="flex items-center gap-2 w-[200px] shrink-0 pl-0">
                <div className="flex items-center gap-2 px-2 select-none cursor-pointer">
                    <div className="w-8 h-8 rounded shrink-0 bg-background flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 6H20C21.1 6 22 6.9 22 8V16C22 17.1 21.1 18 20 18H4C2.9 18 2 17.1 2 16V8C2 6.9 2.9 6 4 6Z" fill="#EA4335"/>
                            <path d="M4 8L12 13L20 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M4 8V16L12 11" fill="#C5221F"/>
                            <path d="M20 8V16L12 11" fill="#F4B400"/>
                        </svg>
                    </div>
                    <span className="text-[22px] font-normal text-[#444746] dark:text-[#e3e3e3] tracking-tight">Gmail</span>
                </div>
            </div>

            {/* Central Search Bar */}
            <div className="flex-1 max-w-[720px] mx-6 relative hidden md:block group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200/60 dark:hover:bg-gray-700/50 rounded-full cursor-pointer transition-colors">
                    <Search className="h-5 w-5 text-[#5f6368] dark:text-gray-400 group-focus-within:text-[#1a73e8]" />
                </div>
                <Input
                    placeholder="Rechercher dans les messages"
                    className="w-full pl-14 pr-14 h-12 bg-[#eaf1fb] dark:bg-[#1f1f1f] border-transparent hover:bg-background hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] focus-visible:bg-background focus-visible:ring-0 focus-visible:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] transition-all duration-200 rounded-full text-base dark:hover:bg-[#28292a] dark:focus-visible:bg-[#28292a] text-[#1f1f1f] dark:text-[#e3e3e3] placeholder:text-[#5f6368] dark:placeholder:text-gray-400"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200/60 dark:hover:bg-gray-700/50 rounded-full cursor-pointer transition-colors">
                    <SlidersHorizontal className="h-5 w-5 text-[#5f6368] dark:text-gray-400" />
                </div>
            </div>

            {/* Right action area */}
            <div className="flex items-center gap-1 shrink-0">
                {/* Active Status */}
                <Button
                    variant="outline"
                    size="sm"
                    className="hidden lg:flex h-9 rounded-full border-border dark:border-gray-700 text-[#444746] dark:text-[#e3e3e3] font-medium px-4 hover:bg-muted dark:hover:bg-gray-800 mr-2 gap-2"
                >
                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                    Actif
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1 opacity-60">
                        <path d="M5 6L0 1.05562L1.07143 0L5 3.88876L8.92857 0L10 1.05562L5 6Z" fill="currentColor"/>
                    </svg>
                </Button>

                {/* Feature 20: Unified notification center */}
                <UnifiedNotificationCenter className="h-10 w-10 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-muted dark:hover:bg-gray-800" />

                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-muted dark:hover:bg-gray-800">
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="rounded-lg px-3 py-1.5">
                        Aide
                    </TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-muted dark:hover:bg-gray-800">
                            <Settings className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="rounded-lg px-3 py-1.5">
                        Paramètres
                    </TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#444746] dark:text-[#e3e3e3] hover:bg-muted dark:hover:bg-gray-800">
                            <Grid className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="rounded-lg px-3 py-1.5">
                        Applications Google
                    </TooltipContent>
                </Tooltip>

                <div className="mx-2 flex items-center justify-center">
                    <Avatar className="h-8 w-8 hover:ring-4 ring-gray-200 cursor-pointer transition-all">
                        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" />
                        <AvatarFallback className="bg-[#1a73e8] text-white">AD</AvatarFallback>
                    </Avatar>
                </div>
            </div>
        </header>
    )
}
