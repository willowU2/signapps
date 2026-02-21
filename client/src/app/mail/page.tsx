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
import { ComposeAiDialog } from "@/components/mail/compose-ai-dialog"
import { Mail } from "@/lib/data/mail"
import { useMail } from "@/app/mail/use-mail"
import { mailApi } from "@/lib/api-mail"

// Mock data (fallback)
import { mails } from "@/lib/data/mail"

export default function MailPage() {
    const [mailState, setMailState] = useMail() // useMail returns [state, setState]
    const [mailList, setMailList] = useState<Mail[]>(mails)
    const [composeAiOpen, setComposeAiOpen] = useState(false)

    useEffect(() => {
        mailApi.list().then(apiMails => {
            if (apiMails.length > 0) {
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
            }
        }).catch(() => {
            // Ignore error, keep mock data
            console.log("Mail backend not reachable, using mock data")
        })
    }, [])

    // NOTE: This logic mimics the original scaffold but integrates the list
    // The original scaffold used 'mails' from data/mail directly in MailList props or state
    // We are now keeping 'mailList' in state

    const handleSnooze = (id: string, time: string) => {
        setMailList(prev => prev.filter(m => m.id !== id))
        if (mailState.selected === id) {
            setMailState({ ...mailState, selected: null })
        }
        toast.success(`Conversation snoozed until ${time}.`)
    }

    return (
        <TooltipProvider delayDuration={0}>
            <AppLayout>
                <div className="flex h-full flex-col">
                    <div className="flex items-center p-4 border-b bg-white/50 dark:bg-gray-950/50 backdrop-blur-md sticky top-0 z-10">
                        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">Inbox</h1>
                        <div className="ml-auto flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/60 bg-purple-50/30 dark:bg-purple-900/20 hover:bg-purple-100/50 dark:hover:bg-purple-900/40 rounded-full shadow-sm transition-all"
                                onClick={() => setComposeAiOpen(true)}
                            >
                                <Bot className="h-4 w-4 mr-2" />
                                Compose with AI
                            </Button>
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
                                <Input
                                    placeholder="Search emails..."
                                    className="pl-9 w-[280px] rounded-full bg-gray-100/50 dark:bg-gray-800/50 border-transparent focus-visible:ring-purple-500/30 focus-visible:border-purple-500/50 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-[200px_350px_1fr] flex-1 overflow-hidden bg-gray-50/30 dark:bg-gray-900/10">
                        {/* Sidebar */}
                        <div className="border-r border-gray-200/60 dark:border-gray-800/60 p-3 flex flex-col gap-2">
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

                        {/* List */}
                        <div className="border-r border-gray-200/60 dark:border-gray-800/60 overflow-hidden bg-white/50 dark:bg-gray-950/20 backdrop-blur-sm">
                            {/* Accessing items from state */}
                            <MailList
                                items={mailList}
                                selectedId={mailState.selected}
                                onSelect={(id) => setMailState({ ...mailState, selected: id })}
                                onSnooze={handleSnooze}
                            />
                        </div>

                        {/* Display */}
                        <div className="overflow-hidden bg-white dark:bg-gray-950 relative">
                            {/* Inner container to allow MailDisplay to fill space properly */}
                            <div className="absolute inset-0 m-4 border border-gray-200/50 dark:border-gray-800/50 rounded-2xl overflow-hidden shadow-sm bg-gray-50/30 dark:bg-gray-900/20 flex flex-col">
                                <MailDisplay
                                    mail={mailList.find(m => m.id === mailState.selected) || null}
                                    onSnooze={handleSnooze}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <ComposeAiDialog open={composeAiOpen} onOpenChange={setComposeAiOpen} />
            </AppLayout>
        </TooltipProvider>
    )
}
