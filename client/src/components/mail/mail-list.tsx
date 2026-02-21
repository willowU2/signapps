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
        <ScrollArea className="h-screen">
            <div className="flex flex-col p-3 pt-0 gap-1.5">
                {items.map((item) => (
                    <button
                        key={item.id}
                        className={cn(
                            "group relative flex flex-col items-start gap-2 rounded-xl p-3 text-left text-sm transition-all outline-none",
                            "hover:bg-gray-100/80 dark:hover:bg-gray-800/50",
                            selectedId === item.id
                                ? "bg-blue-50/80 dark:bg-blue-900/20 shadow-sm border border-blue-200/50 dark:border-blue-800/50"
                                : "border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50"
                        )}
                        onClick={() => onSelect(item.id)}
                    >
                        <div className="flex w-full flex-col gap-1">
                            <div className="flex items-center">
                                <div className="flex items-center gap-2">
                                    <div className="font-semibold">{item.name}</div>
                                    {!item.read && (
                                        <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                                    )}
                                </div>
                                <div
                                    className={cn(
                                        "ml-auto text-xs",
                                        selectedId === item.id
                                            ? "text-foreground"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {formatDistanceToNow(new Date(item.date), {
                                        addSuffix: true,
                                    })}
                                </div>
                            </div>
                            <div className="text-xs font-medium">{item.subject}</div>
                        </div>
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                            {item.text.substring(0, 300)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            {item.labels.map((label) => (
                                <div key={label} className={cn(
                                    "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider transition-colors",
                                    getBadgeVariantFromLabel(label)
                                )}>
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Hover Actions */}
                        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-1 rounded-md shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="p-1.5 rounded text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Archive" onClick={(e) => e.stopPropagation()}>
                                <Archive className="w-4 h-4" />
                            </div>
                            <div className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete" onClick={(e) => { e.stopPropagation(); }}>
                                <Trash2 className="w-4 h-4" />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" title="Snooze" onClick={(e) => e.stopPropagation()}>
                                        <Clock className="w-4 h-4" />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-lg border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "Later today"); }}>
                                        Later today
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "Tomorrow"); }}>
                                        Tomorrow
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "This weekend"); }}>
                                        This weekend
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); onSnooze?.(item.id, "Next week"); }}>
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
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
    }

    if (["personal"].includes(label.toLowerCase())) {
        return "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/60"
    }

    return "bg-gray-100 text-gray-600 border-gray-200/60 dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700/60"
}
