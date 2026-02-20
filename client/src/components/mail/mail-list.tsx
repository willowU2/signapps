import { ComponentProps } from "react"
import { formatDistanceToNow } from "date-fns"

import { cn } from "@/lib/utils"
// import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
// import { Separator } from "@/components/ui/separator"
import { Mail } from "@/lib/data/mail"
// import { useMail } from "@/app/mail/use-mail"

interface MailListProps {
    items: Mail[]
    selectedId: string | null
    onSelect: (id: string) => void
}

export function MailList({ items, selectedId, onSelect }: MailListProps) {
    return (
        <ScrollArea className="h-screen">
            <div className="flex flex-col gap-2 p-4 pt-0">
                {items.map((item) => (
                    <button
                        key={item.id}
                        className={cn(
                            "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
                            selectedId === item.id && "bg-accent"
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
                        <div className="flex items-center gap-2">
                            {item.labels.map((label) => (
                                <div key={label} className={cn(
                                    "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground",
                                    getBadgeVariantFromLabel(label)
                                )}>
                                    {label}
                                </div>
                            ))}
                        </div>
                    </button>
                ))}
            </div>
        </ScrollArea>
    )
}

function getBadgeVariantFromLabel(label: string) {
    if (["work"].includes(label.toLowerCase())) {
        return "bg-black text-white dark:bg-white dark:text-black hover:bg-black/80"
    }

    if (["personal"].includes(label.toLowerCase())) {
        return "bg-blue-500 text-white hover:bg-blue-600"
    }

    return "bg-secondary text-secondary-foreground hover:bg-secondary/80"
}
