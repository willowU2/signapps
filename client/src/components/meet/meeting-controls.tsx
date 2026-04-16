"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    MonitorUp,
    MonitorOff,
    Circle,
    Square,
    Users,
    Check,
    X,
    Captions,
    CaptionsOff,
} from "lucide-react"
import { toast } from "sonner"

interface WaitingUser {
    id: string
    user_id: string | null
    display_name: string
    requested_at: string
}

interface MeetingControlsProps {
    roomId: string
    isHost: boolean
    isRecording: boolean
    isSharingScreen: boolean
    onRecordingChange: (recording: boolean) => void
    onScreenShareChange: (sharing: boolean) => void
    /** Whether live transcription is currently active. */
    transcriptionEnabled?: boolean
    /** Toggle the live-transcription pipeline on/off. */
    onToggleTranscription?: () => void
}

export function MeetingControls({
    roomId,
    isHost,
    isRecording,
    isSharingScreen,
    onRecordingChange,
    onScreenShareChange,
    transcriptionEnabled = false,
    onToggleTranscription,
}: MeetingControlsProps) {
    const [waitingUsers, setWaitingUsers] = useState<WaitingUser[]>([])
    const [showWaitingRoom, setShowWaitingRoom] = useState(false)
    const [isLoadingRecording, setIsLoadingRecording] = useState(false)
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)

    // Screen sharing
    const toggleScreenShare = useCallback(async () => {
        if (isSharingScreen && screenStream) {
            screenStream.getTracks().forEach((t) => t.stop())
            setScreenStream(null)
            onScreenShareChange(false)
            toast.info("Partage d'écran arrêté")
            return
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            })
            setScreenStream(stream)
            onScreenShareChange(true)
            toast.success("Partage d'écran démarré")
            stream.getVideoTracks()[0].addEventListener("ended", () => {
                setScreenStream(null)
                onScreenShareChange(false)
            })
        } catch (err) {
            if ((err as Error).name !== "NotAllowedError") {
                toast.error("Impossible de partager l'écran")
            }
        }
    }, [isSharingScreen, screenStream, onScreenShareChange])

    // Recording
    const toggleRecording = useCallback(async () => {
        setIsLoadingRecording(true)
        try {
            const endpoint = isRecording
                ? `/api/meet/rooms/${roomId}/recording/stop`
                : `/api/meet/rooms/${roomId}/recording/start`
            const res = await fetch(endpoint, { method: "POST" })
            if (!res.ok) {
                const text = await res.text()
                toast.error(`Erreur enregistrement: ${text}`)
                return
            }
            const next = !isRecording
            onRecordingChange(next)
            toast.success(next ? "Enregistrement démarré" : "Enregistrement arrêté")
        } catch {
            toast.error("Erreur lors de la gestion de l'enregistrement")
        } finally {
            setIsLoadingRecording(false)
        }
    }, [isRecording, roomId, onRecordingChange])

    // Waiting room
    const fetchWaiting = useCallback(async () => {
        try {
            const res = await fetch(`/api/meet/rooms/${roomId}/waiting-room`)
            if (res.ok) {
                const data = await res.json()
                setWaitingUsers(data)
            }
        } catch {
            toast.error("Impossible de charger la salle d'attente")
        }
    }, [roomId])

    const handleAdmit = async (userId: string) => {
        const res = await fetch(`/api/meet/rooms/${roomId}/waiting-room/admit/${userId}`, { method: "POST" })
        if (res.ok) {
            setWaitingUsers((prev) => prev.filter((u) => u.user_id !== userId))
            toast.success("Participant admis")
        }
    }

    const handleDeny = async (userId: string) => {
        const res = await fetch(`/api/meet/rooms/${roomId}/waiting-room/deny/${userId}`, { method: "POST" })
        if (res.ok) {
            setWaitingUsers((prev) => prev.filter((u) => u.user_id !== userId))
            toast.info("Participant refusé")
        }
    }

    const toggleWaitingPanel = () => {
        if (!showWaitingRoom) fetchWaiting()
        setShowWaitingRoom((v) => !v)
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Control buttons row */}
            <div className="flex items-center gap-2">
                {/* Screen share */}
                <Button
                    variant={isSharingScreen ? "destructive" : "outline"}
                    size="sm"
                    onClick={toggleScreenShare}
                    title={isSharingScreen ? "Arrêter le partage" : "Partager l'écran"}
                >
                    {isSharingScreen ? (
                        <MonitorOff className="w-4 h-4 mr-1" />
                    ) : (
                        <MonitorUp className="w-4 h-4 mr-1" />
                    )}
                    {isSharingScreen ? "Arrêter" : "Partager"}
                </Button>

                {/* Recording (host only) */}
                {isHost && (
                    <Button
                        variant={isRecording ? "destructive" : "outline"}
                        size="sm"
                        onClick={toggleRecording}
                        disabled={isLoadingRecording}
                        title={isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
                    >
                        {isRecording ? (
                            <Square className="w-4 h-4 mr-1 fill-current" />
                        ) : (
                            <Circle className="w-4 h-4 mr-1 text-red-500" />
                        )}
                        {isRecording ? "Arrêter REC" : "Enregistrer"}
                    </Button>
                )}

                {/* Waiting room (host only) */}
                {isHost && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleWaitingPanel}
                        title="Salle d'attente"
                    >
                        <Users className="w-4 h-4 mr-1" />
                        Attente
                        {waitingUsers.length > 0 && (
                            <Badge variant="destructive" className="ml-1 px-1 py-0 text-xs">
                                {waitingUsers.length}
                            </Badge>
                        )}
                    </Button>
                )}

                {/* Live transcription toggle */}
                {onToggleTranscription && (
                    <Button
                        variant={transcriptionEnabled ? "destructive" : "outline"}
                        size="sm"
                        onClick={onToggleTranscription}
                        title={
                            transcriptionEnabled
                                ? "Arrêter la transcription"
                                : "Activer la transcription"
                        }
                    >
                        {transcriptionEnabled ? (
                            <CaptionsOff className="w-4 h-4 mr-1" />
                        ) : (
                            <Captions className="w-4 h-4 mr-1" />
                        )}
                        {transcriptionEnabled ? "Arrêter" : "Transcription"}
                    </Button>
                )}
            </div>

            {/* Waiting room panel */}
            {isHost && showWaitingRoom && (
                <div className="border rounded-lg bg-card p-3 w-72 space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Salle d'attente</h3>
                        <Button variant="ghost" size="sm" onClick={fetchWaiting} className="h-6 px-2 text-xs">
                            Actualiser
                        </Button>
                    </div>
                    {waitingUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun participant en attente</p>
                    ) : (
                        <ul className="space-y-1">
                            {waitingUsers.map((u) => (
                                <li
                                    key={u.id}
                                    className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                                >
                                    <span className="truncate max-w-[140px]">{u.display_name}</span>
                                    <div className="flex gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-green-600 hover:text-green-700"
                                            onClick={() => u.user_id && handleAdmit(u.user_id)}
                                            title="Admettre"
                                        >
                                            <Check className="w-3 h-3" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-red-500 hover:text-red-600"
                                            onClick={() => u.user_id && handleDeny(u.user_id)}
                                            title="Refuser"
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}
