"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
    Search,
    Inbox,
    File,
    Send,
    Archive,
    Clock,
    Trash2,
    SlidersHorizontal,
    Menu,
    HelpCircle,
    Settings,
    Grid,
    CheckCircle2,
    MoreVertical,
    Plus,
    ListTodo,
    Calendar as CalendarIcon,
    Lightbulb,
    Users,
    Bot,
    MessageSquare,
    Video,
} from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/app-layout"
import { MailDisplay } from "@/components/mail/mail-display"
import { MailList } from "@/components/mail/mail-list"
import { MailNav } from "@/components/mail/mail-nav"
import { AccountSwitcher } from "@/components/mail/account-switcher"
import { ComposeAiDialog } from "@/components/mail/compose-ai-dialog"
import { MailHeader } from "@/components/mail/mail-header"
import { MailAddons } from "@/components/mail/mail-addons"
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
        <AppLayout>
            <TooltipProvider delayDuration={0}>
                {/* Full viewport Workspace Layout */}
                <div className="h-[calc(100vh-8rem)] w-full flex flex-col bg-[#f2f6fc] dark:bg-[#111111] text-foreground overflow-hidden font-sans rounded-xl border shadow-sm">
                    
                    {/* 1. Global Workspace Header */}
                    <MailHeader />

                <div className="flex flex-1 overflow-hidden relative">


                    {/* 3. Mail Navigation Sidebar */}
                    <div className="w-[256px] shrink-0 bg-transparent flex flex-col gap-2 relative">
                            <AccountSwitcher isCollapsed={false} accounts={accounts} />

                            <Button
                                className="w-full gap-2 rounded-xl h-14 shadow-sm font-semibold bg-[#c2e7ff] hover:bg-[#b0dcf8] text-[#001d35] transition-all justify-start px-4 text-base"
                                onClick={() => setComposeAiOpen(true)}
                            >
                                <Bot className="h-5 w-5 mr-1" />
                                Nouveau message
                            </Button>

                            <MailNav isCollapsed={false} links={[
                                {
                                    title: "Boîte de réception",
                                    label: "128",
                                    icon: Inbox,
                                    variant: "default",
                                    href: "/mail",
                                },
                                {
                                    title: "Brouillons",
                                    label: "9",
                                    icon: File,
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
                                    title: "Spam",
                                    label: "23",
                                    icon: Archive,
                                    variant: "ghost",
                                    href: "/mail",
                                },
                                {
                                    title: "Corbeille",
                                    label: "",
                                    icon: Trash2,
                                    variant: "ghost",
                                    href: "/mail",
                                },
                            ]} />
                    </div>

                    {/* 4. White Card Content Area (List or Display) */}
                    <div className="flex-1 bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-sm border-none overflow-hidden flex flex-col relative transition-all duration-300 mr-4 mb-4 z-10">
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
                                        <Button variant="ghost" size="sm" onClick={() => setMailState({ ...mailState, selected: null })} className="gap-2">
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

                    {/* 5. Extreme Right Add-ons Rail */}
                    <MailAddons />
                </div>

                <ComposeAiDialog open={composeAiOpen} onOpenChange={setComposeAiOpen} />
                </div>
            </TooltipProvider>
        </AppLayout>
    )
}
