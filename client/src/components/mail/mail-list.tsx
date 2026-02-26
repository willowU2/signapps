import { ComponentProps } from "react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Archive, Clock, Trash2 } from "lucide-react"
import { Mail } from "@/lib/data/mail"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { useMail } from "@/app/mail/use-mail"

interface MailListProps {
    items: Mail[]
    selectedId: string | null
    onSelect: (id: string) => void
    onSnooze?: (id: string, time: string) => void
    onArchive?: (id: string) => void
    onDelete?: (id: string) => void
}

export function MailList({ items, selectedId, onSelect, onSnooze, onArchive, onDelete }: MailListProps) {
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

            <ScrollArea className="flex-1">
                <div className="flex flex-col">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            className={cn(
                                "group relative flex items-center gap-4 px-4 py-3 text-left text-sm transition-all duration-300 outline-none w-full border-b border-border/40 select-none",
                                selectedId === item.id
                                    ? "bg-primary/5 dark:bg-primary/10"
                                    : "hover:bg-muted/50 dark:hover:bg-muted/20",
                                !item.read && "bg-white dark:bg-gray-950/40"
                            )}
                            onClick={() => onSelect(item.id)}
                        >
                            {/* Avatar or Checkbox area */}
                            <div className="flex-shrink-0 flex items-center justify-center">
                                <Avatar className="h-9 w-9 border border-border/50">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.email}`} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                                        {item.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>

                            {/* Content */}
                            <div className="flex flex-col w-full overflow-hidden gap-0.5">
                                <div className="flex items-center justify-between w-full">
                                    <span className={cn(
                                        "truncate font-medium text-[15px]",
                                        !item.read ? "text-foreground font-bold" : "text-foreground/80"
                                    )}>
                                        {item.name}
                                    </span>
                                    <span className={cn(
                                        "whitespace-nowrap text-xs flex-shrink-0 ml-2",
                                        !item.read ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                                    )}>
                                        {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                                    </span>
                                </div>

                                <div className="flex items-center truncate text-[14px]">
                                    <span className={cn("truncate", !item.read ? "font-semibold text-foreground/90" : "font-medium text-muted-foreground")}>
                                        {item.subject}
                                    </span>
                                    <span className="truncate text-muted-foreground/70 ml-2 font-normal hidden sm:inline-block">
                                        - {item.text.substring(0, 80).replace(/\s+/g, ' ')}...
                                    </span>
                                </div>
                            </div>

                            {/* Hover Actions (Gmail style overlay on right edge) */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-l from-background/95 via-background/95 to-transparent pl-8 pr-2 py-1.5 rounded-l-full">
                                <div className="p-2 rounded-full text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors shadow-sm bg-background border border-border/50" title="Archive" onClick={(e) => { e.stopPropagation(); onArchive?.(item.id) }}>
                                    <Archive className="w-4 h-4" />
                                </div>
                                <div className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-sm bg-background border border-border/50" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete?.(item.id) }}>
                                    <Trash2 className="w-4 h-4" />
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <div className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shadow-sm bg-background border border-border/50" title="Snooze" onClick={(e) => e.stopPropagation()}>
                                            <Clock className="w-4 h-4" />
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
                </div>
            </ScrollArea>
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
