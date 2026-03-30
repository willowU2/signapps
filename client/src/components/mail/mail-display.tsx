import { SpinnerInfinity } from 'spinners-react';
import { format } from "date-fns"
import { Archive, ArchiveX, Clock, Forward, MoreVertical, Reply, ReplyAll, Trash2, Sparkles, Bot, X, Send, FileText, Link2, CheckSquare, CalendarPlus, Wand2, FolderDown, UserCircle, Link as LinkIcon, AlertTriangle, Languages, Loader2 } from 'lucide-react';
import { AttachmentPreviewBar, type Attachment } from "./attachment-preview"
import { ScheduleSendPopup } from "./schedule-send-popup"
import { SnoozeDatePicker } from "./snooze-picker"
import { EntityLinks } from '@/components/crosslinks/EntityLinks';
import { PgpStatusBadges, DecryptButton } from './pgp-indicator';
import { EmailToTaskDialog } from './email-to-task-dialog';
import { LinkedEntitiesPanel } from '@/components/interop/LinkedEntitiesPanel';
import { extractActionItems } from '@/components/interop/UnifiedSearch';
import { LabelTagSyncBadges } from '@/components/interop/LabelTagSync';
import { linksApi } from '@/lib/api/crosslinks';
import { contactsApi } from '@/lib/api/contacts';
import { driveApi } from '@/lib/api/drive';
import { dealsApi, type Deal, STAGE_LABELS } from '@/lib/api/crm';

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
import { mailApi } from "@/lib/api-mail"
import { aiMailApi } from "@/lib/api/ai-mail"
import { toast } from "sonner"
import { useState, useCallback, useEffect, useRef } from "react"
import { useAiStream } from "@/hooks/use-ai-stream"
import { VoiceInput } from "@/components/ui/voice-input"
import { ConversationThreadView, groupByThread } from "./conversation-thread"

