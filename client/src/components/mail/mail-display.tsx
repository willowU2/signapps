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
        <div className="flex h-full flex-col bg-white dark:bg-gray-950 relative">
            {/* Top Action Bar */}
            <div className="flex items-center p-3 px-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-gray-950/40 backdrop-blur-xl sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all hover:shadow-sm">
                                <Archive className="h-[18px] w-[18px]" />
                                <span className="sr-only">Archive</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl px-3 py-1.5 shadow-sm border-gray-100 dark:border-gray-800">Archive</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all hover:shadow-sm">
                                <ArchiveX className="h-[18px] w-[18px]" />
                                <span className="sr-only">Move to junk</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl px-3 py-1.5 shadow-sm border-gray-100 dark:border-gray-800">Move to junk</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all hover:shadow-sm">
                                <Trash2 className="h-[18px] w-[18px]" />
                                <span className="sr-only">Move to trash</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl px-3 py-1.5 shadow-sm border-red-100 dark:border-red-900 text-red-600 dark:text-red-400">Move to trash</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-2 h-5 bg-gray-200/60 dark:bg-gray-800/60" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all hover:shadow-sm">
                                <Clock className="h-[18px] w-[18px]" />
                                <span className="sr-only">Snooze</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-xl border-gray-100 dark:border-gray-800 p-1">
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={() => mail && onSnooze?.(mail.id, "Later today")}>
                                Later today
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={() => mail && onSnooze?.(mail.id, "Tomorrow")}>
                                Tomorrow
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={() => mail && onSnooze?.(mail.id, "This weekend")}>
                                This weekend
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium" onClick={() => mail && onSnooze?.(mail.id, "Next week")}>
                                Next week
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {mail && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mr-2 h-9 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60 bg-purple-50/60 dark:bg-purple-900/30 hover:bg-purple-100/80 dark:hover:bg-purple-900/50 rounded-xl shadow-sm transition-all font-semibold px-4"
                            onClick={handleSummarize}
                            disabled={isStreaming}
                        >
                            {isStreaming ? (
                                <Loader2 className="h-[18px] w-[18px] mr-2 animate-spin text-purple-500" />
                            ) : (
                                <Sparkles className="h-[18px] w-[18px] mr-2 text-purple-500" />
                            )}
                            Summarize Context
                        </Button>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all hover:shadow-sm">
                                <Reply className="h-[18px] w-[18px]" />
                                <span className="sr-only">Reply</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl px-3 py-1.5 shadow-sm border-gray-100 dark:border-gray-800">Reply</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all hover:shadow-sm">
                                <ReplyAll className="h-[18px] w-[18px]" />
                                <span className="sr-only">Reply all</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl px-3 py-1.5 shadow-sm border-gray-100 dark:border-gray-800">Reply all</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all hover:shadow-sm">
                                <Forward className="h-[18px] w-[18px]" />
                                <span className="sr-only">Forward</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-xl px-3 py-1.5 shadow-sm border-gray-100 dark:border-gray-800">Forward</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-2 h-5 bg-gray-200/60 dark:bg-gray-800/60" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail} className="h-9 w-9 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all hover:shadow-sm">
                                <MoreVertical className="h-[18px] w-[18px]" />
                                <span className="sr-only">More</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-xl border-gray-100 dark:border-gray-800 p-1">
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium">Mark as unread</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium">Star thread</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium">Add label</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg cursor-pointer text-sm font-medium text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-900/30">Mute thread</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {mail ? (
                <div className="flex flex-1 flex-col overflow-y-auto">
                    {/* Email Header */}
                    <div className="flex items-start p-8 pb-6 bg-white/40 dark:bg-gray-950/40">
                        <div className="flex items-start gap-5 text-sm w-full">
                            <Avatar className="h-14 w-14 border border-gray-200/50 dark:border-gray-800/50 shadow-md transform hover:scale-105 transition-transform">
                                <AvatarImage alt={mail.name} src={`https://avatar.vercel.sh/${mail.email}.png`} />
                                <AvatarFallback className="bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700 dark:from-purple-900/50 dark:to-indigo-900/50 dark:text-purple-300 font-bold text-lg">
                                    {mail.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1.5 flex-1 mt-1">
                                <div className="font-bold text-2xl leading-tight tracking-tight text-gray-900 dark:text-white pr-12">{mail.subject}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-semibold text-[15px] text-gray-800 dark:text-gray-200">{mail.name}</span>
                                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500">&lt;{mail.email}&gt;</span>
                                </div>
                            </div>
                            {mail.date && (
                                <div className="shrink-0 text-sm text-gray-500 font-medium bg-gray-100/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-200/50 dark:border-gray-800 mt-1 shadow-sm">
                                    {format(new Date(mail.date), "PPpp")}
                                </div>
                            )}
                        </div>
                    </div>
                    <Separator className="bg-gray-200/50 dark:bg-gray-800/50 mx-8 w-auto h-px" />

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

                    <div className="flex-1 whitespace-pre-wrap p-8 text-[16px] leading-relaxed text-gray-800 dark:text-gray-200 font-medium">
                        {mail.text}
                    </div>

                    {/* Reply Composer Area */}
                    <div className="mt-auto px-6 py-4 bg-gray-50/50 dark:bg-gray-900/30 border-t border-white/20 dark:border-white/5 rounded-b-2xl backdrop-blur-sm">
                        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                            {smartReplies.length === 0 ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-sm font-semibold text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-800/60 bg-white/80 dark:bg-gray-900/80 hover:bg-purple-50 dark:hover:bg-purple-900/40 rounded-xl shadow-sm transition-all h-9 px-4"
                                    onClick={generateSmartReplies}
                                    disabled={isRepliesLoading}
                                >
                                    {isRepliesLoading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Bot className="h-4 w-4 mr-2" />
                                    )}
                                    Suggest Replies
                                </Button>
                            ) : (
                                smartReplies.map((reply, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setReplyText(reply)}
                                        className="whitespace-nowrap rounded-xl border border-purple-200/80 dark:border-purple-800/60 bg-white/95 dark:bg-gray-900/95 shadow-sm px-5 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-purple-300 transition-all duration-200 transform hover:-translate-y-0.5"
                                    >
                                        {reply}
                                    </button>
                                ))
                            )}
                        </div>
                        <form className="mt-2">
                            <div className="grid gap-3 relative">
                                <Textarea
                                    className="p-4 pt-5 pb-14 min-h-[140px] resize-none border border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-gray-950/80 focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:border-transparent rounded-2xl shadow-sm transition-all text-[15px] leading-relaxed block w-full placeholder:text-gray-400"
                                    placeholder={`Write your reply to ${mail.name}...`}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                />
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                                    <div className="text-[13px] font-medium text-gray-500/80 dark:text-gray-400/80 flex items-center gap-1.5 pl-2 pointer-events-auto">
                                        <Bot className="w-4 h-4" />
                                        <span>AI available via '/'</span>
                                    </div>
                                    {sending ? (
                                        <div className="flex items-center gap-3 bg-white/90 dark:bg-gray-900/90 py-1.5 px-2 rounded-xl border border-gray-100 dark:border-gray-800 backdrop-blur-md shadow-sm pointer-events-auto">
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-2">
                                                Sending in {countdown}s
                                            </span>
                                            <Button
                                                onClick={(e) => { e.preventDefault(); handleUndo(); }}
                                                size="sm"
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg h-8"
                                            >
                                                Undo Action
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 pointer-events-auto">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800/80 rounded-xl h-9 px-3 transition-colors"
                                                    >
                                                        <FileText className="w-4 h-4 mr-2" />
                                                        Templates
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-[200px] rounded-xl shadow-xl border-gray-100 dark:border-gray-800">
                                                    <DropdownMenuItem className="rounded-lg cursor-pointer font-medium py-2" onClick={() => setReplyText("Thanks, I'll take a look at this asap.")}>
                                                        "Thanks, I'll look into it"
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-lg cursor-pointer font-medium py-2" onClick={() => setReplyText("Sounds good to me, please proceed.")}>
                                                        "Sounds good to me"
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-lg cursor-pointer font-medium py-2" onClick={() => setReplyText("Can we schedule a quick call to discuss this?")}>
                                                        "Can we schedule a call?"
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button
                                                onClick={handleSend}
                                                size="sm"
                                                disabled={!replyText.trim()}
                                                className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl px-5 h-9 shadow-md hover:shadow-lg transition-all"
                                            >
                                                <Send className="w-4 h-4 mr-2 shrink-0" />
                                                Send Reply
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
