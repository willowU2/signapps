"use client"

import Link from "next/link"
import { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavProps {
    isCollapsed: boolean
    links: {
        title: string
        label?: string
        icon: LucideIcon
        variant: "default" | "ghost"
        href: string
        onClick?: () => void
    }[]
}

export function MailNav({ isCollapsed, links }: NavProps) {
    return (
        <div
            data-collapsed={isCollapsed}
            className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
        >
            <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
                {links.map((link, index) =>
                    isCollapsed ? (
                        <Tooltip key={index} delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div
                                    onClick={link.onClick}
                                    className={cn(
                                        buttonVariants({ variant: link.variant, size: "icon" }),
                                        "h-10 w-10 cursor-pointer rounded-xl transition-all",
                                        link.variant === "default"
                                            ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 shadow-sm"
                                            : "hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                                    )}
                                >
                                    <link.icon className="h-4 w-4" />
                                    <span className="sr-only">{link.title}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="flex items-center gap-4">
                                {link.title}
                                {link.label && (
                                    <span className="ml-auto text-muted-foreground">
                                        {link.label}
                                    </span>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div
                            key={index}
                            onClick={link.onClick}
                            className={cn(
                                buttonVariants({ variant: link.variant, size: "sm" }),
                                "justify-start cursor-pointer transition-all rounded-xl h-9 px-3 font-medium",
                                link.variant === "default"
                                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 shadow-sm"
                                    : "hover:bg-gray-100 text-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
                            )}                    >
                            <link.icon className="mr-2 h-4 w-4" />
                            {link.title}
                            {link.label && (
                                <span
                                    className={cn(
                                        "ml-auto text-xs font-semibold px-2 py-0.5 rounded-md",
                                        link.variant === "default"
                                            ? "bg-blue-100/50 text-blue-700 dark:bg-blue-800/30 dark:text-blue-300"
                                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                    )}
                                >
                                    {link.label}
                                </span>
                            )}
                        </div>
                    )
                )}
            </nav>
        </div>
    )
}
