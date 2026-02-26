"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
    Search,
    Inbox,
    File,
    Send,
    Archive,
    Trash2,
    Bot,
} from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/app-layout"
import { MailDisplay } from "@/components/mail/mail-display"
import { MailList } from "@/components/mail/mail-list"
import { MailNav } from "@/components/mail/mail-nav"
import { AccountSwitcher } from "@/components/mail/account-switcher"
import { ComposeAiDialog } from "@/components/mail/compose-ai-dialog"
import { Mail } from "@/lib/data/mail"
import { useMail } from "@/app/mail/use-mail"
import { mailApi, accountApi, MailAccount } from "@/lib/api-mail"


export default function MailPage() {
    const [mailState, setMailState] = useMail()
    const [mailList, setMailList] = useState<Mail[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [composeAiOpen, setComposeAiOpen] = useState(false)

    useEffect(() => {
        // Fetch accounts
        accountApi.list().then(list => {
            const uiAccounts = list.map(a => ({
                id: a.id,
                name: a.email_address.split('@')[0],
                email: a.email_address,
                icon: a.provider,
                provider: a.provider
            }))
            setAccounts(uiAccounts)
        }).catch(err => console.error('Failed to fetch mail accounts:', err))

        // Fetch emails
        mailApi.list().then(apiMails => {
            const adapted: Mail[] = apiMails.map(e => ({
                id: e.id,
                name: e.sender.split('@')[0],
                email: e.sender,
                subject: e.subject,
                text: e.body,
                date: e.created_at,
                read: e.is_read,
                labels: e.labels,
                folder: 'inbox' // Default for now, generic implementation
            }))
            setMailList(adapted)
        }).catch((err) => {
            console.error("Failed to fetch emails:", err)
        })
    }, [])

    // NOTE: This logic mimics the original scaffold but integrates the list
    // The original scaffold used 'mails' from data/mail directly in MailList props or state
    // We are now keeping 'mailList' in state

    const handleSnooze = async (id: string, time: string) => {
        let snoozeDate = new Date()
        if (time === "Later today") {
            snoozeDate.setHours(snoozeDate.getHours() + 4)
        } else if (time === "Tomorrow") {
            snoozeDate.setDate(snoozeDate.getDate() + 1)
            snoozeDate.setHours(9, 0, 0, 0)
        } else if (time === "This weekend") {
            const daysToFriday = (5 - snoozeDate.getDay() + 7) % 7 || 7 // Friday or next Friday
            snoozeDate.setDate(snoozeDate.getDate() + daysToFriday)
            snoozeDate.setHours(17, 0, 0, 0)
        } else if (time === "Next week") {
            const daysToMonday = (1 - snoozeDate.getDay() + 7) % 7 || 7 // Monday or next Monday
            snoozeDate.setDate(snoozeDate.getDate() + daysToMonday)
            snoozeDate.setHours(9, 0, 0, 0)
        }

        try {
            // Optimistic UI update could go here, but doing it after success is safer for now
            // We just don't handle real persistence for the "mock" mail list right now if it fails,
            // but the API is hooked up for custom fetched emails.
            await mailApi.update(id, { snoozed_until: snoozeDate.toISOString() })

            setMailList(prev => prev.filter(m => m.id !== id))
            if (mailState.selected === id) {
                setMailState({ ...mailState, selected: null })
            }
            toast.success(`Conversation snoozed until ${time}.`)
        } catch (error) {
            toast.error("Failed to snooze conversation.")
        }
    }

    const handleArchive = async (id: string) => {
        try {
            await mailApi.update(id, { is_archived: true })
            setMailList(prev => prev.filter(m => m.id !== id))
            if (mailState.selected === id) {
                setMailState({ ...mailState, selected: null })
            }
            toast.success("Conversation archived.")
        } catch (error) {
            toast.error("Failed to archive conversation.")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await mailApi.update(id, { is_deleted: true })
            setMailList(prev => prev.filter(m => m.id !== id))
            if (mailState.selected === id) {
                setMailState({ ...mailState, selected: null })
            }
            toast.success("Conversation moved to trash.")
        } catch (error) {
            toast.error("Failed to delete conversation.")
        }
    }

    return (
        <TooltipProvider delayDuration={0}>
            <AppLayout>
                <div className="flex h-[calc(100vh-4rem)] flex-col bg-background/50 dark:bg-background/20">
                    {/* Header */}
                    <div className="flex items-center px-4 md:px-6 py-4 bg-background/60 backdrop-blur-3xl sticky top-0 z-10 border-b shadow-sm">
                        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
                        <div className="ml-auto flex items-center gap-4">
                            <Button
                                variant="default"
                                size="sm"
                                className="rounded-full shadow-sm transition-all font-medium gap-2"
                                onClick={() => setComposeAiOpen(true)}
                            >
                                <Bot className="h-4 w-4 mr-2" />
                                Compose with AI
                            </Button>
                            <div className="relative group shadow-sm rounded-full">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search emails..."
                                    className="pl-10 w-[200px] lg:w-[300px] h-9 rounded-full bg-background/80 border-border focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all shadow-inner text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex flex-1 overflow-hidden p-2 md:p-4 gap-2 md:gap-4">
                        {/* Sidebar */}
                        <div className="hidden md:flex w-[240px] shrink-0 bg-background/60 backdrop-blur-3xl rounded-2xl border shadow-sm p-3 flex-col gap-4 relative">
                            <AccountSwitcher isCollapsed={false} accounts={accounts} />

                            <Button
                                className="w-full gap-2 rounded-xl h-11 shadow-sm font-semibold bg-primary/90 hover:bg-primary text-primary-foreground transition-all"
                                onClick={() => setComposeAiOpen(true)}
                            >
                                <Bot className="h-4 w-4" />
                                Compose
                            </Button>

                            <MailNav isCollapsed={false} links={[
                                {
                                    title: "Inbox",
                                    label: "128",
                                    icon: Inbox,
                                    variant: "default",
                                    href: "/mail",
                                },
                                {
                                    title: "Drafts",
                                    label: "9",
                                    icon: File,
                                    variant: "ghost",
                                    href: "/mail",
                                },
                                {
                                    title: "Sent",
                                    label: "",
                                    icon: Send,
                                    variant: "ghost",
                                    href: "/mail",
                                },
                                {
                                    title: "Junk",
                                    label: "23",
                                    icon: Archive,
                                    variant: "ghost",
                                    href: "/mail",
                                },
                                {
                                    title: "Trash",
                                    label: "",
                                    icon: Trash2,
                                    variant: "ghost",
                                    href: "/mail",
                                },
                            ]} />
                        </div>

                        <div className="w-full lg:w-[400px] shrink-0 bg-background/80 backdrop-blur-3xl rounded-2xl border shadow-sm overflow-hidden flex flex-col relative transition-all duration-300">
                            <MailList
                                items={mailList}
                                selectedId={mailState.selected}
                                onSelect={(id) => setMailState({ ...mailState, selected: id })}
                                onSnooze={handleSnooze}
                                onArchive={handleArchive}
                                onDelete={handleDelete}
                            />
                        </div>

                        {/* Mail Display */}
                        <div className="hidden lg:flex flex-1 overflow-hidden bg-background/95 backdrop-blur-3xl rounded-2xl border shadow-md relative flex-col">
                            <MailDisplay
                                mail={mailList.find(m => m.id === mailState.selected) || null}
                                onSnooze={handleSnooze}
                                onArchive={handleArchive}
                                onDelete={handleDelete}
                            />
                        </div>
                    </div>
                </div>
                <ComposeAiDialog open={composeAiOpen} onOpenChange={setComposeAiOpen} />
            </AppLayout>
        </TooltipProvider>
    )
}
