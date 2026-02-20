import { format } from "date-fns"
import {
    Archive,
    ArchiveX,
    Clock,
    Forward,
    MoreVertical,
    Reply,
    ReplyAll,
    Trash2,
    Sparkles,
    Bot,
    X,
    Loader2,
} from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Mail } from "@/lib/data/mail"
import { aiApi } from "@/lib/api"
import { toast } from "sonner"
import { useState, useCallback } from "react"
import { useAiStream } from "@/hooks/use-ai-stream"

interface MailDisplayProps {
    mail: Mail | null
}

export function MailDisplay({ mail }: MailDisplayProps) {
    const [replyText, setReplyText] = useState("")
    const [smartReplies, setSmartReplies] = useState<string[]>([])
    const [isRepliesLoading, setIsRepliesLoading] = useState(false)

    // Streaming summary
    const { stream, stop, isStreaming } = useAiStream()
    const [summaryText, setSummaryText] = useState("")
    const [showSummary, setShowSummary] = useState(false)
    const [summaryLoading, setSummaryLoading] = useState(false)

    const handleSummarize = useCallback(async () => {
        if (!mail || isStreaming) return
        setSummaryText("")
        setShowSummary(true)
        setSummaryLoading(true)

        await stream(
            `Summarize the following email thread concisely:\n\nSubject: ${mail.subject}\nFrom: ${mail.name}\nContent: ${mail.text}`,
            {
                onToken: (token) => {
                    setSummaryLoading(false)
                    setSummaryText((prev) => prev + token)
                },
                onDone: () => {
                    setSummaryLoading(false)
                },
                onError: (err) => {
                    setSummaryLoading(false)
                    toast.error(`Summary failed: ${err}`)
                    setShowSummary(false)
                },
            },
            {
                systemPrompt: "You are a professional email assistant. Provide a clear, concise summary. Use bullet points for key takeaways.",
                language: "en",
            },
        )
    }, [mail, isStreaming, stream])

    const closeSummary = () => {
        if (isStreaming) stop()
        setShowSummary(false)
        setSummaryText("")
    }

    const generateSmartReplies = async () => {
        if (!mail) return
        setIsRepliesLoading(true)
        try {
            const response = await aiApi.chat(
                `Generate 3 short, professional reply options for this email. Consider the tone and context. Output ONLY the replies separated by '|'.\n\nFrom: ${mail.name}\nSubject: ${mail.subject}\nContent: ${mail.text}`,
                {
                    systemPrompt: "You are a professional email assistant. Generate contextually appropriate, concise reply suggestions.",
                },
            )

            if (response.data.answer) {
                const replies = response.data.answer
                    .split("|")
                    .map((r: string) => r.trim())
                    .filter((r: string) => r.length > 0)
                    .slice(0, 3)
                setSmartReplies(replies)
            }
        } catch (e) {
            toast.error("Failed to generate replies")
            console.error(e)
        } finally {
            setIsRepliesLoading(false)
        }
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center p-2">
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Archive className="h-4 w-4" />
                                <span className="sr-only">Archive</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <ArchiveX className="h-4 w-4" />
                                <span className="sr-only">Move to junk</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move to junk</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Move to trash</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move to trash</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Clock className="h-4 w-4" />
                                <span className="sr-only">Snooze</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Snooze</TooltipContent>
                    </Tooltip>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {mail && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mr-2 text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            onClick={handleSummarize}
                            disabled={isStreaming}
                        >
                            {isStreaming ? (
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="h-3 w-3 mr-2" />
                            )}
                            Summarize
                        </Button>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Reply className="h-4 w-4" />
                                <span className="sr-only">Reply</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <ReplyAll className="h-4 w-4" />
                                <span className="sr-only">Reply all</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply all</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Forward className="h-4 w-4" />
                                <span className="sr-only">Forward</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Forward</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">More</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                            <DropdownMenuItem>Star thread</DropdownMenuItem>
                            <DropdownMenuItem>Add label</DropdownMenuItem>
                            <DropdownMenuItem>Mute thread</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Separator />
            {mail ? (
                <div className="flex flex-1 flex-col overflow-y-auto">
                    <div className="flex items-start p-4">
                        <div className="flex items-start gap-4 text-sm">
                            <Avatar>
                                <AvatarImage alt={mail.name} />
                                <AvatarFallback>
                                    {mail.name
                                        .split(" ")
                                        .map((chunk) => chunk[0])
                                        .join("")}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1">
                                <div className="font-semibold">{mail.name}</div>
                                <div className="line-clamp-1 text-xs">{mail.subject}</div>
                                <div className="line-clamp-1 text-xs">
                                    <span className="font-medium">Reply-To:</span> {mail.email}
                                </div>
                            </div>
                        </div>
                        {mail.date && (
                            <div className="ml-auto text-xs text-muted-foreground">
                                {format(new Date(mail.date), "PPpp")}
                            </div>
                        )}
                    </div>
                    <Separator />

                    {/* AI Summary Panel */}
                    {showSummary && (
                        <div className="mx-4 mt-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">AI Summary</span>
                                    {isStreaming && (
                                        <span className="text-[10px] text-purple-500 animate-pulse">streaming...</span>
                                    )}
                                </div>
                                <button
                                    onClick={closeSummary}
                                    className="rounded p-0.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            {summaryLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-4/5" />
                                    <Skeleton className="h-3 w-3/5" />
                                </div>
                            ) : (
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {summaryText}
                                    {isStreaming && <span className="inline-block w-1.5 h-4 bg-purple-500 animate-pulse ml-0.5 align-text-bottom" />}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex-1 whitespace-pre-wrap p-4 text-sm">
                        {mail.text}
                    </div>
                    <Separator className="mt-auto" />
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t">
                        <div className="mb-2 flex gap-2 overflow-x-auto pb-2">
                            {smartReplies.length === 0 ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-purple-600 hover:text-purple-700"
                                    onClick={generateSmartReplies}
                                    disabled={isRepliesLoading}
                                >
                                    {isRepliesLoading ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                        <Bot className="h-3 w-3 mr-1" />
                                    )}
                                    Generate Smart Replies
                                </Button>
                            ) : (
                                smartReplies.map((reply, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setReplyText(reply)}
                                        className="whitespace-nowrap rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        {reply}
                                    </button>
                                ))
                            )}
                        </div>
                        <form>
                            <div className="grid gap-4">
                                <Textarea
                                    className="p-4"
                                    placeholder={`Reply to ${mail.name}...`}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                />
                                <div className="flex items-center">
                                    <label
                                        htmlFor="mute"
                                        className="flex items-center gap-2 text-xs font-normal"
                                    >

                                    </label>
                                    <Button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            toast.success("Reply sent!")
                                            setReplyText("")
                                            setSmartReplies([])
                                        }}
                                        size="sm"
                                        className="ml-auto"
                                    >
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center text-muted-foreground">
                    No message selected
                </div>
            )}
        </div>
    )
}
