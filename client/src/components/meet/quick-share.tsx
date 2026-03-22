"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { MonitorUp, MonitorOff, Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface QuickShareProps {
    onShareStatusChange?: (isSharing: boolean, shareCode?: string) => void
}

export function QuickShare({ onShareStatusChange }: QuickShareProps) {
    const [isSharing, setIsSharing] = useState(false)
    const [shareCode, setShareCode] = useState<string | null>(null)
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
    const [isCopied, setIsCopied] = useState(false)

    const generateShareCode = (): string => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        let code = ""
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    const toggleScreenShare = useCallback(async () => {
        if (isSharing && screenStream) {
            // Stop sharing
            screenStream.getTracks().forEach((track) => track.stop())
            setScreenStream(null)
            setIsSharing(false)
            setShareCode(null)
            onShareStatusChange?.(false)
            toast.info("Partage d'écran arrêté")
            return
        }

        try {
            // Start sharing
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            })
            const code = generateShareCode()
            setScreenStream(stream)
            setShareCode(code)
            setIsSharing(true)
            onShareStatusChange?.(true, code)
            toast.success("Partage d'écran démarré")

            // Listen for track ended event (user clicks stop in browser)
            stream.getVideoTracks()[0].addEventListener("ended", () => {
                setScreenStream(null)
                setIsSharing(false)
                setShareCode(null)
                onShareStatusChange?.(false)
                toast.info("Partage d'écran arrêté")
            })
        } catch (err) {
            const error = err as Error
            if (error.name !== "NotAllowedError") {
                toast.error("Impossible de démarrer le partage d'écran")
            }
        }
    }, [isSharing, screenStream, onShareStatusChange])

    const copyShareCode = useCallback(() => {
        if (shareCode) {
            navigator.clipboard.writeText(shareCode)
            setIsCopied(true)
            toast.success("Code copié dans le presse-papiers")
            setTimeout(() => setIsCopied(false), 2000)
        }
    }, [shareCode])

    return (
        <div className="flex flex-col gap-3">
            <Button
                variant={isSharing ? "destructive" : "outline"}
                size="sm"
                onClick={toggleScreenShare}
                title={isSharing ? "Arrêter le partage" : "Partager mon écran"}
                className="gap-2"
            >
                {isSharing ? (
                    <MonitorOff className="w-4 h-4" />
                ) : (
                    <MonitorUp className="w-4 h-4" />
                )}
                {isSharing ? "Arrêter le partage" : "Partager mon écran"}
            </Button>

            {isSharing && shareCode && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex flex-col flex-1 gap-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                Partage actif
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 dark:text-green-400">Code :</span>
                            <code className="text-sm font-mono font-bold text-green-700 dark:text-green-200">
                                {shareCode}
                            </code>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={copyShareCode}
                                className="h-6 w-6 p-0 ml-auto"
                                title="Copier le code"
                            >
                                {isCopied ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5 text-green-600" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
