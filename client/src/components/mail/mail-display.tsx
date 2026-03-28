import { SpinnerInfinity } from 'spinners-react';
import { format } from "date-fns"
import { Archive, ArchiveX, Clock, Forward, MoreVertical, Reply, ReplyAll, Trash2, Sparkles, Bot, X, Send, FileText, Link2, CheckSquare, CalendarPlus } from 'lucide-react';
import { AttachmentPreviewBar, type Attachment } from "./attachment-preview"
import { ScheduleSendPopup } from "./schedule-send-popup"
import { SnoozeDatePicker } from "./snooze-picker"
import { EntityLinks } from '@/components/crosslinks/EntityLinks';
import { PgpStatusBadges, DecryptButton } from './pgp-indicator';
import { EmailToTaskDialog } from './email-to-task-dialog';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarDivider } from "@/components/editor/toolbar"
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
import { VoiceInput } from "@/components/ui/voice-input"

interface MailDisplayProps {
    mail: Mail | null
    onSnooze?: (id: string, time: string) => void
    onArchive?: (id: string) => void
    onDelete?: (id: string) => void
}

export function MailDisplay({ mail, onSnooze, onArchive, onDelete }: MailDisplayProps) {
    const [replyText, setReplyText] = useState("")
    const [smartReplies, setSmartReplies] = useState<string[]>([])
    const [isRepliesLoading, setIsRepliesLoading] = useState(false)

    // Streaming summary
    const { stream, stop, isStreaming } = useAiStream()
    const [summaryText, setSummaryText] = useState("")
    const [showSummary, setShowSummary] = useState(false)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [interimReplyText, setInterimReplyText] = useState("")

    // Email-to-task dialog
    const [showTaskDialog, setShowTaskDialog] = useState(false)

    // PGP decryption
    const [decryptedBody, setDecryptedBody] = useState<string | null>(null)

    // Reset decrypted body when mail changes
    useEffect(() => {
        setDecryptedBody(null)
    }, [mail?.id])

    // Undo Send State
    const [sending, setSending] = useState(false)
    const [countdown, setCountdown] = useState(5)

    // Handle Undo Send Timer
    useEffect(() => {
        let timer: NodeJS.Timeout
        if (sending && countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000)
        } else if (sending && countdown === 0) {
            toast.success("Réponse envoyée !")
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
        if (!mail || isStreaming) return
        setIsRepliesLoading(true)
        setSmartReplies([])

        // We will accumulate the stream and split by '|'
        let fullResponse = ""

        try {
            await stream(
                `Generate 3 short, professional reply options for this email. Consider the tone and context. Output ONLY the replies separated by '|'.\n\nFrom: ${mail.name}\nSubject: ${mail.subject}\nContent: ${mail.text}`,
                {
                    onToken: (token) => {
                        fullResponse += token
                        // Try to parse partial replies to show them as they arrive
                        const partialReplies = fullResponse
                            .split("|")
                            .map((r) => r.trim())
                            .filter((r) => r.length > 0)

                        // Only update if we have a completely formed reply (which means we saw a '|') 
                        // or if we're just accumulating. For UI smoothness, we'll just show what we have.
                        setSmartReplies(partialReplies.slice(0, 3))
                    },
                    onDone: () => {
                        setIsRepliesLoading(false)
                        const finalReplies = fullResponse
                            .split("|")
                            .map((r) => r.trim())
                            .filter((r) => r.length > 0)
                            .slice(0, 3)
                        setSmartReplies(finalReplies)
                    },
                    onError: (err) => {
                        setIsRepliesLoading(false)
                        toast.error(`Failed to generate replies: ${err}`)
                        console.debug(err)
                    }
                },
                {
                    systemPrompt: "You are a professional email assistant. Generate contextually appropriate, concise reply suggestions.",
                    language: "en"
                }
            )
        } catch (e) {
            setIsRepliesLoading(false)
            toast.error("Impossible de démarrer la génération")
            console.debug(e)
        }
    }

    // --- Global Command Bar AI Integration ---
    useEffect(() => {
        const handleGlobalAiAction = (e: CustomEvent) => {
            const { action } = e.detail;
            if (action === 'summarize-thread') {
                if (!mail) {
                    toast.error("Veuillez sélectionner un fil de discussion d'abord.");
                    return;
                }
                handleSummarize();
            } else if (action === 'draft-reply') {
                if (!mail) {
                    toast.error("Veuillez sélectionner un email auquel répondre.");
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
        <div className="flex h-full flex-col bg-background dark:bg-gray-950 relative">
            {/* Top Action Bar */}
            <div className="sticky top-0 z-20 shadow-sm border-b border-gray-200 dark:border-[#5f6368]">
                <Toolbar className="border-b-0 bg-background/50 backdrop-blur-md">
                    <ToolbarGroup>
                        <ToolbarButton disabled={!mail} title="Archiver" onClick={() => mail && onArchive?.(mail.id)}>
                            <Archive className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton disabled={!mail} title="Move to junk">
                            <ArchiveX className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton disabled={!mail} title="Move to trash" onClick={() => mail && onDelete?.(mail.id)}>
                            <Trash2 className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>
                    
                    <ToolbarDivider />
                    
                    <ToolbarGroup>
                        {/* Custom snooze picker (IDEA-036) */}
                        <SnoozeDatePicker onSnooze={(isoStr, label) => mail && onSnooze?.(mail.id, label)}>
                            <ToolbarButton disabled={!mail} title="Snooze">
                                <Clock className="h-4 w-4" />
                            </ToolbarButton>
                        </SnoozeDatePicker>
                    </ToolbarGroup>
                    
                    <ToolbarDivider />
                    
                    <ToolbarGroup>
                        <ToolbarButton disabled={!mail} title="More actions">
                            <MoreVertical className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>

                    <ToolbarGroup className="ml-auto">
                        {mail && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mr-2 h-7 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-900/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition-all font-semibold"
                                onClick={() => setShowTaskDialog(true)}
                            >
                                <CheckSquare className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                                Creer une tache
                            </Button>
                        )}
                        {mail && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mr-2 h-7 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60 bg-purple-50/60 dark:bg-purple-900/30 hover:bg-purple-100/80 dark:hover:bg-purple-900/50 transition-all font-semibold"
                                onClick={handleSummarize}
                                disabled={isStreaming}
                            >
                                {isStreaming ? (
                                    <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3.5 w-3.5 mr-2  text-purple-500" />
                                ) : (
                                    <Sparkles className="h-3.5 w-3.5 mr-2 text-purple-500" />
                                )}
                                Summarize Context
                            </Button>
                        )}
                        <ToolbarButton disabled={!mail} title="Reply">
                            <Reply className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton disabled={!mail} title="Reply all">
                            <ReplyAll className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton disabled={!mail} title="Forward">
                            <Forward className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>
                </Toolbar>
            </div>
            {mail ? (
                <div className="flex flex-1 flex-col overflow-y-auto">
                    {/* Email Header */}
                    <div className="flex flex-col px-8 pt-6 pb-2 bg-background dark:bg-[#1f1f1f]">
                        <div className="flex items-center gap-3 mb-6 w-full flex-wrap">
                            <h2 className="font-normal text-[22px] leading-tight text-[#1f1f1f] dark:text-[#e3e3e3]">{mail.subject}</h2>
                            <PgpStatusBadges body={mail.text} accountId={mail.id} />
                            <span className="bg-[#fef7e0] text-[#b06000] text-xs px-2 py-0.5 rounded border border-[#fbdc8e] font-medium leading-none flex items-center h-5">Externe</span>
                            <span className="bg-[#f1f3f4] text-[#444746] dark:bg-[#3c4043] dark:text-[#e3e3e3] text-xs px-2 rounded flex items-center gap-1 cursor-pointer hover:bg-[#e8eaed] transition-colors leading-none h-5">Boîte de réception <X className="h-3 w-3" /></span>
                        </div>

                        <div className="flex items-start gap-4 text-sm w-full">
                            <Avatar className="h-10 w-10 mt-0.5">
                                <AvatarImage alt={mail.name} src={`https://avatar.vercel.sh/${mail.email}.png`} />
                                <AvatarFallback className="bg-blue-600 text-white font-medium text-lg">
                                    {mail.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-0 flex-1">
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-bold text-[14px] text-[#1f1f1f] dark:text-[#e3e3e3]">{mail.name}</span>
                                    <span className="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal cursor-pointer hover:underline">&lt;{mail.email}&gt;</span>
                                    <span className="text-[13px] text-[#0b57d0] dark:text-[#a8c7fa] cursor-pointer hover:underline ml-1 font-medium">Se désabonner</span>
                                </div>
                                <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
                                    à moi <span className="text-[10px]">▼</span>
                                </div>
                            </div>
                            {mail.date && (
                                <div className="shrink-0 flex items-center gap-4 text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-2">
                                    <span>{format(new Date(mail.date), "EEE d MMM HH:mm", { timeZone: "Europe/Paris" } as any)} (il y a {Math.max(1, Math.floor((new Date().getTime() - new Date(mail.date).getTime()) / (1000 * 3600 * 24)))} jours)</span>
                                </div>
                            )}
                        </div>
                    </div>

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

                    {/* Decrypt button for encrypted emails */}
                    <div className="px-8 py-1">
                        <DecryptButton
                            body={mail.text}
                            accountId={mail.id}
                            onDecrypted={setDecryptedBody}
                        />
                    </div>

                    <div className="whitespace-pre-wrap px-8 py-2 text-[14px] leading-relaxed text-[#202124] dark:text-[#e3e3e3]">
                        {decryptedBody ?? mail.text}
                    </div>

                    {/* Inline attachment preview (IDEA-037) */}
                    {(mail as any).attachments?.length > 0 && (
                        <AttachmentPreviewBar
                            attachments={(mail as any).attachments as Attachment[]}
                            onDownload={(att) => window.open(att.url, "_blank")}
                            onDownloadAll={() => (mail as any).attachments?.forEach((a: Attachment) => window.open(a.url, "_blank"))}
                        />
                    )}

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-3 px-8 py-6 mb-4">
                        <Button variant="outline" className="rounded-full px-5 h-9 text-[#444746] dark:text-[#e3e3e3] border-[#747775] dark:border-[#5f6368] font-medium hover:bg-[#f3f7fe] dark:hover:bg-[#3c4043] transition-colors" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
                            <Reply className="h-4 w-4 mr-2" />
                            Répondre
                        </Button>
                        <Button variant="outline" className="rounded-full px-5 h-9 text-[#444746] dark:text-[#e3e3e3] border-[#747775] dark:border-[#5f6368] font-medium hover:bg-[#f3f7fe] dark:hover:bg-[#3c4043] transition-colors">
                            <Forward className="h-4 w-4 mr-2" />
                            Transférer
                        </Button>
                    </div>

                    {/* Entity Crosslinks */}
                    {mail && (
                      <div className="px-8 py-4 border-t border-border/50">
                        <EntityLinks entityType="mail_message" entityId={mail.id} />
                      </div>
                    )}

                    {/* Reply Composer Area */}
                    <div className="mt-auto px-6 py-4 bg-gray-50/50 dark:bg-gray-900/30 border-t border-white/20 dark:border-white/5 rounded-b-2xl backdrop-blur-sm">
                        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                            {smartReplies.length === 0 ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-sm font-semibold text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-800/60 bg-background/80 dark:bg-gray-900/80 hover:bg-purple-50 dark:hover:bg-purple-900/40 rounded-xl shadow-sm transition-all h-9 px-4"
                                    onClick={generateSmartReplies}
                                    disabled={isRepliesLoading}
                                >
                                    {isRepliesLoading ? (
                                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 mr-2 " />
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
                                        className="whitespace-nowrap rounded-xl border border-purple-200/80 dark:border-purple-800/60 bg-background/95 dark:bg-gray-900/95 shadow-sm px-5 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-purple-300 transition-all duration-200 transform hover:-translate-y-0.5"
                                    >
                                        {reply}
                                    </button>
                                ))
                            )}
                        </div>
                        <form className="mt-2">
                            <div className="grid gap-3 relative">
                                <Textarea
                                    className="p-4 pt-5 pb-14 min-h-[140px] resize-none border border-gray-200/80 dark:border-gray-800/80 bg-background/80 dark:bg-gray-950/80 focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:border-transparent rounded-2xl shadow-sm transition-all text-[15px] leading-relaxed block w-full placeholder:text-gray-400"
                                    placeholder={`Write your reply to ${mail.name}...`}
                                    value={replyText + (interimReplyText ? (replyText && !replyText.endsWith(' ') ? ' ' : '') + interimReplyText : '')}
                                    onChange={(e) => {
                                        setReplyText(e.target.value)
                                        setInterimReplyText("")
                                    }}
                                />
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                                    <div className="text-[13px] font-medium text-gray-500/80 dark:text-gray-400/80 flex items-center gap-1.5 pl-2 pointer-events-auto">
                                        <Bot className="w-4 h-4" />
                                        <span>AI available via '/'</span>
                                    </div>
                                    {sending ? (
                                        <div className="flex items-center gap-3 bg-background/90 dark:bg-gray-900/90 py-1.5 px-2 rounded-xl border border-gray-100 dark:border-gray-800 backdrop-blur-md shadow-sm pointer-events-auto">
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
                                            <VoiceInput 
                                                onTranscription={(text, isFinal) => {
                                                    if (isFinal) {
                                                        setReplyText((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text + ' ')
                                                        setInterimReplyText('')
                                                    } else {
                                                        setInterimReplyText(text)
                                                    }
                                                }}
                                                className="bg-background hover:bg-gray-100 text-gray-500 shadow-sm border border-gray-100 h-9 w-9 [&>svg]:w-4 [&>svg]:h-4 mr-1"
                                                title="Dicter la réponse"
                                            />
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
                                            <ScheduleSendPopup
                                                onSchedule={(sendAt) => {
                                                    // Store scheduled send time for later use
                                                    toast.success(`Reply scheduled for ${sendAt.toLocaleString()}`)
                                                }}
                                                disabled={!(replyText.trim() || interimReplyText.trim())}
                                            />
                                            <Button
                                                onClick={handleSend}
                                                size="sm"
                                                disabled={!(replyText.trim() || interimReplyText.trim())}
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

            {/* Email-to-Task Dialog */}
            {mail && (
                <EmailToTaskDialog
                    open={showTaskDialog}
                    onOpenChange={setShowTaskDialog}
                    emailSubject={mail.subject}
                    emailBody={mail.text}
                    emailFrom={mail.name}
                    emailId={mail.id}
                />
            )}
        </div>
    )
}
