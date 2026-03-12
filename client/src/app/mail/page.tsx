"use client"

import * as React from "react"
import { useEffect } from "react"
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
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MailDisplay } from "@/components/mail/mail-display"
import { MailList } from "@/components/mail/mail-list"
import { MailNav } from "@/components/mail/mail-nav"
import { ComposeAiDialog } from "@/components/mail/compose-ai-dialog"
import { ComposeRichDialog } from "@/components/mail/compose-rich-dialog"
import { MailAddons } from "@/components/mail/mail-addons"

import { WorkspaceHeader } from "@/components/mail/workspace-header"
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
import { mailApi, accountApi } from "@/lib/api-mail"
import { cn } from "@/lib/utils"
import { WorkspaceShell } from "@/components/layout/workspace-shell"

export default function MailPage() {
    // Zustand store hooks
    const mailList = useMailList()
    const selectedId = useSelectedMailId()
    const selectedMail = useSelectedMail()
    const { composeAiOpen, composeRichOpen, labelsExpanded } = useMailUIState()
    const { setComposeAiOpen, setComposeRichOpen, toggleLabelsExpanded } = useMailUIActions()
    const { setSelectedId, clearSelection } = useMailSelectionActions()
    const { setMailList, removeMail } = useMailDataActions()

    useEffect(() => {
        // Fetch accounts and emails from the real backend
        const loadData = async () => {
            try {
                // Fetch accounts
                const accounts = await accountApi.list()
                const uiAccounts = accounts.map(a => ({
                    id: a.id,
                    name: a.email_address.split('@')[0],
                    email: a.email_address,
                    icon: a.provider,
                    provider: a.provider
                }))
                void uiAccounts // Available for future use

                // Fetch emails from inbox
                const emails = await mailApi.list({ folder_type: 'inbox', limit: 50 })
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
                setMailList(uiMails)
            } catch (err) {
                console.debug('Failed to fetch mail data:', err)
                // Keep empty list on error - database is source of truth
                setMailList([])
            }
        }
        loadData()
    }, [setMailList])

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
            toast.success(`Conversation snoozed until ${time}.`)
        } catch {
            toast.error("Failed to snooze conversation.")
        }
    }

    const handleArchive = async (id: string) => {
        try {
            await mailApi.update(id, { is_archived: true })
            removeMail(id)
            toast.success("Conversation archived.")
        } catch {
            toast.error("Failed to archive conversation.")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await mailApi.update(id, { is_deleted: true })
            removeMail(id)
            toast.success("Conversation moved to trash.")
        } catch {
            toast.error("Failed to delete conversation.")
        }
    }

    return (
        <TooltipProvider delayDuration={0}>
            <WorkspaceShell
                className="bg-[#f2f6fc] dark:bg-[#111111] text-foreground font-sans"
                header={<WorkspaceHeader />}
                sidebar={
                    <div className="w-[256px] shrink-0 flex flex-col gap-2 px-4 pt-4 overflow-y-auto">
                        {/* Compose Buttons */}
                        <div className="flex flex-col gap-2">
                            <Button
                                className="w-fit gap-4 rounded-2xl h-14 shadow-lg font-medium bg-[#c2e7ff] hover:bg-[#a8d8f8] hover:shadow-xl text-[#001d35] transition-all duration-200 justify-start px-6 text-[15px] border-0"
                                onClick={() => setComposeRichOpen(true)}
                            >
                                <Pencil className="h-6 w-6 text-[#1a73e8]" />
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

                        {/* Navigation Links */}
                        <MailNav isCollapsed={false} links={[
                            {
                                title: "Boîte de réception",
                                label: "2468",
                                icon: Inbox,
                                variant: "default",
                                href: "/mail",
                            },
                            {
                                title: "Messages suivis",
                                label: "",
                                icon: Star,
                                variant: "ghost",
                                href: "/mail",
                            },
                            {
                                title: "En attente",
                                label: "",
                                icon: Clock,
                                variant: "ghost",
                                href: "/mail",
                            },
                            {
                                title: "Messages envoyés",
                                label: "",
                                icon: Send,
                                variant: "ghost",
                                href: "/mail",
                            },
                            {
                                title: "Brouillons",
                                label: "21",
                                icon: File,
                                variant: "ghost",
                                href: "/mail",
                            },
                        ]} />

                        {/* More Options */}
                        <div className="px-2 py-1">
                            <button className="flex items-center gap-3 text-[14px] text-[#444746] dark:text-[#e3e3e3] hover:bg-[#e8eaed] dark:hover:bg-gray-800 rounded-r-full px-4 py-2 w-full transition-colors">
                                <ChevronDown className="h-5 w-5" />
                                Plus
                            </button>
                        </div>

                        {/* Labels Section */}
                        <div className="mt-3 border-t border-[#e0e0e0]/60 dark:border-gray-800/60 pt-4">
                            <button
                                onClick={toggleLabelsExpanded}
                                className="flex items-center justify-between w-full px-4 py-1.5 group"
                            >
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5f6368] dark:text-[#9aa0a6]">
                                    Libellés
                                </span>
                                <div className="flex items-center gap-1">
                                    <Plus className="h-4 w-4 text-[#5f6368] dark:text-[#9aa0a6] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-[#e8eaed] dark:hover:bg-gray-700 rounded" />
                                    {labelsExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-[#5f6368] dark:text-[#9aa0a6]" />
                                    )}
                                </div>
                            </button>

                            {labelsExpanded && (
                                <nav className="mt-2 flex flex-col gap-0.5">
                                    {[
                                        { name: "[Imap]/Archived", color: "bg-gray-400" },
                                        { name: "[Imap]/Brouillons", color: "bg-gray-400" },
                                        { name: "[Imap]/Drafts", color: "bg-gray-400" },
                                        { name: "[Imap]/Sent", color: "bg-gray-400" },
                                        { name: "[Imap]/Trash", color: "bg-gray-400" },
                                        { name: "Reply_Later", color: "bg-yellow-500" },
                                        { name: "Junk", color: "bg-orange-500" },
                                    ].map((label) => (
                                        <button
                                            key={label.name}
                                            className="flex items-center gap-3 px-6 py-2 text-[13px] text-[#444746] dark:text-[#e3e3e3] hover:bg-[#e8eaed] dark:hover:bg-gray-800 rounded-r-full transition-colors text-left"
                                        >
                                            <Tag className={cn("h-4 w-4", label.color.replace("bg-", "text-"))} />
                                            <span className="truncate">{label.name}</span>
                                        </button>
                                    ))}
                                </nav>
                            )}
                        </div>
                    </div>
                }
            >
                {/* Content Area (List + Display) */}
                <div className="flex-1 flex flex-col bg-background dark:bg-[#1f1f1f] rounded-3xl shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] overflow-hidden mr-1 mb-3 ml-0 relative">
                    {!selectedId ? (
                        <MailList
                            items={mailList}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onSnooze={handleSnooze}
                            onArchive={handleArchive}
                            onDelete={handleDelete}
                        />
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-2 border-b flex items-center bg-background dark:bg-[#1f1f1f] sticky top-0 z-10 w-full">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSelection}
                                    className="gap-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    &larr; Retour
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <MailDisplay
                                    mail={selectedMail}
                                    onSnooze={handleSnooze}
                                    onArchive={handleArchive}
                                    onDelete={handleDelete}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </WorkspaceShell>

            <ComposeAiDialog open={composeAiOpen} onOpenChange={setComposeAiOpen} />
            <ComposeRichDialog open={composeRichOpen} onOpenChange={setComposeRichOpen} />
        </TooltipProvider>
    )
}
