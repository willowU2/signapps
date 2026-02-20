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
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/app-layout"
import { MailDisplay } from "@/components/mail/mail-display"
import { MailList } from "@/components/mail/mail-list"
import { MailNav } from "@/components/mail/mail-nav"
import { Mail } from "@/lib/data/mail"
import { useMail } from "@/app/mail/use-mail"
import { mailApi } from "@/lib/api-mail"

// Mock data (fallback)
import { mails } from "@/lib/data/mail"

export default function MailPage() {
    const [mailState, setMailState] = useMail() // useMail returns [state, setState]
    const [mailList, setMailList] = useState<Mail[]>(mails)

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

    return (
        <TooltipProvider delayDuration={0}>
            <AppLayout>
                <div className="flex h-full flex-col">
                    <div className="flex items-center p-4 border-b">
                        <h1 className="text-xl font-bold">Inbox</h1>
                        <div className="ml-auto flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search" className="pl-8 w-[250px]" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-[200px_1fr_1fr] flex-1 overflow-hidden">
                        {/* Sidebar */}
                        <div className="border-r bg-muted/10 p-2">
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
                        <div className="border-r overflow-auto">
                            {/* Accessing items from state */}
                            <MailList
                                items={mailList}
                                selectedId={mailState.selected}
                                onSelect={(id) => setMailState({ ...mailState, selected: id })}
                            />
                        </div>

                        {/* Display */}
                        <div className="overflow-auto bg-white p-4">
                            <MailDisplay mail={mailList.find(m => m.id === mailState.selected) || null} />
                        </div>
                    </div>
                </div>
            </AppLayout>
        </TooltipProvider>
    )
}
