"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
    Inbox,
    File,
    Send,
    Archive,
    Trash2,
    Star,
    Clock,
    AlertCircle,
    Tag,
    ChevronDown,
    ChevronRight,
    Plus,
    Bot,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MailDisplay } from "@/components/mail/mail-display"
import { MailList } from "@/components/mail/mail-list"
import { MailNav } from "@/components/mail/mail-nav"
import { ComposeAiDialog } from "@/components/mail/compose-ai-dialog"
import { MailAddons } from "@/components/mail/mail-addons"
import { WorkspaceRail } from "@/components/mail/workspace-rail"
import { WorkspaceHeader } from "@/components/mail/workspace-header"
import { Mail } from "@/lib/data/mail"
import { useMail } from "@/app/mail/use-mail"
import { useUIStore } from "@/lib/store"
import { mailApi, accountApi } from "@/lib/api-mail"
import { cn } from "@/lib/utils"
import { WorkspaceShell } from "@/components/layout/workspace-shell"

export default function MailPage() {
    const { sidebarCollapsed, rightSidebarOpen } = useUIStore()
    const [mailState, setMailState] = useMail()
    const [mailList, setMailList] = useState<Mail[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [composeAiOpen, setComposeAiOpen] = useState(false)
    const [labelsExpanded, setLabelsExpanded] = useState(true)

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

        // Use static mock data matching the user's screenshot
        const mockMails: Mail[] = [
            {
                id: "1",
                name: "Indeed",
                email: "donotreply@alert.indeed.com",
                subject: "Helvetic Emploi recrute pour Informaticien + 30 nouvelles offres à Porrentruy, JU",
                text: "indeed\n\n30 nouveaux emplois - Porrentruy, JU\nCes annonces correspondent à l'alerte Emploi que vous avez enregistrée.\n\ninformaticien H/F\nSigma\nCanton du Jura\nN'hésitez pas à nous faire parvenir votre dossier complet en suivant les instructions ci-dessous. Solides compétences en systèmes, réseaux et environnement...\nil y a 1 jour\n\nInformaticien\nHelvetic Emploi\nDelémont, JU\n53 357 CHF - 109 454 CHF par an\nCandidature simplifiée\nAssurer aux clients informatiques l'assistance, la maintenance, le support et le dépannage. Solides compétences en réseaux, systèmes et environnements Microsoft...\nil y a 2 jours\n\nResponsable Logistique & Expédition\nPRECIDIP SA\nDelémont, JU\nCandidature simplifiée\nVous contrôlez la qualité des emballages ainsi que la conformité des quantités livrées, tout en optimisant la circulation des composants, des produits finis,...",
                date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                read: true,
                labels: ["Boîte de réception", "Externe"],
                folder: "inbox"
            },
            {
                id: "2",
                name: "LinkedIn",
                email: "messages-noreply@linkedin.com",
                subject: "Vous avez 3 nouveaux messages, dont un de recruteur",
                text: "Découvrez vos nouveaux messages sur LinkedIn...",
                date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                read: false,
                labels: ["Boîte de réception"],
                folder: "inbox"
            },
            {
                id: "3",
                name: "Alan Assurances",
                email: "hello@alan.com",
                subject: "Votre décompte de remboursement est disponible",
                text: "Bonjour, nous venons de traiter votre dernière demande de remboursement. Le virement sera effectif sur votre compte d'ici 48h...",
                date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                read: true,
                labels: ["Boîte de réception", "Important"],
                folder: "inbox"
            }
        ];
        setMailList(mockMails);
    }, [])

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
            {/* Full Viewport Workspace Layout using Generic Shell */}
            <WorkspaceShell
                className="bg-[#f2f6fc] dark:bg-[#111111] text-foreground font-sans"
                header={<WorkspaceHeader />}
                leftRail={<WorkspaceRail activeApp="mail" />}
                rightRail={<MailAddons />}
                sidebar={
                    <div className="w-[256px] shrink-0 flex flex-col gap-2 px-4 pt-4 overflow-y-auto">
                        {/* Compose Button - Floating Pill Style */}
                        <Button
                            className="w-fit gap-4 rounded-2xl h-14 shadow-lg font-medium bg-[#c2e7ff] hover:bg-[#a8d8f8] hover:shadow-xl text-[#001d35] transition-all duration-200 justify-start px-6 text-[15px] border-0"
                            onClick={() => setComposeAiOpen(true)}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z" fill="#1a73e8"/>
                                <path d="M20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" fill="#1a73e8"/>
                            </svg>
                            Nouveau message
                        </Button>

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
                                onClick={() => setLabelsExpanded(!labelsExpanded)}
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
                {/* 4. White Card Content Area (List + Display) - Floating Card */}
                <div className="flex-1 flex flex-col bg-white dark:bg-[#1f1f1f] rounded-3xl shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] overflow-hidden mr-1 mb-3 ml-0 relative">
                        {!mailState.selected ? (
                            <MailList
                                items={mailList}
                                selectedId={mailState.selected}
                                onSelect={(id) => setMailState({ ...mailState, selected: id })}
                                onSnooze={handleSnooze}
                                onArchive={handleArchive}
                                onDelete={handleDelete}
                            />
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="p-2 border-b flex items-center bg-white dark:bg-[#1f1f1f] sticky top-0 z-10 w-full">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setMailState({ ...mailState, selected: null })}
                                        className="gap-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        &larr; Retour
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    <MailDisplay
                                        mail={mailList.find(m => m.id === mailState.selected) || null}
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
        </TooltipProvider>
    )
}
