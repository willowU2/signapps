"use client"

import * as React from "react"
import { useEffect, useRef, useState, useCallback, useTransition } from "react"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { usePageTitle } from "@/hooks/use-page-title"
import {
    Inbox,
    File,
    Send,
    Star,
    Clock,
    ChevronDown,
    ChevronRight,
    Plus,
    Pencil,
    Tag,
    Sparkles,
    Search,
    X,
    PanelLeftClose,
    PanelLeftOpen,
    Receipt,
    Newspaper,
    User,
    FolderKanban,
    CalendarPlus,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MailDisplay } from "@/components/mail/mail-display"
import { MailList } from "@/components/mail/mail-list"
import { MailNav } from "@/components/mail/mail-nav"
import { ComposeAiDialog } from "@/components/mail/compose-ai-dialog"
import { ComposeRichDialog } from "@/components/mail/compose-rich-dialog"
import { MailAddons } from "@/components/mail/mail-addons"
import { AccountSwitcher } from "@/components/mail/account-switcher"
import { EmailToEventDialog } from "@/components/interop/EmailToEventDialog"

import { WorkspaceHeader } from "@/components/mail/workspace-header"
import { UnifiedInbox } from "@/components/mail/unified-inbox"
import type { Mail } from "@/lib/data/mail"
import {
    useMailList,
    useSelectedMailId,
    useSelectedMail,
    useMailUIState,
    useMailUIActions,
    useMailSelectionActions,
    useMailDataActions,
} from "@/lib/store/mail-store"
import { mailApi, accountApi, searchApi, labelApi, statsApi, folderApi, type MailLabel, type MailStats } from "@/lib/api-mail"
import { cn } from "@/lib/utils"
import { WorkspaceShell } from "@/components/layout/workspace-shell"
import { getMailCache, setMailCache } from "@/lib/mail/mail-cache"

// ── Density types ─────────────────────────────────────────────────────────────
type Density = "compact" | "default" | "spacious"

function getDensityClass(density: Density): string {
    switch (density) {
        case "compact": return "mail-density-compact"
        case "spacious": return "mail-density-spacious"
        default: return "mail-density-default"
    }
}

// ── Advanced search parser ────────────────────────────────────────────────────
interface ParsedSearch {
    q: string
    from?: string
    to?: string
    has_attachments?: boolean
    is_unread?: boolean
    after?: string
}

function parseSearchQuery(raw: string): ParsedSearch {
    const result: ParsedSearch = { q: "" }
    const tokens: string[] = []
    const parts = raw.split(/\s+/)
    for (const part of parts) {
        if (part.startsWith("from:")) result.from = part.slice(5)
        else if (part.startsWith("to:")) result.to = part.slice(3)
        else if (part === "has:attachment" || part === "has:attachments") result.has_attachments = true
        else if (part === "is:unread") result.is_unread = true
        else if (part.startsWith("after:")) result.after = part.slice(6)
        else tokens.push(part)
    }
    result.q = tokens.join(" ").trim()
    return result
}

