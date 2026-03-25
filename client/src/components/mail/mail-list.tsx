import { ComponentProps, useRef, useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
import { Archive, Clock, Trash2, Square, Star, Loader2, ShieldAlert } from "lucide-react"
import { Mail } from "@/lib/data/mail"
import { SpamBadge } from "./spam-filter-settings"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Avatars removed for Gmail layout

const PAGE_SIZE = 20

interface MailListProps extends ComponentProps<"div"> {
    items: Mail[]
    selectedId: string | null
    onSelect: (id: string) => void
    onSnooze?: (id: string, time: string) => void
    onArchive?: (id: string) => void
    onDelete?: (id: string) => void
    onReportSpam?: (id: string) => void
    spamIds?: Set<string>
}

export function MailList({ items, selectedId, onSelect, onSnooze, onArchive, onDelete, onReportSpam, spamIds }: MailListProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    const visibleItems = items.slice(0, visibleCount)
    const hasMore = visibleCount < items.length

    // Reset visible count when items list changes (e.g. folder switch, search)
    useEffect(() => {
        setVisibleCount(PAGE_SIZE)
    }, [items])

    // IntersectionObserver: load next page when sentinel enters viewport
    const handleIntersect = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            const entry = entries[0]
            if (entry?.isIntersecting && hasMore) {
                setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length))
            }
        },
        [hasMore, items.length]
    )

    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(handleIntersect, {
            root: scrollContainerRef.current,
            rootMargin: "0px 0px 200px 0px",
            threshold: 0,
        })
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [handleIntersect])

    return (
        <div className="flex flex-col h-full bg-background/50">
            <div className="px-4 py-3 border-b flex-shrink-0">
                <Tabs defaultValue="primary" className="w-full">
                    <TabsList className="w-full justify-start h-10 bg-transparent p-0 gap-6 border-b-0">
                        <TabsTrigger value="primary" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-2 pb-2 pt-0 shadow-none border-b-2 border-transparent text-muted-foreground font-semibold">
                            Primary
                        </TabsTrigger>
                        <TabsTrigger value="social" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-2 pb-2 pt-0 shadow-none border-b-2 border-transparent text-muted-foreground font-semibold">
                            Social
                        </TabsTrigger>
                        <TabsTrigger value="promotions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-2 pb-2 pt-0 shadow-none border-b-2 border-transparent text-muted-foreground font-semibold">
                            Promotions
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Scrollable email list */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto"
            >
                <div className="flex flex-col">
                    {visibleItems.map((item) => (
                        <button
                            key={item.id}
                            className={cn(
                                "group relative flex items-center gap-2 px-1 py-0 h-10 text-left text-sm transition-all duration-150 outline-none w-full border-b border-gray-200/60 dark:border-gray-800/60 select-none cursor-pointer hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] hover:z-10",
                                selectedId === item.id
                                    ? "bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]"
                                    : "bg-background dark:bg-[#1f1f1f] hover:bg-gray-50/80 dark:hover:bg-[#202124]",
                                !item.read && "bg-background dark:bg-[#1f1f1f]"
                            )}
                            onClick={() => onSelect(item.id)}
                        >
                            {/* Checkbox and Star area */}
                            <div className="flex-shrink-0 flex items-center gap-2 px-3 text-gray-400 dark:text-gray-500">
                                <Square className="h-[18px] w-[18px] hover:text-gray-700 dark:hover:text-gray-300 transition-colors" />
                                <Star className="h-[18px] w-[18px] hover:text-gray-700 dark:hover:text-gray-300 transition-colors" />
                            </div>

                            {/* Content row */}
                            <div className="flex items-center w-full overflow-hidden gap-2 pr-4">
                                <span className={cn(
                                    "w-48 truncate flex-shrink-0 text-[14px]",
                                    !item.read ? "text-[#202124] dark:text-[#e3e3e3] font-bold" : "text-[#202124] dark:text-[#e3e3e3] font-medium"
                                )}>
                                    {item.name}
                                </span>

                                <div className="flex items-center truncate flex-1 text-[14px]">
                                    {spamIds?.has(item.id) && (
                                        <span className="shrink-0 mr-1.5"><SpamBadge /></span>
                                    )}
                                    <span className={cn("truncate", !item.read ? "font-bold text-[#202124] dark:text-[#e3e3e3]" : "font-medium text-[#202124] dark:text-[#e3e3e3]")}>
                                        {item.subject}
                                    </span>
                                    <span className="truncate text-[#5f6368] dark:text-[#9aa0a6] ml-2 font-normal hidden sm:inline-block">
                                        - {item.text.replace(/\s+/g, ' ')}
                                    </span>
                                </div>

                                <span className={cn(
                                    "w-24 text-right flex-shrink-0 text-[12px]",
                                    !item.read ? "text-[#202124] dark:text-[#e3e3e3] font-bold" : "text-[#5f6368] dark:text-[#9aa0a6] font-medium group-hover:hidden"
                                )}>
                                    {formatDistanceToNow(new Date(item.date))}
                                </span>
                            </div>

                            {/* Hover Actions (Gmail style overlay on right edge) */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-background dark:bg-[#202124] pl-2 pr-1 py-1">
                                <div className="p-2 rounded-full text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shadow-none bg-transparent border-none" title="Archive" onClick={(e) => { e.stopPropagation(); onArchive?.(item.id) }}>
                                    <Archive className="w-5 h-5" />
                                </div>
                                <div className="p-2 rounded-full text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shadow-none bg-transparent border-none" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete?.(item.id) }}>
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                {onReportSpam && (
                                    <div className="p-2 rounded-full text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors shadow-none bg-transparent border-none" title="Report spam" onClick={(e) => { e.stopPropagation(); onReportSpam(item.id) }}>
                                        <ShieldAlert className="w-5 h-5" />
                                    </div>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <div className="p-2 rounded-full text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shadow-none bg-transparent border-none" title="Snooze" onClick={(e) => e.stopPropagation()}>
                                            <Clock className="w-5 h-5" />
                                        </div>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-xl border-border/50 p-1" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "Later today"); }}>
                                            Later today
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "Tomorrow"); }}>
                                            Tomorrow
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "This weekend"); }}>
                                            This weekend
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "Next week"); }}>
                                            Next week
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </button>
                    ))}

                    {/* Infinite scroll sentinel */}
                    <div ref={sentinelRef} aria-hidden="true" />

                    {/* Loading indicator shown while next page is being revealed */}
                    {hasMore && (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm">Chargement…</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function getBadgeVariantFromLabel(label: string) {
    if (["work"].includes(label.toLowerCase())) {
        return "bg-slate-100/80 text-slate-700 border-slate-200/50 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/50"
    }

    if (["personal"].includes(label.toLowerCase())) {
        return "bg-purple-50/80 text-purple-700 border-purple-200/50 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/50"
    }

    return "bg-gray-100/80 text-gray-600 border-gray-200/50 dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700/50"
}
