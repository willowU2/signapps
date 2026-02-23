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
// import { useMail } from "@/app/mail/use-mail"

interface MailListProps {
    items: Mail[]
    selectedId: string | null
    onSelect: (id: string) => void
    onSnooze?: (id: string, time: string) => void
}

export function MailList({ items, selectedId, onSelect, onSnooze }: MailListProps) {
    return (
        <ScrollArea className="h-full flex-1">
            <div className="flex flex-col p-3 gap-2.5">
                {items.map((item) => (
                    <button
                        key={item.id}
                        className={cn(
                            "group relative flex flex-col items-start gap-2.5 rounded-2xl p-4 text-left text-sm transition-all duration-300 outline-none w-full",
                            selectedId === item.id
                                ? "bg-white dark:bg-gray-950 ring-2 ring-purple-500/40 border-transparent shadow-md transform scale-[1.01]"
                                : "bg-white/40 dark:bg-gray-950/40 border border-gray-200/50 dark:border-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-950/80 hover:border-gray-300/50 dark:hover:border-gray-700/50 hover:shadow-md hover:scale-[1.01]"
                        )}
                        onClick={() => onSelect(item.id)}
                    >
                        <div className="flex w-full flex-col gap-1.5">
                            <div className="flex items-center">
                                <div className="flex items-center gap-2">
                                    <div className="font-semibold text-[15px] tracking-tight text-gray-900 dark:text-gray-100">{item.name}</div>
                                    {!item.read && (
                                        <span className="flex h-2.5 w-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                    )}
                                </div>
                                <div
                                    className={cn(
                                        "ml-auto text-xs font-medium",
                                        selectedId === item.id
                                            ? "text-purple-600 dark:text-purple-400"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {formatDistanceToNow(new Date(item.date), {
                                        addSuffix: true,
                                    })}
                                </div>
                            </div>
                            <div className="text-[13px] font-medium leading-snug text-gray-800 dark:text-gray-200 pr-8">{item.subject}</div>
                        </div>
                        <div className="line-clamp-2 text-[13px] text-muted-foreground/80 leading-relaxed pr-2">
                            {item.text.substring(0, 300)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {item.labels.map((label) => (
                                <div key={label} className={cn(
                                    "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider transition-colors shadow-sm",
                                    getBadgeVariantFromLabel(label)
                                )}>
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Hover Actions */}
                        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-800 translate-x-2 group-hover:translate-x-0">
                            <div className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Archive" onClick={(e) => e.stopPropagation()}>
                                <Archive className="w-4 h-4" />
                            </div>
                            <div className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete" onClick={(e) => { e.stopPropagation(); }}>
                                <Trash2 className="w-4 h-4" />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer" title="Snooze" onClick={(e) => e.stopPropagation()}>
                                        <Clock className="w-4 h-4" />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-xl border-gray-100 dark:border-gray-800 p-1" onClick={(e) => e.stopPropagation()}>
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