export default function MailPage() {
    usePageTitle('Mail')
    // Zustand store hooks
    const storeMailList = useMailList()
    const selectedId = useSelectedMailId()
    const selectedMail = useSelectedMail()
    const { composeAiOpen, composeRichOpen, labelsExpanded } = useMailUIState()
    const { setComposeAiOpen, setComposeRichOpen, toggleLabelsExpanded } = useMailUIActions()
    const { setSelectedId, clearSelection } = useMailSelectionActions()
    const { setMailList, removeMail } = useMailDataActions()

    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Mail[] | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mailContainerRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const [, startRefreshTransition] = useTransition()

    const [activeAccountId, setActiveAccountId] = useState<string | undefined>(undefined)
    const [accounts, setAccounts] = useState<{ id: string; name: string; email: string; icon: string; provider: "gmail" | "outlook" | "custom" }[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const [labels, setLabels] = useState<MailLabel[]>([])
    const [labelsLoading, setLabelsLoading] = useState(false)

    // Idea 13: Collapsible sidebar
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    // Unified inbox view — default when multiple accounts
    const [unifiedView, setUnifiedView] = useState(false)
    // Auto-switch to unified when accounts load and count > 1
    const [unifiedAutoSwitched, setUnifiedAutoSwitched] = useState(false)

    // C2: Drag email → calendar event drop zone
    const [calDropOver, setCalDropOver] = useState(false)
    const [calDropMailData, setCalDropMailData] = useState<{ id: string; subject: string; sender: string; date: string } | null>(null)
    const [calDropEventOpen, setCalDropEventOpen] = useState(false)

    // Idea 32: Smart folder active filter
    const [smartFolderFilter, setSmartFolderFilter] = useState<string | null>(null)

    // Idea 16: Density preference
    const [density, setDensity] = useState<Density>(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("mail-density") as Density) || "default"
        }
        return "default"
    })

    // Idea 17: Active filter chips
    const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())

    // Bug 3: Active folder state
    const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts' | 'starred' | 'snoozed'>('inbox')

    // Bug 4: Dynamic counts from API
    const [mailStats, setMailStats] = useState<MailStats | null>(null)

    const mailList = searchResults !== null ? searchResults : storeMailList

    // Idea 17: Apply filter chips to visible mail list
    // Idea 32: Apply smart folder filter
    const filteredMailList = React.useMemo(() => {
        let list = mailList
        // Smart folder keyword filter (Idea 32)
        if (smartFolderFilter) {
            list = list.filter(mail => {
                const subj = mail.subject.toLowerCase()
                const sender = mail.email.toLowerCase()
                if (smartFolderFilter === 'factures') {
                    return /facture|invoice|paiement|payment|reçu|receipt/.test(subj)
                }
                if (smartFolderFilter === 'newsletters') {
                    return /newsletter|news@|digest@|weekly|noreply/.test(sender)
                }
                if (smartFolderFilter === 'projets') {
                    return /projet|project|sprint|milestone|deadline/.test(subj)
                }
                if (smartFolderFilter === 'personnel') {
                    const isBusiness = /facture|invoice|paiement|payment|reçu|receipt|newsletter|news@|digest@|weekly|noreply|projet|project|sprint|milestone|deadline/.test(subj + sender)
                    return !isBusiness
                }
                return true
            })
        }
        if (activeFilters.size === 0) return list
        return list.filter(mail => {
            if (activeFilters.has("unread") && mail.read) return false
            if (activeFilters.has("attachment") && !mail.attachments?.length) return false
            if (activeFilters.has("starred") && !mail.is_starred) return false
            if (activeFilters.has("today")) {
                const today = new Date()
                const mailDate = new Date(mail.date)
                if (
                    mailDate.getDate() !== today.getDate() ||
                    mailDate.getMonth() !== today.getMonth() ||
                    mailDate.getFullYear() !== today.getFullYear()
                ) return false
            }
            if (activeFilters.has("important") && !mail.is_important) return false
            return true
        })
    }, [mailList, activeFilters, smartFolderFilter])

    const toggleFilter = (key: string) => {
        setActiveFilters(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // Idea 16: Persist density
    const setDensityPref = (d: Density) => {
        setDensity(d)
        if (typeof window !== "undefined") localStorage.setItem("mail-density", d)
    }

    // PW2: track whether current list was loaded from cache
    const [fromCache, setFromCache] = useState(false)

    // Bug 3: Folder-aware email loader with PW2 IndexedDB cache
    const loadFolder = useCallback(async (folder: 'inbox' | 'sent' | 'drafts' | 'starred' | 'snoozed') => {
        setIsLoading(true)
        setLoadError(null)
        setFromCache(false)
        try {
            let query: Parameters<typeof mailApi.list>[0] = { limit: 50 }
            if (folder === 'inbox') query.folder_type = 'inbox'
            else if (folder === 'sent') query = { is_starred: undefined, limit: 50, folder_type: 'sent' }
            else if (folder === 'drafts') query.folder_type = 'drafts'
            else if (folder === 'starred') query.is_starred = true
            else if (folder === 'snoozed') query.folder_type = 'inbox' // snoozed emails stay in inbox

            const emails = await mailApi.list(query)
            const uiMails: Mail[] = emails.map(email => ({
                id: email.id,
                name: email.sender_name || email.sender.split('@')[0],
                email: email.sender,
                subject: email.subject || '(Sans objet)',
                text: email.body_text || email.snippet || '',
                body_html: email.body_html,
                date: email.received_at || email.created_at || new Date().toISOString(),
                read: email.is_read ?? false,
                labels: email.labels || [],
                folder: (folder === 'starred' || folder === 'snoozed' ? 'inbox' : folder) as Mail['folder'],
                account_id: email.account_id,
                message_id: email.message_id,
            }))
            setMailList(uiMails)
            // PW2: persist to IndexedDB cache after successful fetch
            setMailCache(folder, uiMails).catch(() => {})
        } catch (err) {
            console.warn('Failed to load folder:', err)
            // PW2: offline fallback — load from IndexedDB cache
            const cached = await getMailCache(folder)
            if (cached && cached.length > 0) {
                setMailList(cached)
                setFromCache(true)
                setLoadError(null)
            } else {
                setLoadError("Le service mail est inaccessible. Vérifiez que le serveur est démarré.")
                setMailList([])
            }
        } finally {
            setIsLoading(false)
        }
    }, [setMailList])

    // Bug 3: Handle folder click
    const handleFolderChange = useCallback((folder: 'inbox' | 'sent' | 'drafts' | 'starred' | 'snoozed') => {
        setActiveFolder(folder)
        clearSelection()
        setSearchQuery("")
        setSearchResults(null)
        setActiveFilters(new Set())
        setSmartFolderFilter(null)
        loadFolder(folder)
    }, [loadFolder, clearSelection])

    const handleRefresh = useCallback(() => {
        startRefreshTransition(async () => {
            try {
                const emails = await mailApi.list({ folder_type: activeFolder === 'starred' || activeFolder === 'snoozed' ? 'inbox' : activeFolder, limit: 50 })
                const uiMails: Mail[] = emails.map(email => ({
                    id: email.id,
                    name: email.sender_name || email.sender.split('@')[0],
                    email: email.sender,
                    subject: email.subject || '(Sans objet)',
                    text: email.body_text || email.snippet || '',
                    body_html: email.body_html,
                    date: email.received_at || email.created_at || new Date().toISOString(),
                    read: email.is_read ?? false,
                    labels: email.labels || [],
                    folder: 'inbox' as const,
                    account_id: email.account_id,
                    message_id: email.message_id,
                }))
                setMailList(uiMails)
            } catch { /* silent on pull-to-refresh failure */ }
        })
    }, [setMailList, startRefreshTransition, activeFolder])

    usePullToRefresh({ onRefresh: handleRefresh, scrollContainerRef: mailContainerRef })

    // Idea 30: Advanced search syntax with parser
    const handleSearch = useCallback((q: string) => {
        setSearchQuery(q)
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        if (!q.trim()) {
            setSearchResults(null)
            return
        }
        searchDebounceRef.current = setTimeout(async () => {
            setIsSearching(true)
            try {
                const parsed = parseSearchQuery(q.trim())
                // Build API params from parsed tokens
                const params: Parameters<typeof searchApi.search>[0] = { q: parsed.q || q.trim(), limit: 50 }
                if (parsed.from) params.from = parsed.from
                if (parsed.to) params.to = parsed.to
                if (parsed.has_attachments) params.has_attachments = true
                if (parsed.is_unread !== undefined) params.is_read = false
                if (parsed.after) params.after = parsed.after

                const emails = await searchApi.search(params)
                const uiMails: Mail[] = emails.map(email => ({
                    id: email.id,
                    name: email.sender_name || email.sender.split('@')[0],
                    email: email.sender,
                    subject: email.subject || '(Sans objet)',
                    text: email.body_text || email.snippet || '',
                    date: email.received_at || email.created_at || new Date().toISOString(),
                    read: email.is_read ?? false,
                    labels: email.labels || [],
                    folder: 'inbox' as const
                }))
                setSearchResults(uiMails)
            } catch (err) {
                console.warn('Échec de la recherche:', err)
                setSearchResults([])
            } finally {
                setIsSearching(false)
            }
        }, 300)
    }, [])

    useEffect(() => {
        const loadLabels = async () => {
            setLabelsLoading(true)
            try {
                const fetchedLabels = await labelApi.list()
                setLabels(fetchedLabels)
            } catch {
                // Keep empty on error
            } finally {
                setLabelsLoading(false)
            }
        }
        loadLabels()
    }, [])

    const loadData = useCallback(async () => {
        setLoadError(null)
        setIsLoading(true)
        try {
            const rawAccounts = await accountApi.list()
            const uiAccounts = rawAccounts.map(a => ({
                id: a.id,
                name: a.email_address.split('@')[0],
                email: a.email_address,
                icon: a.provider,
                provider: a.provider as "gmail" | "outlook" | "custom"
            }))
            setAccounts(uiAccounts)
            if (uiAccounts.length > 0) {
                setActiveAccountId(uiAccounts[0].id)
            }
            // Auto-enable unified view when multiple accounts exist (only on first load)
            if (uiAccounts.length > 1 && !unifiedAutoSwitched) {
                setUnifiedView(true)
                setUnifiedAutoSwitched(true)
            }

            // Bug 4: Fetch stats for dynamic counts
            statsApi.get().then(stats => setMailStats(stats)).catch(() => {/* ignore */})

            const emails = await mailApi.list({ folder_type: 'inbox', limit: 50 })
            const uiMails: Mail[] = emails.map(email => ({
                id: email.id,
                name: email.sender_name || email.sender.split('@')[0],
                email: email.sender,
                subject: email.subject || '(Sans objet)',
                text: email.body_text || email.snippet || '',
                body_html: email.body_html,
                date: email.received_at || email.created_at || new Date().toISOString(),
                read: email.is_read ?? false,
                labels: email.labels || [],
                folder: 'inbox' as const,
                account_id: email.account_id,
                message_id: email.message_id,
            }))
            setMailList(uiMails)
        } catch (err) {
            console.warn('Failed to fetch mail data:', err)
            setLoadError("Le service mail est inaccessible. Vérifiez que le serveur est démarré.")
            setMailList([])
        } finally {
            setIsLoading(false)
        }
    }, [setMailList])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleSnooze = async (id: string, time: string) => {
        let snoozeDate = new Date()
        if (time === "Later today") {
            snoozeDate.setHours(snoozeDate.getHours() + 4)
        } else if (time === "Tomorrow") {
            snoozeDate.setDate(snoozeDate.getDate() + 1)
            snoozeDate.setHours(9, 0, 0, 0)
        } else if (time === "This weekend") {
            const daysToFriday = (5 - snoozeDate.getDay() + 7) % 7 || 7
            snoozeDate.setDate(snoozeDate.getDate() + daysToFriday)
            snoozeDate.setHours(17, 0, 0, 0)
        } else if (time === "Next week") {
            const daysToMonday = (1 - snoozeDate.getDay() + 7) % 7 || 7
            snoozeDate.setDate(snoozeDate.getDate() + daysToMonday)
            snoozeDate.setHours(9, 0, 0, 0)
        }

        try {
            await mailApi.update(id, { snoozed_until: snoozeDate.toISOString() })
            removeMail(id)
            toast.success(`Conversation snoozée jusqu'au ${time}.`)
        } catch {
            toast.error("Impossible de snoozer la conversation.")
        }
    }

    const refreshStats = useCallback(() => {
        statsApi.get().then(stats => setMailStats(stats)).catch(() => {/* ignore */})
    }, [])

    const handleArchive = async (id: string) => {
        try {
            await mailApi.update(id, { is_archived: true })
            removeMail(id)
            toast.success("Conversation archivée.", {
                action: {
                    label: 'Annuler',
                    onClick: async () => {
                        try {
                            await mailApi.update(id, { is_archived: false })
                            loadData()
                            refreshStats()
                        } catch {
                            toast.error("Impossible d'annuler l'archivage.")
                        }
                    },
                },
            })
            refreshStats()
        } catch {
            toast.error("Impossible d'archiver la conversation.")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await mailApi.update(id, { is_deleted: true })
            removeMail(id)
            toast.success("Conversation déplacée vers la corbeille.", {
                action: {
                    label: 'Annuler',
                    onClick: async () => {
                        try {
                            await mailApi.update(id, { is_deleted: false })
                            loadData()
                            refreshStats()
                        } catch {
                            toast.error("Impossible de restaurer la conversation.")
                        }
                    },
                },
            })
            refreshStats()
        } catch {
            toast.error("Impossible de supprimer la conversation.")
        }
    }

    // Idea 23: Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if focus is in an input/textarea/contenteditable
            const target = e.target as HTMLElement
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) return

            switch (e.key) {
                case "c":
                    e.preventDefault()
                    setComposeRichOpen(true)
                    break
                case "r":
                    if (selectedMail) {
                        e.preventDefault()
                        // Dispatch reply event to mail display
                        window.dispatchEvent(new CustomEvent("mail:shortcut", { detail: { action: "reply" } }))
                    }
                    break
                case "a":
                    if (selectedMail) {
                        e.preventDefault()
                        window.dispatchEvent(new CustomEvent("mail:shortcut", { detail: { action: "replyAll" } }))
                    }
                    break
                case "f":
                    if (selectedMail) {
                        e.preventDefault()
                        window.dispatchEvent(new CustomEvent("mail:shortcut", { detail: { action: "forward" } }))
                    }
                    break
                case "e":
                    if (selectedId) {
                        e.preventDefault()
                        handleArchive(selectedId)
                    }
                    break
                case "#":
                case "Delete":
                    if (selectedId) {
                        e.preventDefault()
                        handleDelete(selectedId)
                    }
                    break
                case "j": {
                    e.preventDefault()
                    const idx = filteredMailList.findIndex(m => m.id === selectedId)
                    if (idx < filteredMailList.length - 1) setSelectedId(filteredMailList[idx + 1].id)
                    break
                }
                case "k": {
                    e.preventDefault()
                    const idx = filteredMailList.findIndex(m => m.id === selectedId)
                    if (idx > 0) setSelectedId(filteredMailList[idx - 1].id)
                    break
                }
                case "/":
                    e.preventDefault()
                    searchInputRef.current?.focus()
                    break
                case "Escape":
                    if (selectedId) {
                        e.preventDefault()
                        clearSelection()
                    }
                    break
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, selectedMail, filteredMailList, setSelectedId, clearSelection, setComposeRichOpen])

    // Idea 15: Split-pane — is wide screen?
    const [isWide, setIsWide] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)")
        const update = () => setIsWide(mq.matches)
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])

    const navLinks = [
        {
            title: "Boîte de réception",
            label: mailStats ? String(mailStats.unread_count) : "…",
            icon: Inbox,
            variant: activeFolder === 'inbox' ? "default" : "ghost",
            href: "/mail",
            onClick: () => handleFolderChange('inbox'),
        },
        {
            title: "Messages suivis",
            label: mailStats ? String(mailStats.starred_count) : "",
            icon: Star,
            variant: activeFolder === 'starred' ? "default" : "ghost",
            href: "/mail",
            onClick: () => handleFolderChange('starred'),
        },
        {
            title: "En attente",
            label: "",
            icon: Clock,
            variant: activeFolder === 'snoozed' ? "default" : "ghost",
            href: "/mail",
            onClick: () => handleFolderChange('snoozed'),
        },
        {
            title: "Messages envoyés",
            label: "",
            icon: Send,
            variant: activeFolder === 'sent' ? "default" : "ghost",
            href: "/mail",
            onClick: () => handleFolderChange('sent'),
        },
        {
            title: "Brouillons",
            label: mailStats ? String(mailStats.draft_count) : "…",
            icon: File,
            variant: activeFolder === 'drafts' ? "default" : "ghost",
            href: "/mail",
            onClick: () => handleFolderChange('drafts'),
        },
    ] satisfies { title: string; label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "ghost"; href: string; onClick: () => void }[]

    // Filter chips config (Idea 17)
    const filterChips = [
        { key: "unread", label: "Non lu" },
        { key: "attachment", label: "Avec pièces jointes" },
        { key: "today", label: "Aujourd'hui" },
        { key: "starred", label: "Étoilé" },
        { key: "important", label: "Important" },
    ]

    return (
        <TooltipProvider delayDuration={0}>
            <WorkspaceShell
                className="bg-muted dark:bg-[#111111] text-foreground font-sans"
                header={<WorkspaceHeader />}
                sidebar={
                    <div
                        className={cn(
                            "shrink-0 flex flex-col gap-2 overflow-y-auto transition-all duration-200",
                            sidebarCollapsed ? "w-14 px-1 pt-2 items-center" : "w-[256px] px-4 pt-4"
                        )}
                    >
                        {/* Sidebar toggle */}
                        <div className={cn("flex", sidebarCollapsed ? "justify-center" : "justify-end pr-1")}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => setSidebarCollapsed(v => !v)}
                                title={sidebarCollapsed ? "Développer le menu" : "Réduire le menu"}
                            >
                                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                            </Button>
                        </div>

                        {/* Idea 24: Account switcher at top */}
                        {!sidebarCollapsed && accounts.length > 0 && (
                            <AccountSwitcher isCollapsed={false} accounts={accounts} />
                        )}
                        {sidebarCollapsed && accounts.length > 0 && (
                            <div className="flex flex-col items-center gap-1 py-1">
                                {accounts.slice(0, 3).map(acc => (
                                    <div
                                        key={acc.id}
                                        className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer transition-colors",
                                            acc.id === activeAccountId
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted text-muted-foreground hover:bg-accent"
                                        )}
                                        title={acc.email}
                                        onClick={() => setActiveAccountId(acc.id)}
                                    >
                                        {acc.name.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Compose Buttons */}
                        {!sidebarCollapsed ? (
                            <div className="flex flex-col gap-2">
                                <Button
                                    className="w-fit gap-4 rounded-2xl h-14 shadow-lg font-medium bg-primary/10 hover:bg-primary/20 hover:shadow-xl text-primary transition-all duration-200 justify-start px-6 text-[15px] border-0"
                                    onClick={() => setComposeRichOpen(true)}
                                >
                                    <Pencil className="h-6 w-6 text-primary" />
                                    Nouveau message
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-fit gap-2 rounded-xl h-9 text-sm text-muted-foreground hover:text-foreground justify-start px-4"
                                    onClick={() => setComposeAiOpen(true)}
                                >
                                    <Sparkles className="h-4 w-4 text-purple-500" />
                                    Rédiger avec l&apos;IA
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1">
                                <Button
                                    size="icon"
                                    className="h-10 w-10 rounded-2xl shadow-md bg-primary/10 hover:bg-primary/20 text-primary border-0"
                                    onClick={() => setComposeRichOpen(true)}
                                    title="Nouveau message"
                                >
                                    <Pencil className="h-5 w-5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-xl text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                    onClick={() => setComposeAiOpen(true)}
                                    title="Rédiger avec l'IA"
                                >
                                    <Sparkles className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Navigation Links */}
                        <MailNav isCollapsed={sidebarCollapsed} links={navLinks} />

                        {/* More Options — only in expanded mode */}
                        {!sidebarCollapsed && (
                            <div className="px-2 py-1">
                                <button className="flex items-center gap-3 text-[14px] text-muted-foreground hover:bg-muted dark:hover:bg-gray-800 rounded-r-full px-4 py-2 w-full transition-colors">
                                    <ChevronDown className="h-5 w-5" />
                                    Plus
                                </button>
                            </div>
                        )}

                        {/* Idea 32: Smart Folders — only in expanded mode */}
                        {!sidebarCollapsed && (
                            <div className="mt-3 border-t border-border/60 pt-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 mb-1">
                                    Dossiers intelligents
                                </p>
                                <nav className="flex flex-col gap-0.5">
                                    {[
                                        { key: 'factures', label: 'Factures', Icon: Receipt },
                                        { key: 'newsletters', label: 'Newsletters', Icon: Newspaper },
                                        { key: 'personnel', label: 'Personnel', Icon: User },
                                        { key: 'projets', label: 'Projets', Icon: FolderKanban },
                                    ].map(({ key, label, Icon }) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setSmartFolderFilter(f => f === key ? null : key)
                                                clearSelection()
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 px-6 py-2 text-[13px] rounded-r-full transition-colors text-left",
                                                smartFolderFilter === key
                                                    ? "bg-primary/10 text-primary font-semibold"
                                                    : "text-foreground/80 hover:bg-muted dark:hover:bg-gray-800"
                                            )}
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />
                                            <span className="truncate">{label}</span>
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        )}

                        {/* Labels Section — only in expanded mode */}
                        {!sidebarCollapsed && (
                            <div className="mt-3 border-t border-border/60 pt-4">
                                <button
                                    onClick={toggleLabelsExpanded}
                                    className="flex items-center justify-between w-full px-4 py-1.5 group"
                                >
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Libellés
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-muted rounded" />
                                        {labelsExpanded ? (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {labelsExpanded && (
                                    <nav className="mt-2 flex flex-col gap-0.5">
                                        {labelsLoading ? (
                                            <>
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div key={i} className="flex items-center gap-3 px-6 py-2">
                                                        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                                                        <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                                                    </div>
                                                ))}
                                            </>
                                        ) : labels.length === 0 ? (
                                            <p className="px-6 py-2 text-[13px] text-muted-foreground">Aucun libellé</p>
                                        ) : (
                                            labels.map((label) => (
                                                <button
                                                    key={label.id}
                                                    className="flex items-center gap-3 px-6 py-2 text-[13px] text-foreground/80 hover:bg-muted dark:hover:bg-gray-800 rounded-r-full transition-colors text-left"
                                                >
                                                    {/* Idea 29: Colored dot next to label */}
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full shrink-0 flex-none"
                                                        style={{ backgroundColor: label.color || "hsl(var(--muted-foreground))" }}
                                                    />
                                                    <Tag className="h-4 w-4" style={label.color ? { color: label.color } : undefined} />
                                                    <span className="truncate">{label.name}</span>
                                                </button>
                                            ))
                                        )}
                                    </nav>
                                )}
                            </div>
                        )}

                        {/* C2: Calendar drop zone */}
                        <div className="mt-auto px-4 pb-4 pt-2">
                            <div
                                onDragOver={(e) => { e.preventDefault(); setCalDropOver(true) }}
                                onDragLeave={() => setCalDropOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setCalDropOver(false)
                                    const raw = e.dataTransfer.getData('application/signapps-email')
                                    if (!raw) return
                                    try {
                                        const data = JSON.parse(raw)
                                        setCalDropMailData(data)
                                        setCalDropEventOpen(true)
                                    } catch { /* ignore */ }
                                }}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-colors py-3 px-2 text-center",
                                    calDropOver
                                        ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                        : "border-border/60 text-muted-foreground"
                                )}
                            >
                                <CalendarPlus className="h-5 w-5" />
                                <span className="text-[11px] font-medium leading-tight">
                                    Glisser un email<br />pour créer un événement
                                </span>
                            </div>
                        </div>
                    </div>
                }
            >
                {/* C2: EmailToEventDialog triggered from drag-drop */}
                {calDropMailData && (
                    <EmailToEventDialog
                        open={calDropEventOpen}
                        onOpenChange={(v) => { setCalDropEventOpen(v); if (!v) setCalDropMailData(null) }}
                        mail={{
                            id: calDropMailData.id,
                            name: calDropMailData.sender,
                            email: calDropMailData.sender,
                            subject: calDropMailData.subject,
                            text: '',
                            date: calDropMailData.date,
                            read: true,
                            labels: [],
                            folder: 'inbox' as const,
                        }}
                    />
                )}
                {/* Unified inbox toggle — shown when multiple accounts */}
                {accounts.length > 1 && (
                    <div className="flex items-center gap-2 px-2 pb-1">
                        <button
                            onClick={() => setUnifiedView(v => !v)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium border transition-all",
                                unifiedView
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                            )}
                        >
                            {unifiedView ? "Vue unifiée" : "Par compte"}
                        </button>
                        <span className="text-xs text-muted-foreground">
                            {unifiedView ? "Toutes les boîtes fusionnées" : `${accounts.length} comptes`}
                        </span>
                    </div>
                )}

                {/* Unified inbox panel (when unified view is active) */}
                {unifiedView && accounts.length > 1 && (
                    <div className="flex-1 bg-background dark:bg-[#1f1f1f] rounded-3xl shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] overflow-hidden mr-1 mb-3 ml-0">
                        <UnifiedInbox />
                    </div>
                )}

                {/* Content Area (List + Display) — hidden when unified view is active */}
                {(!unifiedView || accounts.length <= 1) && <div
                    className={cn(
                        "flex-1 flex bg-background dark:bg-[#1f1f1f] rounded-3xl shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] overflow-hidden mr-1 mb-3 ml-0 relative",
                        // Idea 15: split-pane on wide screens when email is selected
                        isWide && selectedId ? "flex-row" : "flex-col"
                    )}
                >
                    {/* Left pane: search + list + filter chips */}
                    <div
                        className={cn(
                            "flex flex-col",
                            isWide && selectedId ? "w-[40%] border-r border-border/60 dark:border-gray-800/60" : "flex-1"
                        )}
                    >
                        {/* Search bar + density switcher */}
                        <div className="px-4 py-2 border-b border-border dark:border-[#333] flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    ref={searchInputRef}
                                    className="pl-9 pr-8 h-9 rounded-full bg-muted dark:bg-[#303134] border-0 focus-visible:ring-1"
                                    placeholder="Rechercher… (from: to: has:attachment is:unread after:YYYY-MM)"
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    disabled={isSearching}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            {/* Idea 16: Density switcher */}
                            <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 shrink-0">
                                {(["compact", "default", "spacious"] as Density[]).map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDensityPref(d)}
                                        title={d === "compact" ? "Compact" : d === "spacious" ? "Spacieux" : "Normal"}
                                        className={cn(
                                            "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                                            density === d
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        )}
                                    >
                                        {d === "compact" ? "S" : d === "default" ? "M" : "L"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Idea 17: Filter chips */}
                        <div className="px-3 py-2 border-b border-border/60 dark:border-gray-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-shrink-0">
                            {filterChips.map(chip => (
                                <button
                                    key={chip.key}
                                    onClick={() => toggleFilter(chip.key)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border",
                                        activeFilters.has(chip.key)
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                    )}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>

                        {isLoading ? (
                            <div className="flex-1 flex flex-col gap-2 p-3">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/40">
                                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <Skeleton className="h-3.5 w-1/3" />
                                            <Skeleton className="h-3 w-2/3" />
                                            <Skeleton className="h-3 w-full" />
                                        </div>
                                        <Skeleton className="h-3 w-10 shrink-0" />
                                    </div>
                                ))}
                            </div>
                        ) : loadError ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-base font-medium text-muted-foreground mb-1">Service mail indisponible</h3>
                                <p className="text-sm text-muted-foreground/70 max-w-sm mb-4">{loadError}</p>
                                <Button variant="outline" size="sm" onClick={loadData}>Réessayer</Button>
                            </div>
                        ) : (
                            /* Idea 16: density class wrapper */
                            <div className={cn("flex-1 flex flex-col overflow-hidden", getDensityClass(density))}>
                                {/* PW2: cached indicator */}
                                {fromCache && (
                                    <div className="px-3 py-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                        <span>Cache hors-ligne</span>
                                        <span className="text-muted-foreground">— reconnectez-vous pour actualiser</span>
                                    </div>
                                )}
                                <MailList
                                    items={filteredMailList}
                                    selectedId={selectedId}
                                    onSelect={setSelectedId}
                                    onSnooze={handleSnooze}
                                    onArchive={handleArchive}
                                    onDelete={handleDelete}
                                    isSearchActive={searchResults !== null}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right pane / full-screen view on narrow screens */}
                    {selectedId && (
                        <div
                            className={cn(
                                "flex flex-col",
                                isWide ? "flex-1 overflow-y-auto" : "absolute inset-0 bg-background dark:bg-[#1f1f1f] z-10 flex flex-col"
                            )}
                        >
                            {/* Back button — always shown for accessibility, hidden on wide split view */}
                            {!isWide && (
                                <div className="p-2 border-b flex items-center bg-background dark:bg-[#1f1f1f] sticky top-0 z-10 w-full">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSelection}
                                        className="gap-2 rounded-full hover:bg-muted dark:hover:bg-gray-800"
                                    >
                                        &larr; Retour
                                    </Button>
                                </div>
                            )}
                            <div className={cn("flex-1", !isWide && "overflow-y-auto")}>
                                <MailDisplay
                                    mail={selectedMail}
                                    onSnooze={handleSnooze}
                                    onArchive={handleArchive}
                                    onDelete={handleDelete}
                                    accountId={activeAccountId}
                                />
                            </div>
                        </div>
                    )}
                </div>}

            </WorkspaceShell>

            <ComposeAiDialog open={composeAiOpen} onOpenChange={setComposeAiOpen} accountId={activeAccountId} />
            <ComposeRichDialog open={composeRichOpen} onOpenChange={setComposeRichOpen} accountId={activeAccountId} />
        </TooltipProvider>
    )
}