// ─── Idea 34: action detection helpers ──────────────────────────────────────
function detectActions(text: string): string[] {
    const actions: string[] = []
    // Date patterns
    const dateRe = /\b(le \d{1,2}\s+\w+|vendredi prochain|lundi prochain|mardi prochain|mercredi prochain|jeudi prochain|samedi prochain|avant le|deadline\s*:\s*[\w\s]+)/gi
    let m: RegExpExecArray | null
    while ((m = dateRe.exec(text)) !== null) {
        const hit = m[0].trim().slice(0, 60)
        if (!actions.includes(hit)) actions.push(hit)
    }
    // Action verbs
    const actionRe = /\b(merci de [^.,\n]{5,50}|pourriez-vous [^.,\n]{5,50}|n'oubliez pas de [^.,\n]{5,50}|please [^.,\n]{5,50}|could you [^.,\n]{5,50})/gi
    while ((m = actionRe.exec(text)) !== null) {
        const hit = m[0].trim().slice(0, 60)
        if (!actions.includes(hit)) actions.push(hit)
    }
    // @mentions
    const mentionRe = /@[\w.-]+/g
    while ((m = mentionRe.exec(text)) !== null) {
        if (!actions.includes(m[0])) actions.push(m[0])
    }
    return actions.slice(0, 6)
}

// ─── A4: simple language heuristic ──────────────────────────────────────────
const FRENCH_WORDS = /\b(bonjour|merci|veuillez|cordialement|vous|nous|les|des|et|est|avec|pour|dans|sur|par|que|qui|mais|donc|car)\b/gi
const GERMAN_WORDS = /\b(bitte|danke|sehr|hallo|guten|mit|von|und|die|der|das|sie|ich|für|auf|nicht|auch|ist)\b/gi
const SPANISH_WORDS = /\b(hola|gracias|favor|buenos|estimado|para|con|los|las|una|que|por|como|este|tiene|puede)\b/gi

function detectEmailLanguage(text: string): string {
    if (!text) return 'unknown'
    const lower = text.toLowerCase()
    const frMatch = (lower.match(FRENCH_WORDS) || []).length
    const deMatch = (lower.match(GERMAN_WORDS) || []).length
    const esMatch = (lower.match(SPANISH_WORDS) || []).length
    const maxMatch = Math.max(frMatch, deMatch, esMatch)
    if (maxMatch < 3) return 'EN' // default English if no strong signal
    if (frMatch === maxMatch) return 'FR'
    if (deMatch === maxMatch) return 'DE'
    if (esMatch === maxMatch) return 'ES'
    return 'EN'
}

// ─── Idea 39: unsubscribe URL detection ─────────────────────────────────────
function detectUnsubscribe(html: string): string | null {
    const re = /https?:\/\/[^\s"'<>]+(?:unsubscribe|se-d%C3%A9sabonner|desinscrire|désabonner|opt.?out)[^\s"'<>]*/i
    const m = html.match(re)
    return m ? m[0] : null
}

interface MailDisplayProps {
    mail: Mail | null
    onSnooze?: (id: string, time: string) => void
    onArchive?: (id: string) => void
    onDelete?: (id: string) => void
    accountId?: string
    /** Full list of emails in the current folder — used to build thread view */
    allMails?: Mail[]
    onSelectMail?: (id: string) => void
}

export function MailDisplay({ mail, onSnooze, onArchive, onDelete, accountId, allMails, onSelectMail }: MailDisplayProps) {
    const [replyText, setReplyText] = useState("")
    const [smartReplies, setSmartReplies] = useState<string[]>([])
    const [isRepliesLoading, setIsRepliesLoading] = useState(false)

    // Idea 36: CRM context for smart replies
    const [crmDeals, setCrmDeals] = useState<Deal[]>([])

    // Streaming summary
    const { stream, stop, isStreaming } = useAiStream()
    const [summaryText, setSummaryText] = useState("")
    const [showSummary, setShowSummary] = useState(false)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [interimReplyText, setInterimReplyText] = useState("")

    // Email-to-task dialog
    const [showTaskDialog, setShowTaskDialog] = useState(false)

    // Interop: extract action items
    const [extracting, setExtracting] = useState(false)

    const handleExtractActions = async () => {
        if (!mail) return
        setExtracting(true)
        try {
            const API = process.env.NEXT_PUBLIC_CALENDAR_API || 'http://localhost:3011/api/v1'
            const calsRes = await fetch(`${API}/calendars`, { credentials: 'include' })
            const cals = await calsRes.json()
            const calId = (cals.data ?? cals)?.[0]?.id ?? 'default'
            const count = await extractActionItems(mail.text, mail.id, calId)
            if (count > 0) toast.success(`${count} action(s) extraite(s) en tâches`)
            else toast.info("Aucune action détectée dans cet email")
        } catch {
            toast.error("Impossible d'extraire les actions")
        } finally { setExtracting(false) }
    }

    // PGP decryption
    const [decryptedBody, setDecryptedBody] = useState<string | null>(null)

    // Idea 34: task detection chips
    const detectedActions = mail ? detectActions(mail.text) : []
    const [taskChipText, setTaskChipText] = useState<string | null>(null)

    // Idea 39: unsubscribe link detection
    const unsubscribeUrl = mail ? detectUnsubscribe(mail.body_html || mail.text || '') : null

    // Idea 41: Associate to deal dialog
    const [showDealDialog, setShowDealDialog] = useState(false)
    const [dealSearchQ, setDealSearchQ] = useState("")
    const [dealLinking, setDealLinking] = useState(false)

    // Idea 42: Contact hover popover
    const [contactInfo, setContactInfo] = useState<{ name: string; email: string; phone?: string } | null>(null)
    const [contactLoading, setContactLoading] = useState(false)
    const [showContactPopover, setShowContactPopover] = useState(false)
    const contactHoverTimeout = useRef<NodeJS.Timeout | null>(null)

    // Idea 43: Save attachment to Drive
    const [savingAtt, setSavingAtt] = useState<string | null>(null)

    // A4: Translation
    const [translating, setTranslating] = useState(false)
    const [translatedText, setTranslatedText] = useState<string | null>(null)
    const [translatedLang, setTranslatedLang] = useState<string | null>(null)

    // Reset per-mail state when mail changes
    useEffect(() => {
        setDecryptedBody(null)
        setTaskChipText(null)
        setShowDealDialog(false)
        setContactInfo(null)
        setShowContactPopover(false)
        setCrmDeals([])
        setTranslatedText(null)
        setTranslatedLang(null)
    }, [mail?.id])

    // Idea 36: Fetch CRM deals for the current sender
    useEffect(() => {
        if (!mail?.email) return
        const senderEmail = mail.email.toLowerCase()
        // Search contacts by email to find a matching contactId
        contactsApi.list().then((res) => {
            const contacts = res?.data ?? []
            const match = Array.isArray(contacts)
                ? contacts.find((c) => c.email?.toLowerCase() === senderEmail)
                : null
            if (!match) return
            // Scan all deals for ones linked to this contact
            const deals = dealsApi.list().filter(
                (d) =>
                    d.contactId === match.id ||
                    d.contactEmail?.toLowerCase() === senderEmail
            )
            setCrmDeals(deals)
        }).catch(() => { /* silent — CRM context is optional */ })
    }, [mail?.email])

    // A4: translate email body
    const handleTranslate = useCallback(async (targetLang: string) => {
        if (!mail) return
        const body = mail.body_html || mail.text || ''
        if (!body.trim()) {
            toast.info("Email vide — rien à traduire.")
            return
        }
        setTranslating(true)
        setTranslatedText(null)
        setTranslatedLang(null)
        try {
            const res = await aiMailApi.translate(body, targetLang)
            const translated = res?.data?.answer ?? ""
            if (!translated) throw new Error("Réponse vide")
            setTranslatedText(translated)
            setTranslatedLang(targetLang)
        } catch {
            toast.error("Impossible de traduire cet email.")
        } finally {
            setTranslating(false)
        }
    }, [mail])

    // Bug 2: HTML body toggle
    const [showHtml, setShowHtml] = useState(true)

    // Bug 1: Reply mode — 'reply' | 'replyAll' | 'forward'
    const [replyMode, setReplyMode] = useState<'reply' | 'replyAll' | 'forward'>('reply')

    // Undo Send State
    const [sending, setSending] = useState(false)
    const [countdown, setCountdown] = useState(5)
    const undoCancelledRef = useRef(false)

    // Handle Undo Send Timer — Bug 1: actually calls the API after countdown
    useEffect(() => {
        let timer: NodeJS.Timeout
        if (sending && countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000)
        } else if (sending && countdown === 0) {
            // Fire the actual API call
            const sendReply = async () => {
                if (!mail) return
                try {
                    const effectiveAccountId = accountId || mail.account_id
                    let recipient = mail.email
                    let subject = `Re: ${mail.subject}`

                    if (replyMode === 'replyAll') {
                        // For reply-all, include original sender (same as reply for now, cc others if available)
                        recipient = mail.email
                        subject = `Re: ${mail.subject}`
                    } else if (replyMode === 'forward') {
                        // Forward: user fills recipient in replyText header — for now open as empty forward
                        subject = `Fwd: ${mail.subject}`
                    }

                    await mailApi.send({
                        account_id: effectiveAccountId || '',
                        recipient,
                        subject,
                        body_text: replyText,
                        in_reply_to: mail.message_id || mail.id,
                    })
                    toast.success("Réponse envoyée !")
                } catch {
                    toast.error("Échec de l'envoi. Réessayez.")
                } finally {
                    setSending(false)
                    setReplyText("")
                    setSmartReplies([])
                    undoCancelledRef.current = false
                }
            }
            sendReply()
        }
        return () => clearTimeout(timer)
    }, [sending, countdown, mail, replyText, replyMode, accountId])

    const handleSend = (e: React.MouseEvent) => {
        e.preventDefault()
        if (!replyText.trim()) return
        undoCancelledRef.current = false
        setSending(true)
        setCountdown(5)
    }

    const handleUndo = () => {
        undoCancelledRef.current = true
        setSending(false)
        setCountdown(5)
        toast("Envoi annulé.")
    }

    // Bug 1: Toolbar reply/replyAll/forward scroll to reply box and set mode
    const scrollToReplyBox = (mode: 'reply' | 'replyAll' | 'forward') => {
        setReplyMode(mode)
        setTimeout(() => {
            const textarea = document.querySelector('textarea[placeholder^="Write your reply"]') as HTMLTextAreaElement
            if (textarea) textarea.focus()
        }, 50)
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

        // Idea 36: build CRM context snippet to inject into the prompt
        let crmContext = ""
        if (crmDeals.length > 0) {
            const dealLines = crmDeals.map((d) => {
                const stage = STAGE_LABELS[d.stage] ?? d.stage
                const overdue = d.closeDate && new Date(d.closeDate) < new Date()
                const status = overdue ? "en retard" : stage
                return `- ${d.title} (${status}, ${d.value}€)`
            }).join("\n")
            crmContext = `\n\nCRM Context (deals with this contact):\n${dealLines}`
        }

        // We will accumulate the stream and split by '|'
        let fullResponse = ""

        try {
            await stream(
                `Generate 3 short, professional reply options for this email. Consider the tone and context.${crmContext}\n\nOutput ONLY the replies separated by '|'.\n\nFrom: ${mail.name}\nSubject: ${mail.subject}\nContent: ${mail.text}`,
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
                    systemPrompt: crmDeals.length > 0
                        ? "You are a professional email assistant with CRM context. Use the deal information to generate contextually appropriate, business-aware reply suggestions in French."
                        : "You are a professional email assistant. Generate contextually appropriate, concise reply suggestions.",
                    language: crmDeals.length > 0 ? "fr" : "en"
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

    // Idea 23: listen for keyboard shortcut events
    useEffect(() => {
        const handleShortcut = (e: Event) => {
            const { action } = (e as CustomEvent).detail
            if (action === "reply") scrollToReplyBox("reply")
            else if (action === "replyAll") scrollToReplyBox("replyAll")
            else if (action === "forward") scrollToReplyBox("forward")
        }
        window.addEventListener("mail:shortcut", handleShortcut)
        return () => window.removeEventListener("mail:shortcut", handleShortcut)
    }, [])

    // Idea 41: link email to deal
    const handleLinkDeal = async () => {
        if (!mail || !dealSearchQ.trim()) return
        setDealLinking(true)
        try {
            await linksApi.create({
                source_type: 'email',
                source_id: mail.id,
                target_type: 'deal',
                target_id: dealSearchQ.trim(),
                relation: 'related_to',
            })
            toast.success('Email associé au deal.')
            setShowDealDialog(false)
            setDealSearchQ("")
        } catch {
            toast.error("Impossible d'associer au deal.")
        } finally {
            setDealLinking(false) }
    }

    // Idea 42: load contact info on hover
    const handleSenderMouseEnter = async () => {
        if (!mail) return
        if (contactHoverTimeout.current) clearTimeout(contactHoverTimeout.current)
        contactHoverTimeout.current = setTimeout(async () => {
            if (contactInfo) { setShowContactPopover(true); return }
            setContactLoading(true)
            setShowContactPopover(true)
            try {
                const contacts = await contactsApi.list()
                const match = contacts.data?.find((c: any) =>
                    c.email?.toLowerCase() === mail.email.toLowerCase()
                )
                if (match) {
                    setContactInfo({ name: `${match.first_name} ${match.last_name}`.trim(), email: match.email || mail.email, phone: match.phone })
                } else {
                    setContactInfo({ name: mail.name, email: mail.email })
                }
            } catch {
                setContactInfo({ name: mail.name, email: mail.email })
            } finally {
                setContactLoading(false)
            }
        }, 400)
    }

    const handleSenderMouseLeave = () => {
        if (contactHoverTimeout.current) clearTimeout(contactHoverTimeout.current)
        // Small delay before hiding so user can move into the popover
        contactHoverTimeout.current = setTimeout(() => setShowContactPopover(false), 300)
    }

    // Idea 43: save attachment to drive
    const handleSaveAttachmentToDrive = async (att: Attachment) => {
        setSavingAtt(att.url)
        try {
            await driveApi.createNode({
                parent_id: null,
                name: att.name,
                node_type: 'file',
                target_id: null,
                mime_type: att.mimeType,
                size: att.size,
            })
            toast.success(`"${att.name}" sauvegardé dans Drive.`)
        } catch {
            toast.error('Impossible de sauvegarder dans Drive.')
        } finally {
            setSavingAtt(null)
        }
    }

    return (
        <div className="flex h-full flex-col bg-background dark:bg-gray-950 relative">
            {/* Top Action Bar */}
            <div className="sticky top-0 z-20 shadow-sm border-b border-border dark:border-border">
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
                            <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mr-2 h-7 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-900/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition-all font-semibold"
                                onClick={() => setShowTaskDialog(true)}
                            >
                                <CheckSquare className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                                Creer une tache
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mr-2 h-7 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 transition-all font-semibold"
                                onClick={handleExtractActions}
                                disabled={extracting}
                            >
                                <Wand2 className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                {extracting ? 'Extraction…' : 'Extraire actions'}
                            </Button>
                            </>
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
                        {/* A4: Translate button */}
                        {mail && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mr-2 h-7 text-sky-600 dark:text-sky-400 border-sky-200/60 dark:border-sky-800/60 bg-sky-50/60 dark:bg-sky-900/30 hover:bg-sky-100/80 dark:hover:bg-sky-900/50 transition-all font-semibold"
                                        disabled={translating}
                                    >
                                        {translating ? (
                                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-sky-500" />
                                        ) : (
                                            <Languages className="h-3.5 w-3.5 mr-2 text-sky-500" />
                                        )}
                                        Traduire
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {["FR", "EN", "ES", "DE"].map((lang) => (
                                        <DropdownMenuItem key={lang} onClick={() => handleTranslate(lang)}>
                                            {lang}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <ToolbarButton disabled={!mail} title="Reply" onClick={() => scrollToReplyBox('reply')}>
                            <Reply className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton disabled={!mail} title="Reply all" onClick={() => scrollToReplyBox('replyAll')}>
                            <ReplyAll className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton disabled={!mail} title="Forward" onClick={() => scrollToReplyBox('forward')}>
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
                            <h2 className="font-normal text-[22px] leading-tight text-foreground">{mail.subject}</h2>
                            <PgpStatusBadges body={mail.text} accountId={mail.id} />
                            <span className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50 font-medium leading-none flex items-center h-5">Externe</span>
                            <span className="bg-muted text-muted-foreground text-xs px-2 rounded flex items-center gap-1 cursor-pointer hover:bg-muted/80 transition-colors leading-none h-5">Boîte de réception <X className="h-3 w-3" /></span>
                        </div>

                        <div className="flex items-start gap-4 text-sm w-full">
                            <Avatar className="h-10 w-10 mt-0.5">
                                <AvatarImage alt={mail.name} src={`https://avatar.vercel.sh/${mail.email}.png`} />
                                <AvatarFallback className="bg-blue-600 text-white font-medium text-lg">
                                    {mail.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-0 flex-1">
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {/* Idea 42: sender hover → contact card */}
                                    <div className="relative inline-block">
                                        <span
                                            className="font-bold text-[14px] text-foreground cursor-default"
                                            onMouseEnter={handleSenderMouseEnter}
                                            onMouseLeave={handleSenderMouseLeave}
                                        >
                                            {mail.name}
                                        </span>
                                        {showContactPopover && (
                                            <div
                                                className="absolute top-6 left-0 z-50 min-w-[220px] bg-popover border border-border rounded-xl shadow-xl p-3 text-sm"
                                                onMouseEnter={() => { if (contactHoverTimeout.current) clearTimeout(contactHoverTimeout.current); setShowContactPopover(true) }}
                                                onMouseLeave={handleSenderMouseLeave}
                                            >
                                                {contactLoading ? (
                                                    <p className="text-xs text-muted-foreground">Chargement…</p>
                                                ) : contactInfo ? (
                                                    <div className="space-y-1">
                                                        <p className="font-semibold text-foreground">{contactInfo.name}</p>
                                                        <p className="text-xs text-muted-foreground">{contactInfo.email}</p>
                                                        {contactInfo.phone && <p className="text-xs text-muted-foreground">{contactInfo.phone}</p>}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <p className="font-semibold">{mail.name}</p>
                                                        <p className="text-xs text-muted-foreground">{mail.email}</p>
                                                        <button className="text-xs text-primary hover:underline mt-1">+ Ajouter aux contacts</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground font-normal cursor-pointer hover:underline">&lt;{mail.email}&gt;</span>
                                    {/* Idea 41: Associate to deal button */}
                                    <button
                                        type="button"
                                        onClick={() => setShowDealDialog(v => !v)}
                                        className="text-[12px] text-blue-600 dark:text-blue-400 hover:underline ml-1 font-medium flex items-center gap-0.5"
                                        title="Associer au deal CRM"
                                    >
                                        <LinkIcon className="h-3 w-3" />
                                        Associer au deal
                                    </button>
                                </div>
                                {/* Idea 41: Deal link inline form */}
                                {showDealDialog && (
                                    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20">
                                        <input
                                            type="text"
                                            value={dealSearchQ}
                                            onChange={e => setDealSearchQ(e.target.value)}
                                            placeholder="ID ou nom du deal…"
                                            className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        />
                                        <Button size="sm" className="h-6 text-xs px-2" onClick={handleLinkDeal} disabled={dealLinking || !dealSearchQ.trim()}>
                                            {dealLinking ? '…' : 'Lier'}
                                        </Button>
                                        <button type="button" onClick={() => setShowDealDialog(false)} className="text-muted-foreground hover:text-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    à moi <span className="text-[10px]">▼</span>
                                </div>
                            </div>
                            {mail.date && (
                                <div className="shrink-0 flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                    <span>{new Date(mail.date).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} (il y a {Math.max(1, Math.floor((new Date().getTime() - new Date(mail.date).getTime()) / (1000 * 3600 * 24)))} jours)</span>
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

                    {/* Bug 2: HTML/plain-text toggle + sandboxed iframe for HTML emails */}
                    {mail.body_html && (
                        <div className="px-8 pt-2 pb-0 flex justify-end">
                            <button
                                onClick={() => setShowHtml(v => !v)}
                                className="text-xs text-primary hover:underline"
                            >
                                {showHtml ? "Voir en texte brut" : "Voir en HTML"}
                            </button>
                        </div>
                    )}
                    {!decryptedBody && mail.body_html && showHtml ? (
                        <div className="px-8 py-2">
                            <iframe
                                sandbox="allow-same-origin"
                                srcDoc={mail.body_html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')}
                                className="w-full border-0 rounded"
                                style={{ minHeight: '300px' }}
                                onLoad={(e) => {
                                    const iframe = e.currentTarget
                                    if (iframe.contentDocument?.body) {
                                        iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px'
                                    }
                                }}
                                title="Email content"
                            />
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap px-8 py-2 text-[14px] leading-relaxed text-foreground">
                            {decryptedBody ?? mail.text}
                        </div>
                    )}

                    {/* A4: AI Translation panel */}
                    {translatedText && translatedLang && (
                        <div className="mx-8 mt-3 rounded-xl border border-sky-200/60 dark:border-sky-800/60 bg-sky-50/60 dark:bg-sky-900/20 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Languages className="h-4 w-4 text-sky-500" />
                                    <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                                        Traduction AI — {translatedLang}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground italic">
                                        (langue détectée : {detectEmailLanguage(mail?.text || '')})
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setTranslatedText(null); setTranslatedLang(null) }}
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Fermer la traduction"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
                                {translatedText}
                            </p>
                        </div>
                    )}

                    {/* Idea 39: Newsletter / unsubscribe banner */}
                    {unsubscribeUrl && (
                        <div className="mx-8 mt-2 mb-1 flex items-center gap-3 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-sm text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                            <span className="flex-1 font-medium">Newsletter détectée</span>
                            <a
                                href={unsubscribeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold underline hover:no-underline text-amber-700 dark:text-amber-400"
                            >
                                Se désabonner
                            </a>
                        </div>
                    )}

                    {/* Idea 34: Task detection chips */}
                    {detectedActions.length > 0 && (
                        <div className="px-8 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Actions détectées</p>
                            <div className="flex flex-wrap gap-1.5">
                                {detectedActions.map((action, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => { setTaskChipText(action); setShowTaskDialog(true) }}
                                        className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                                    >
                                        {action}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Feature 25: Label → task tag sync badges */}
                    {mail.labels?.length > 0 && (
                        <div className="px-8 py-1">
                            <LabelTagSyncBadges emailId={mail.id} labels={mail.labels} />
                        </div>
                    )}

                    {/* Inline attachment preview (IDEA-037) + Idea 43: Save to Drive */}
                    {mail.attachments && mail.attachments.length > 0 && (
                        <>
                        <AttachmentPreviewBar
                            attachments={mail.attachments}
                            onDownload={(att) => window.open(att.url, "_blank")}
                            onDownloadAll={() => mail.attachments?.forEach((a) => window.open(a.url, "_blank"))}
                        />
                        <div className="px-8 pb-2 flex flex-wrap gap-2">
                            {mail.attachments.map((att) => (
                                <button
                                    key={att.id}
                                    type="button"
                                    disabled={savingAtt === att.url}
                                    onClick={() => handleSaveAttachmentToDrive(att)}
                                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                                    title={`Sauvegarder "${att.name}" dans Drive`}
                                >
                                    <FolderDown className="h-3 w-3" />
                                    {savingAtt === att.url ? 'Sauvegarde…' : `Drive: ${att.name}`}
                                </button>
                            ))}
                        </div>
                        </>
                    )}

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-3 px-8 py-6 mb-4">
                        <Button variant="outline" className="rounded-full px-5 h-9 text-foreground/80 border-border font-medium hover:bg-accent transition-colors" onClick={() => scrollToReplyBox('reply')}>
                            <Reply className="h-4 w-4 mr-2" />
                            Répondre
                        </Button>
                        <Button variant="outline" className="rounded-full px-5 h-9 text-foreground/80 border-border font-medium hover:bg-accent transition-colors" onClick={() => scrollToReplyBox('forward')}>
                            <Forward className="h-4 w-4 mr-2" />
                            Transférer
                        </Button>
                    </div>

                    {/* M6: Conversation thread view — shown when email is part of a thread */}
                    {(() => {
                        const threadId = mail.thread_id
                        const inReplyTo = mail.in_reply_to
                        const hasThread = !!(threadId || inReplyTo)
                        if (!hasThread || !allMails || allMails.length === 0) return null
                        const threads = groupByThread(allMails)
                        const currentThread = threads.find((t) =>
                            threadId
                                ? t.threadId === threadId
                                : t.messages.some((m) => m.id === mail.id)
                        )
                        if (!currentThread || currentThread.messages.length <= 1) return null
                        return (
                            <div className="mx-8 mt-4 mb-2 rounded-xl border border-border overflow-hidden">
                                <div className="px-4 py-2 bg-muted/60 border-b border-border">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Thread ({currentThread.messages.length} messages)
                                    </span>
                                </div>
                                <ConversationThreadView
                                    threads={[currentThread]}
                                    selectedId={mail.id}
                                    onSelect={(id) => onSelectMail?.(id)}
                                />
                            </div>
                        )
                    })()}

                    {/* Entity Crosslinks + Interop Links */}
                    {mail && (
                      <div className="px-8 py-4 border-t border-border/50 space-y-3">
                        <EntityLinks entityType="mail_message" entityId={mail.id} />
                        <LinkedEntitiesPanel entityType="mail" entityId={mail.id} />
                      </div>
                    )}

                    {/* Reply Composer Area */}
                    <div className="mt-auto px-6 py-4 bg-muted/50 dark:bg-gray-900/30 border-t border-white/20 dark:border-white/5 rounded-b-2xl backdrop-blur-sm">
                        {/* Idea 36: CRM context badge */}
                        {crmDeals.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {crmDeals.map((deal) => {
                                    const isOverdue = deal.closeDate && new Date(deal.closeDate) < new Date()
                                    const stageLabel = STAGE_LABELS[deal.stage] ?? deal.stage
                                    return (
                                        <span
                                            key={deal.id}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-blue-200/80 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                                        >
                                            <Link2 className="h-3 w-3 shrink-0" />
                                            <span className="font-bold text-blue-500 dark:text-blue-400 mr-0.5">CRM</span>
                                            {deal.title} — {isOverdue ? (
                                                <span className="text-orange-600 dark:text-orange-400">en retard</span>
                                            ) : stageLabel} — {deal.value.toLocaleString("fr-FR")}€
                                        </span>
                                    )
                                })}
                            </div>
                        )}
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
                                    className="p-4 pt-5 pb-14 min-h-[140px] resize-none border border-border/80 dark:border-gray-800/80 bg-background/80 dark:bg-gray-950/80 focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:border-transparent rounded-2xl shadow-sm transition-all text-[15px] leading-relaxed block w-full placeholder:text-gray-400"
                                    placeholder={replyMode === 'forward' ? `Forward to… (add recipient above, then type message)` : replyMode === 'replyAll' ? `Reply all to ${mail.name}...` : `Write your reply to ${mail.name}...`}
                                    value={replyText + (interimReplyText ? (replyText && !replyText.endsWith(' ') ? ' ' : '') + interimReplyText : '')}
                                    onChange={(e) => {
                                        setReplyText(e.target.value)
                                        setInterimReplyText("")
                                    }}
                                />
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                                    <div className="text-[13px] font-medium text-muted-foreground/80 dark:text-gray-400/80 flex items-center gap-1.5 pl-2 pointer-events-auto">
                                        <Bot className="w-4 h-4" />
                                        <span>AI available via '/'</span>
                                    </div>
                                    {sending ? (
                                        <div className="flex items-center gap-3 bg-background/90 dark:bg-gray-900/90 py-1.5 px-2 rounded-xl border border-gray-100 dark:border-gray-800 backdrop-blur-md shadow-sm pointer-events-auto">
                                            <span className="text-sm font-bold text-muted-foreground dark:text-gray-300 ml-2">
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
                                                className="bg-background hover:bg-muted text-muted-foreground shadow-sm border border-gray-100 h-9 w-9 [&>svg]:w-4 [&>svg]:h-4 mr-1"
                                                title="Dicter la réponse"
                                            />
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground hover:text-foreground hover:bg-muted/80 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800/80 rounded-xl h-9 px-3 transition-colors"
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
                                                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 h-9 shadow-md hover:shadow-lg transition-all"
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
                    onOpenChange={(v) => { setShowTaskDialog(v); if (!v) setTaskChipText(null) }}
                    emailSubject={taskChipText ? `[Action] ${taskChipText}` : mail.subject}
                    emailBody={mail.text}
                    emailFrom={mail.name}
                    emailId={mail.id}
                />
            )}
        </div>
    )
}
