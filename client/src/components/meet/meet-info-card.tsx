"use client"

import { Button } from "@/components/ui/button"
import { Copy, Plus, X } from "lucide-react"
import { toast } from "sonner"

interface MeetInfoCardProps {
    roomId: string
    onClose?: () => void
}

export function MeetInfoCard({ roomId, onClose }: MeetInfoCardProps) {
    const meetingLink = typeof window !== "undefined" ? `${window.location.origin}/meet?room=${roomId}` : `https://meet.signapps.com/${roomId}`
    const meetingPhone = "+33 1 87 40 36 60"
    const meetingCode = "351 884 586#"

    const handleCopy = () => {
        navigator.clipboard.writeText(meetingLink)
        toast.success("Lien de la réunion copié")
    }

    return (
        <div className="absolute top-4 left-4 z-20 w-[360px] bg-background dark:bg-[#1f1f1f] rounded-xl shadow-lg border border-[#e2e2e2] dark:border-[#ffffff1a] overflow-hidden flex flex-col p-6 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-[#e8eaed]">Votre réunion est prête</h3>
                {onClose && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368] hover:bg-gray-100 dark:hover:bg-[#28292a] rounded-full" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                )}
            </div>

            <Button className="w-full bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full h-10 font-medium mb-6">
                <Plus className="h-5 w-5 mr-2" />
                Ajouter des participants
            </Button>

            <p className="text-sm text-[#444746] dark:text-[#9aa0a6] mb-4">
                Vous pouvez également partager ces informations de connexion avec les personnes que vous souhaitez inviter à la réunion
            </p>

            <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-[#28292a] p-3 rounded-md">
                <span className="text-sm text-[#1f1f1f] dark:text-[#e8eaed] font-medium truncate mr-2">{meetingLink}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368] shrink-0" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-1 mb-6">
                <p className="text-sm text-[#444746] dark:text-[#9aa0a6]">
                    Appelez le : (FR) {meetingPhone}
                </p>
                <p className="text-sm text-[#444746] dark:text-[#9aa0a6]">
                    Code : {meetingCode}
                </p>
            </div>

            <Button variant="link" className="text-[#0b57d0] justify-start p-0 h-auto mb-6 text-sm">
                Autre numéros de téléphone
            </Button>
            
            <Button variant="link" className="text-[#0b57d0] justify-start p-0 h-auto mb-4 text-sm flex items-center">
                <Copy className="h-4 w-4 mr-2" />
                Partager tous les détails
            </Button>

            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                Vous participez en tant que e.ropp@advicetech.fr
            </p>
        </div>
    )
}
