import { ComponentProps, useRef, useState, useEffect, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
import { Archive, Clock, Trash2, Square, Star, Loader2, ShieldAlert, Inbox, Reply, Forward, CheckSquare, CalendarPlus, Bell, FolderPlus, Mail as MailIcon, MailOpen } from "lucide-react"
import { Mail } from "@/lib/data/mail"
import { EmptyState } from "@/components/ui/empty-state"
import { SpamBadge } from "./spam-filter-settings"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { EmailToTaskDialog } from "@/components/mail/email-to-task-dialog"
import { EmailToEventDialog } from "@/components/interop/EmailToEventDialog"
import { EmailFollowUpDialog } from "@/components/interop/EmailFollowUpDialog"
import { EmailThreadToProjectDialog } from "@/components/interop/EmailThreadToProject"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VirtualList } from "@/components/ui/virtual-list"
import { useSwipeAction } from "@/hooks/use-swipe-action"
import { SnoozeDatePicker } from "./snooze-picker"
// Avatars removed for Gmail layout

const PAGE_SIZE = 20
// Fixed row height matching the Gmail-style h-10 rows (40px)
const MAIL_ROW_HEIGHT = 40

interface MailListProps extends Omit<ComponentProps<"div">, "onSelect"> {
    items: Mail[]
    selectedId: string | null
    onSelect: (id: string) => void
    onSnooze?: (id: string, time: string) => void
    onArchive?: (id: string) => void
    onDelete?: (id: string) => void
    onReportSpam?: (id: string) => void
    onStar?: (id: string) => void
    onMarkUnread?: (id: string) => void
    spamIds?: Set<string>
    starredIds?: Set<string>
    isSearchActive?: boolean
}

// ─── MailRow — swipe-aware row component ────────────────────────────────────

interface MailRowProps {
    item: Mail
    selectedId: string | null
    onSelect: (id: string) => void
    onSnooze?: (id: string, time: string) => void
    onArchive?: (id: string) => void
    onDelete?: (id: string) => void
    onReportSpam?: (id: string) => void
    onStar?: (id: string) => void
    onMarkUnread?: (id: string) => void
    spamIds?: Set<string>
    starredIds?: Set<string>
}

