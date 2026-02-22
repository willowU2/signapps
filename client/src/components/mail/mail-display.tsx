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
    Send,
    FileText,
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
import { useState, useCallback, useEffect } from "react"
import { useAiStream } from "@/hooks/use-ai-stream"

interface MailDisplayProps {
    mail: Mail | null
    onSnooze?: (id: string, time: string) => void
}

export function MailDisplay({ mail, onSnooze }: MailDisplayProps) {
    const [replyText, setReplyText] = useState("")
    const [smartReplies, setSmartReplies] = useState<string[]>([])
    const [isRepliesLoading, setIsRepliesLoading] = useState(false)

    // Streaming summary
    const { stream, stop, isStreaming } = useAiStream()
    const [summaryText, setSummaryText] = useState("")
    const [showSummary, setShowSummary] = useState(false)
    const [summaryLoading, setSummaryLoading] = useState(false)

    // Undo Send State
    const [sending, setSending] = useState(false)
    const [countdown, setCountdown] = useState(5)

    // Handle Undo Send Timer
    useEffect(() => {
        let timer: NodeJS.Timeout
        if (sending && countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000)
        } else if (sending && countdown === 0) {
            toast.success("Reply sent!")
            setSending(false)
            setReplyText("")
            setSmartReplies([])
        }
        return () => clearTimeout(timer)
    }, [sending, countdown])

    const handleSend = (e: React.MouseEvent) => {
        e.preventDefault()
        if (!replyText.trim()) return
        setSending(true)
        setCountdown(5)
    }

    const handleUndo = () => {
        setSending(false)
        toast("Sending cancelled.")
    }

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

    // --- Global Command Bar AI Integration ---
    useEffect(() => {
        const handleGlobalAiAction = (e: CustomEvent) => {
            const { action } = e.detail;
            if (action === 'summarize-thread') {
                if (!mail) {
                    toast.error("Please select an email thread first.");
                    return;
                }
                handleSummarize();
            } else if (action === 'draft-reply') {
                if (!mail) {
                    toast.error("Please select an email to reply to.");
                    return;
                }
                generateSmartReplies();
                // Optionally scroll to reply box
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
        };

        window.addEventListener('app:ai-action', handleGlobalAiAction as EventListener);
        return () => window.removeEventListener('app:ai-action', handleGlobalAiAction as EventListener);
    }, [mail, handleSummarize, generateSmartReplies]);

    return (
        <div className="flex h-full flex-col bg-white dark:bg-gray-950">
            <div className="flex items-center p-3 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/30">
                <div className="flex items-center gap-1.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors">
                                <Archive className="h-4 w-4" />
                                <span className="sr-only">Archive</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors">
                                <ArchiveX className="h-4 w-4" />
                                <span className="sr-only">Move to junk</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move to junk</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Move to trash</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move to trash</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-2 h-5 bg-gray-200 dark:bg-gray-800" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                <Clock className="h-4 w-4" />
                                <span className="sr-only">Snooze</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-lg border-gray-100 dark:border-gray-800">
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => mail && onSnooze?.(mail.id, "Later today")}>
                                Later today
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => mail && onSnooze?.(mail.id, "Tomorrow")}>
                                Tomorrow
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => mail && onSnooze?.(mail.id, "This weekend")}>
                                This weekend
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => mail && onSnooze?.(mail.id, "Next week")}>
                                Next week
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    {mail && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mr-3 h-8 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-900/20 hover:bg-purple-100/60 dark:hover:bg-purple-900/40 rounded-full shadow-sm transition-all"
                            onClick={handleSummarize}
                            disabled={isStreaming}
                        >
                            {isStreaming ? (
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="h-3.5 w-3.5 mr-2" />
                            )}
                            Summarize
                        </Button>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors">
                                <Reply className="h-4 w-4" />
                                <span className="sr-only">Reply</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors">
                                <ReplyAll className="h-4 w-4" />
                                <span className="sr-only">Reply all</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply all</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors">
                                <Forward className="h-4 w-4" />
                                <span className="sr-only">Forward</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Forward</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-2 h-5 bg-gray-200 dark:bg-gray-800" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-800 transition-colors">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">More</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl shadow-lg border-gray-100 dark:border-gray-800">
                            <DropdownMenuItem className="rounded-lg cursor-pointer">Mark as unread</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer">Star thread</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer">Add label</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20">Mute thread</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {mail ? (
                <div className="flex flex-1 flex-col overflow-y-auto">
                    <div className="flex items-start p-6 pb-4">
                        <div className="flex items-start gap-4 text-sm">
                            <Avatar className="h-10 w-10 border border-gray-100 dark:border-gray-800 shadow-sm">
                                <AvatarImage alt={mail.name} src={`https://avatar.vercel.sh/${mail.email}.png`} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300 font-medium">
                                    {mail.name
                                        .split(" ")
                                        .map((chunk) => chunk[0])
                                        .join("")
                                        .substring(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1.5">
                                <div className="font-semibold text-lg leading-none mt-0.5 tracking-tight">{mail.subject}</div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-gray-100">{mail.name}</span>
                                    <span className="text-xs text-muted-foreground">&lt;{mail.email}&gt;</span>
                                </div>
                            </div>
                        </div>
                        {mail.date && (
                            <div className="ml-auto text-xs text-muted-foreground font-medium bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded-md border border-gray-100 dark:border-gray-800">
                                {format(new Date(mail.date), "PPpp")}
                            </div>
                        )}
                    </div>
                    <Separator className="bg-gray-100 dark:bg-gray-800/60 mx-6 w-auto" />

                    {/* AI Summary Panel */}
                    {showSummary && (
                        <div className="mx-4 mt-4 rounded-2xl border border-purple-200/60 dark:border-purple-800/60 bg-gradient-to-br from-purple-50/90 to-indigo-50/90 dark:from-purple-950/40 dark:to-indigo-950/40 p-5 shadow-premium backdrop-blur-xl transition-all duration-300 overflow-hidden relative">
                            {/* Decorative blur in background */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

                            <div className="flex items-center justify-between mb-3 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-md">
                                        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span className="text-sm font-semibold text-purple-800 dark:text-purple-300 tracking-tight">AI Summary</span>
                                    {isStreaming && (
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-500 animate-pulse ml-2 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-full">generating</span>
                                    )}
                                </div>
                                <button
                                    onClick={closeSummary}
                                    className="rounded-full p-1.5 text-purple-400 hover:text-purple-700 hover:bg-purple-200/50 dark:hover:bg-purple-900/50 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            {summaryLoading ? (
                                <div className="space-y-3 relative z-10">
                                    <Skeleton className="h-4 w-full bg-purple-200/50 dark:bg-purple-800/50 rounded" />
                                    <Skeleton className="h-4 w-5/6 bg-purple-200/50 dark:bg-purple-800/50 rounded" />
                                    <Skeleton className="h-4 w-4/6 bg-purple-200/50 dark:bg-purple-800/50 rounded" />
                                </div>
                            ) : (
                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed relative z-10">
                                    {summaryText}
                                    {isStreaming && <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1 align-middle rounded-sm" />}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex-1 whitespace-pre-wrap p-6 text-[15px] leading-relaxed text-gray-800 dark:text-gray-200">
                        {mail.text}
                    </div>
                    <Separator className="mt-auto bg-gray-100 dark:bg-gray-800" />
                    <div className="p-4 px-6 bg-gray-50/50 dark:bg-gray-900/30">
                        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                            {smartReplies.length === 0 ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs text-purple-700 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60 bg-white/50 dark:bg-gray-900/50 hover:bg-purple-50 dark:hover:bg-purple-900/40 rounded-full shadow-sm transition-all"
                                    onClick={generateSmartReplies}
                                    disabled={isRepliesLoading}
                                >
                                    {isRepliesLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <Bot className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Suggest Replies
                                </Button>
                            ) : (
                                smartReplies.map((reply, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setReplyText(reply)}
                                        className="whitespace-nowrap rounded-full border border-purple-200/60 dark:border-purple-800/60 bg-white dark:bg-gray-900 shadow-sm px-4 py-1.5 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-purple-300 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
                                    >
                                        {reply}
                                    </button>
                                ))
                            )}
                        </div>
                        <form className="mt-1">
                            <div className="grid gap-3">
                                <Textarea
                                    className="p-4 min-h-[100px] resize-none border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/50 rounded-xl shadow-sm transition-all text-[15px] leading-relaxed"
                                    placeholder={`Reply to ${mail.name}...`}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                />
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Bot className="w-3 h-3" />
                                        <span>AI tools available via '/' or smart suggestions</span>
                                    </div>
                                    {sending ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                Sending in {countdown}s...
                                            </span>
                                            <Button
                                                onClick={(e) => { e.preventDefault(); handleUndo(); }}
                                                size="sm"
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-full"
                                            >
                                                Undo
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded-full"
                                                    >
                                                        <FileText className="w-4 h-4 mr-2" />
                                                        Templates
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[200px] rounded-xl shadow-lg border-gray-100 dark:border-gray-800">
                                                    <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setReplyText("Thanks, I'll take a look at this asap.")}>
                                                        "Thanks, I'll look into it"
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setReplyText("Sounds good to me, please proceed.")}>
                                                        "Sounds good to me"
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setReplyText("Can we schedule a quick call to discuss this?")}>
                                                        "Can we schedule a call?"
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button
                                                onClick={handleSend}
                                                size="sm"
                                                disabled={!replyText.trim()}
                                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2 shadow-sm transition-all"
                                            >
                                                <Send className="w-3.5 h-3.5 mr-2" />
                                                Send
                                            </Button>
                                        </div>
                                    )}
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
