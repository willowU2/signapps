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
                                        "h-10 w-10 cursor-pointer rounded-xl transition-all duration-200",
                                        link.variant === "default"
                                            ? "bg-primary/15 text-primary dark:bg-primary/20 shadow-sm ring-1 ring-primary/20 hover:bg-primary/20"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                >
                                    <link.icon className="h-4 w-4" />
                                    <span className="sr-only">{link.title}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="flex items-center gap-4 rounded-xl px-3 py-1.5 shadow-sm border-gray-100 dark:border-gray-800">
                                {link.title}
                                {link.label && (
                                    <span className="ml-auto text-muted-foreground font-semibold">
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
                                "justify-start cursor-pointer transition-all duration-200 rounded-xl h-10 px-3 font-medium",
                                link.variant === "default"
                                    ? "bg-primary/10 text-primary dark:bg-primary/20 shadow-sm ring-1 ring-primary/20 hover:bg-primary/15 dark:hover:bg-primary/25"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <link.icon className="mr-2.5 h-4 w-4" />
                            {link.title}
                            {link.label && (
                                <span
                                    className={cn(
                                        "ml-auto text-xs font-semibold px-2 py-0.5 rounded-full transition-colors",
                                        link.variant === "default"
                                            ? "bg-primary/20 text-primary"
                                            : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
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