function MailRow({ item, selectedId, onSelect, onSnooze, onArchive, onDelete, onReportSpam, onStar, onMarkUnread, spamIds, starredIds }: MailRowProps) {
    const { handlers: swipeHandlers } = useSwipeAction({
        onSwipeLeft: () => onArchive?.(item.id),
        onSwipeRight: () => onDelete?.(item.id),
    })
    const [taskOpen, setTaskOpen] = useState(false)
    const [eventOpen, setEventOpen] = useState(false)
    const [followUpOpen, setFollowUpOpen] = useState(false)
    const [projectOpen, setProjectOpen] = useState(false)

    return (
        <>
        <EmailToTaskDialog open={taskOpen} onOpenChange={setTaskOpen} emailSubject={item.subject} emailBody={item.text} emailFrom={item.email} emailId={item.id} />
        <EmailToEventDialog open={eventOpen} onOpenChange={setEventOpen} mail={item} />
        <EmailFollowUpDialog open={followUpOpen} onOpenChange={setFollowUpOpen} mail={item} />
        <EmailThreadToProjectDialog open={projectOpen} onOpenChange={setProjectOpen} mail={item} />
        <ContextMenu>
        <ContextMenuTrigger asChild>
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(item.id); }}
            className={cn(
                "group relative flex items-center gap-2 px-1 py-0 h-10 text-left text-sm transition-all duration-150 outline-none w-full border-b border-border/60 dark:border-gray-800/60 select-none cursor-pointer hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] hover:z-10",
                selectedId === item.id
                    ? "bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]"
                    : "bg-background dark:bg-[#1f1f1f] hover:bg-muted/80 dark:hover:bg-[#202124]",
                !item.read && "bg-background dark:bg-[#1f1f1f]"
            )}
            {...swipeHandlers}
        >
            <div className="flex-shrink-0 flex items-center gap-2 px-3 text-gray-400 dark:text-muted-foreground">
                <Square className="h-[18px] w-[18px] hover:text-muted-foreground dark:hover:text-gray-300 transition-colors" />
                <button
                    type="button"
                    aria-label={starredIds?.has(item.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                    className="bg-transparent border-none p-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onStar?.(item.id) }}
                >
                    <Star className={cn(
                        "h-[18px] w-[18px] transition-colors",
                        starredIds?.has(item.id)
                            ? "text-amber-400 fill-amber-400"
                            : "hover:text-muted-foreground dark:hover:text-gray-300"
                    )} />
                </button>
            </div>
            <div className="flex items-center w-full overflow-hidden gap-2 pr-4">
                <span className={cn(
                    "w-48 truncate flex-shrink-0 text-[14px]",
                    !item.read ? "text-[#202124] dark:text-[#e3e3e3] font-bold" : "text-[#202124] dark:text-[#e3e3e3] font-medium"
                )}>
                    {item.name}
                </span>
                <div className="flex items-center truncate flex-1 text-[14px]">
                    {spamIds?.has(item.id) && <span className="shrink-0 mr-1.5"><SpamBadge /></span>}
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
            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-background dark:bg-[#202124] rounded-md shadow-sm pl-1 pr-1 py-0.5">
                <button type="button" aria-label="Archiver" className="p-1.5 rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-gray-800 transition-colors shadow-none bg-transparent border-none" onClick={(e) => { e.stopPropagation(); onArchive?.(item.id) }}>
                    <Archive className="w-[18px] h-[18px]" />
                </button>
                <button type="button" aria-label="Supprimer" className="p-1.5 rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-gray-800 transition-colors shadow-none bg-transparent border-none" onClick={(e) => { e.stopPropagation(); onDelete?.(item.id) }}>
                    <Trash2 className="w-[18px] h-[18px]" />
                </button>
                <button type="button" aria-label={starredIds?.has(item.id) ? "Retirer des favoris" : "Ajouter aux favoris"} className="p-1.5 rounded-full text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-500 transition-colors shadow-none bg-transparent border-none" onClick={(e) => { e.stopPropagation(); onStar?.(item.id) }}>
                    <Star className={cn("w-[18px] h-[18px]", starredIds?.has(item.id) && "text-amber-400 fill-amber-400")} />
                </button>
                <button type="button" aria-label="Marquer comme non lu" className="p-1.5 rounded-full text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-500 transition-colors shadow-none bg-transparent border-none" onClick={(e) => { e.stopPropagation(); onMarkUnread?.(item.id) }}>
                    <MailOpen className="w-[18px] h-[18px]" />
                </button>
                {onReportSpam && (
                    <button type="button" aria-label="Signaler comme spam" className="p-1.5 rounded-full text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors shadow-none bg-transparent border-none" onClick={(e) => { e.stopPropagation(); onReportSpam(item.id) }}>
                        <ShieldAlert className="w-[18px] h-[18px]" />
                    </button>
                )}
                <SnoozeDatePicker
                    onSnooze={(isoStr, label) => { onSnooze?.(item.id, label) }}
                >
                    <button type="button" aria-label="Reporter" className="p-1.5 rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-gray-800 transition-colors cursor-pointer shadow-none bg-transparent border-none" onClick={(e) => e.stopPropagation()}>
                        <Clock className="w-[18px] h-[18px]" />
                    </button>
                </SnoozeDatePicker>
            </div>
        </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
            <ContextMenuItem onClick={() => onSelect(item.id)}>
                <Reply className="h-3.5 w-3.5 mr-2" /> Repondre
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onSelect(item.id)}>
                <Forward className="h-3.5 w-3.5 mr-2" /> Transferer
            </ContextMenuItem>
            <ContextMenuSeparator />
            {/* Interop actions — Features 1, 2, 12, 19 */}
            <ContextMenuItem onClick={(e) => { e.preventDefault(); setTaskOpen(true) }}>
                <CheckSquare className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Créer une tâche
            </ContextMenuItem>
            <ContextMenuItem onClick={(e) => { e.preventDefault(); setEventOpen(true) }}>
                <CalendarPlus className="h-3.5 w-3.5 mr-2 text-blue-500" /> Ajouter au calendrier
            </ContextMenuItem>
            <ContextMenuItem onClick={(e) => { e.preventDefault(); setFollowUpOpen(true) }}>
                <Bell className="h-3.5 w-3.5 mr-2 text-amber-500" /> Rappel de suivi
            </ContextMenuItem>
            <ContextMenuItem onClick={(e) => { e.preventDefault(); setProjectOpen(true) }}>
                <FolderPlus className="h-3.5 w-3.5 mr-2 text-indigo-500" /> Créer un projet
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onStar?.(item.id)}>
                <Star className={cn("h-3.5 w-3.5 mr-2", starredIds?.has(item.id) ? "text-amber-400 fill-amber-400" : "text-amber-500")} />
                {starredIds?.has(item.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onMarkUnread?.(item.id)}>
                <MailOpen className="h-3.5 w-3.5 mr-2 text-blue-500" /> Marquer comme non lu
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onArchive?.(item.id)}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Archiver
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onSnooze?.(item.id, "Tomorrow")}>
                <Clock className="h-3.5 w-3.5 mr-2" /> Reporter a demain
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => onDelete?.(item.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
            </ContextMenuItem>
        </ContextMenuContent>
        </ContextMenu>
        </>
    )
}

// ─── MailList ────────────────────────────────────────────────────────────────

export function MailList({ items, selectedId, onSelect, onSnooze, onArchive, onDelete, onReportSpam, onStar, onMarkUnread, spamIds, starredIds, isSearchActive }: MailListProps) {
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

            {/* Virtualised email list — only visible rows are rendered */}
            {items.length === 0 ? (
                <EmptyState
                    icon={MailIcon}
                    context={isSearchActive ? "search" : "empty"}
                    title={isSearchActive ? "Aucun résultat" : "Votre boîte est vide"}
                    description={
                        isSearchActive
                            ? "Aucun email ne correspond à votre recherche."
                            : "Tous vos messages apparaîtront ici."
                    }
                />
            ) : (
                <VirtualList
                    items={items}
                    itemHeight={MAIL_ROW_HEIGHT}
                    overscan={8}
                    className="flex-1"
                    onEndReached={() => {
                        if (hasMore) setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length));
                    }}
                    getItemKey={(item) => item.id}
                    renderItem={(item) => (
                        <MailRow
                            item={item}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onSnooze={onSnooze}
                            onArchive={onArchive}
                            onDelete={onDelete}
                            onReportSpam={onReportSpam}
                            onStar={onStar}
                            onMarkUnread={onMarkUnread}
                            spamIds={spamIds}
                            starredIds={starredIds}
                        />
                    )}
                />
            )}
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

    return "bg-muted/80 text-muted-foreground border-border/50 dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700/50"
}
