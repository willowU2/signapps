"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { usePageTitle } from "@/hooks/use-page-title"
import { MeetRecordingToDoc } from "@/components/interop/meet-doc-bridge"
import { AppLayout } from "@/components/layout/app-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import dynamic from "next/dynamic"
const MeetRoom = dynamic(
    () => import("@/components/meet/meet-room").then((m) => ({ default: m.MeetRoom })),
    { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Chargement...</div> }
)
// IDEA-129: Real-time transcription overlay
import { LiveTranscriptionOverlay } from "@/components/meet/live-transcription-overlay"
import {
    Copy,
    Plus,
    Video,
    Users,
    Circle,
    Square,
    Trash2,
    MicOff,
    UserX,
    RefreshCw,
    Play,
    Download,
    Clock,
    CheckCircle,
    XCircle,
    ChevronRight,
    DoorOpen,
    StopCircle,
    History,
    Settings2,
    Loader2,
} from "lucide-react"
import { toast } from "sonner"
import {
    meetApi,
    Room,
    Participant,
    Recording,
    MeetingHistory,
    MeetConfig,
} from "@/lib/api/meet"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDuration(seconds?: number): string {
    if (!seconds) return "—"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
}

function fmtBytes(bytes?: number): string {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso?: string): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleString()
}

function fmtDateShort(iso?: string): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString()
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badges
// ─────────────────────────────────────────────────────────────────────────────

function RoomStatusBadge({ status }: { status: Room["status"] }) {
    const map: Record<Room["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
        active: { label: "En cours", variant: "default" },
        scheduled: { label: "Planifiée", variant: "secondary" },
        ended: { label: "Terminée", variant: "outline" },
    }
    const { label, variant } = map[status] ?? { label: status, variant: "outline" }
    return <Badge variant={variant}>{label}</Badge>
}

function RecordingStatusBadge({ status }: { status: Recording["status"] }) {
    const map: Record<Recording["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
        recording: { label: "En cours", variant: "default" },
        processing: { label: "Traitement", variant: "secondary" },
        ready: { label: "Prêt", variant: "outline" },
        failed: { label: "Echec", variant: "destructive" },
    }
    const { label, variant } = map[status] ?? { label: status, variant: "outline" }
    return <Badge variant={variant}>{label}</Badge>
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function MeetPage() {
    usePageTitle('Réunions')
    const searchParams = useSearchParams()

    // ── LiveKit room state (kept from original) ──────────────────────────────
    const [inRoom, setInRoom] = useState(false)
    const [liveRoomId, setLiveRoomId] = useState("")
    const [liveToken, setLiveToken] = useState("")
    const [isConnecting, setIsConnecting] = useState(false)
    // IDEA-129: Live transcription overlay state
    const [showTranscription, setShowTranscription] = useState(false)

    // ── API data ─────────────────────────────────────────────────────────────
    const [rooms, setRooms] = useState<Room[]>([])
    const [history, setHistory] = useState<MeetingHistory[]>([])
    const [config, setConfig] = useState<MeetConfig | null>(null)
    const [loadingRooms, setLoadingRooms] = useState(false)
    const [loadingHistory, setLoadingHistory] = useState(false)

    // ── Selected room detail ─────────────────────────────────────────────────
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
    const [participants, setParticipants] = useState<Participant[]>([])
    const [recordings, setRecordings] = useState<Recording[]>([])
    const [waitingRoom, setWaitingRoom] = useState<Participant[]>([])
    const [loadingDetail, setLoadingDetail] = useState(false)

    // ── Create room dialog ───────────────────────────────────────────────────
    const [createOpen, setCreateOpen] = useState(false)
    const [createName, setCreateName] = useState("")
    const [createDescription, setCreateDescription] = useState("")
    const [createIsPrivate, setCreateIsPrivate] = useState(false)
    const [createMaxParticipants, setCreateMaxParticipants] = useState("")
    const [creating, setCreating] = useState(false)

    // ── Quick-join input ─────────────────────────────────────────────────────
    const [joinCode, setJoinCode] = useState("")

    // ─────────────────────────────────────────────────────────────────────────
    // Load initial data
    // ─────────────────────────────────────────────────────────────────────────

    // Track whether this is the first load — suppress errors on initial mount
    // but show them on manual refresh so users get feedback
    const initialLoadDone = useState(() => ({ current: false }))[0]

    const loadRooms = useCallback(async () => {
        setLoadingRooms(true)
        try {
            const res = await meetApi.listRooms()
            setRooms(res.data)
        } catch {
            // Only show error toast on manual refresh, not initial load
            if (initialLoadDone.current) {
                toast.error("Impossible de charger les salles")
            }
        } finally {
            setLoadingRooms(false)
        }
    }, [initialLoadDone])

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true)
        try {
            const res = await meetApi.listHistory()
            setHistory(res.data)
        } catch {
            if (initialLoadDone.current) {
                toast.error("Impossible de charger l'historique")
            }
        } finally {
            setLoadingHistory(false)
        }
    }, [initialLoadDone])

    const loadConfig = useCallback(async () => {
        try {
            const res = await meetApi.getConfig()
            setConfig(res.data)
        } catch {
            // config is optional — silently ignore
        }
    }, [])

    useEffect(() => {
        const roomQuery = searchParams.get("room")
        if (roomQuery) setJoinCode(roomQuery)
        Promise.all([loadRooms(), loadHistory(), loadConfig()]).finally(() => {
            initialLoadDone.current = true
        })
    }, [searchParams, loadRooms, loadHistory, loadConfig, initialLoadDone])

    // ─────────────────────────────────────────────────────────────────────────
    // Room detail loader
    // ─────────────────────────────────────────────────────────────────────────

    const loadRoomDetail = useCallback(async (room: Room) => {
        setSelectedRoom(room)
        setLoadingDetail(true)
        try {
            const [partsRes, recsRes] = await Promise.all([
                meetApi.listParticipants(room.id),
                meetApi.listRecordings(room.id),
            ])
            setParticipants(partsRes.data)
            setRecordings(recsRes.data)
            setWaitingRoom([]) // waiting room endpoint not exposed in api client — placeholder
        } catch {
            toast.error("Impossible de charger les détails de la salle")
        } finally {
            setLoadingDetail(false)
        }
    }, [])

    // ─────────────────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────────────────

    const handleJoin = async (roomCode: string) => {
        const code = roomCode.trim()
        if (!code) return
        try {
            setIsConnecting(true)
            // Try to get a room token; fall back to generic livekit token
            const res = await fetch(`/api/livekit/get-token?room=${encodeURIComponent(code)}&username=User`)
            const data = await res.json()
            if (data.token) {
                setLiveToken(data.token)
                setLiveRoomId(code)
                setInRoom(true)
            } else {
                toast.error("Impossible d'obtenir le token de connexion")
            }
        } catch {
            toast.error("Erreur de connexion à la salle")
        } finally {
            setIsConnecting(false)
        }
    }

    const handleCreateRoom = async () => {
        if (!createName.trim()) {
            toast.error("Le nom de la salle est requis")
            return
        }
        setCreating(true)
        try {
            const res = await meetApi.createRoom({
                name: createName.trim(),
                description: createDescription.trim() || undefined,
                is_private: createIsPrivate,
                max_participants: createMaxParticipants ? Number(createMaxParticipants) : undefined,
            })
            toast.success(`Salle "${res.data.name}" créée`)
            setCreateOpen(false)
            setCreateName("")
            setCreateDescription("")
            setCreateIsPrivate(false)
            setCreateMaxParticipants("")
            loadRooms()
        } catch {
            toast.error("Impossible de créer la salle")
        } finally {
            setCreating(false)
        }
    }

    const handleEndRoom = async (room: Room) => {
        try {
            await meetApi.endRoom(room.id)
            toast.success(`Salle "${room.name}" terminée`)
            loadRooms()
            if (selectedRoom?.id === room.id) {
                setSelectedRoom((r) => r ? { ...r, status: "ended" } : r)
            }
        } catch {
            toast.error("Impossible de terminer la salle")
        }
    }

    const handleDeleteRoom = async (room: Room) => {
        try {
            await meetApi.deleteRoom(room.id)
            toast.success(`Salle "${room.name}" supprimée`)
            loadRooms()
            if (selectedRoom?.id === room.id) setSelectedRoom(null)
        } catch {
            toast.error("Impossible de supprimer la salle")
        }
    }

    const handleKick = async (participantId: string) => {
        if (!selectedRoom) return
        try {
            await meetApi.kickParticipant(selectedRoom.id, participantId)
            toast.success("Participant expulsé")
            setParticipants((ps) => ps.filter((p) => p.id !== participantId))
        } catch {
            toast.error("Impossible d'expulser le participant")
        }
    }

    const handleMute = async (participantId: string) => {
        if (!selectedRoom) return
        try {
            await meetApi.muteParticipant(selectedRoom.id, participantId, { audio: true })
            toast.success("Participant coupé")
            setParticipants((ps) =>
                ps.map((p) => (p.id === participantId ? { ...p, is_muted: true } : p))
            )
        } catch {
            toast.error("Impossible de couper le participant")
        }
    }

    const handleStartRecording = async () => {
        if (!selectedRoom) return
        try {
            const res = await meetApi.startRecording(selectedRoom.id)
            toast.success("Enregistrement démarré")
            setRecordings((rs) => [res.data, ...rs])
        } catch {
            toast.error("Impossible de démarrer l'enregistrement")
        }
    }

    const handleStopRecording = async (recordingId: string) => {
        try {
            const res = await meetApi.stopRecording(recordingId)
            toast.success("Enregistrement arrêté")
            setRecordings((rs) => rs.map((r) => (r.id === recordingId ? res.data : r)))
        } catch {
            toast.error("Impossible d'arrêter l'enregistrement")
        }
    }

    const handleDeleteRecording = async (recordingId: string) => {
        try {
            await meetApi.deleteRecording(recordingId)
            toast.success("Enregistrement supprimé")
            setRecordings((rs) => rs.filter((r) => r.id !== recordingId))
        } catch {
            toast.error("Impossible de supprimer l'enregistrement")
        }
    }

    const copyRoomLink = (room: Room) => {
        const link = `${window.location.origin}/meet?room=${room.room_code}`
        navigator.clipboard.writeText(link).then(
            () => toast.success("Lien copié !"),
            () => toast.error("Erreur lors de la copie")
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Active room stats
    // ─────────────────────────────────────────────────────────────────────────

    const activeRooms = rooms.filter((r) => r.status === "active")
    const scheduledRooms = rooms.filter((r) => r.status === "scheduled")
    const activeRecording = recordings.find((r) => r.status === "recording")

    // ─────────────────────────────────────────────────────────────────────────
    // LiveKit full-screen mode (kept from original)
    // ─────────────────────────────────────────────────────────────────────────

    if (inRoom) {
        return (
            <AppLayout>
                <div className="min-h-[400px] h-[min(calc(100vh-8rem),800px)] w-full flex items-center justify-center relative">
                    <MeetRoom
                        roomId={liveRoomId}
                        token={liveToken}
                        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880"}
                        onLeave={() => {
                            setInRoom(false)
                            setLiveToken("")
                            setShowTranscription(false)
                        }}
                    />
                    {/* IDEA-129: Real-time transcription overlay */}
                    <LiveTranscriptionOverlay
                        visible={showTranscription}
                        onClose={() => setShowTranscription(false)}
                        useWhisper={false}
                    />
                    {!showTranscription && (
                        <button
                            onClick={() => setShowTranscription(true)}
                            className="absolute bottom-24 right-4 z-20 flex items-center gap-1.5 rounded-full bg-black/60 text-white text-xs px-3 py-1.5 hover:bg-black/80 transition-colors"
                        >
                            CC Transcription
                        </button>
                    )}
                </div>
            </AppLayout>
        )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Main management UI
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <AppLayout>
            <div className="flex flex-col gap-6 p-6">
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Workspace Meet</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Gestion des salles de visioconférence
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={loadRooms} disabled={loadingRooms}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingRooms ? "animate-spin" : ""}`} />
                            Actualiser
                        </Button>
                        <Button size="sm" onClick={() => setCreateOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle salle
                        </Button>
                    </div>
                </div>

                {/* ── Stats cards ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <Circle className="w-5 h-5 text-green-500 fill-green-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{activeRooms.length}</div>
                                    <div className="text-xs text-muted-foreground">Réunions actives</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Clock className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{scheduledRooms.length}</div>
                                    <div className="text-xs text-muted-foreground">Planifiées</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-500/10 rounded-lg">
                                    <Users className="w-5 h-5 text-violet-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">
                                        {activeRooms.reduce((s, r) => s + (r.participant_count ?? 0), 0)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Participants actifs</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500/10 rounded-lg">
                                    <History className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{history.length}</div>
                                    <div className="text-xs text-muted-foreground">Réunions passées</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Quick-join bar ──────────────────────────────────────── */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex gap-3">
                            <Input
                                placeholder="Code ou nom de salle (ex: daily-standup)"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleJoin(joinCode)}
                                className="max-w-md"
                            />
                            <Button onClick={() => handleJoin(joinCode)} disabled={isConnecting || !joinCode.trim()}>
                                {isConnecting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Video className="w-4 h-4 mr-2" />
                                )}
                                {isConnecting ? "Connexion..." : "Rejoindre"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Tabs: Rooms | Detail | History | Config ─────────────── */}
                <Tabs defaultValue="rooms" className="flex-1">
                    <TabsList>
                        <TabsTrigger value="rooms">
                            <Video className="w-4 h-4 mr-1.5" />
                            Salles ({rooms.length})
                        </TabsTrigger>
                        <TabsTrigger value="detail" disabled={!selectedRoom}>
                            <Settings2 className="w-4 h-4 mr-1.5" />
                            Détail {selectedRoom ? `— ${selectedRoom.name}` : ""}
                        </TabsTrigger>
                        <TabsTrigger value="history">
                            <History className="w-4 h-4 mr-1.5" />
                            Historique
                        </TabsTrigger>
                        {config && (
                            <TabsTrigger value="config">
                                <Settings2 className="w-4 h-4 mr-1.5" />
                                Config
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* ── Rooms tab ─────────────────────────────────────────── */}
                    <TabsContent value="rooms" className="mt-4">
                        {loadingRooms ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                Chargement...
                            </div>
                        ) : rooms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                <Video className="w-12 h-12 opacity-30" />
                                <p>Aucune salle créée</p>
                                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Créer une salle
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rooms.map((room) => (
                                    <Card key={room.id} className="flex flex-col">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <CardTitle className="text-base truncate">{room.name}</CardTitle>
                                                    {room.description && (
                                                        <CardDescription className="mt-1 line-clamp-2">
                                                            {room.description}
                                                        </CardDescription>
                                                    )}
                                                </div>
                                                <RoomStatusBadge status={room.status} />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex-1 flex flex-col gap-3">
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {room.participant_count ?? 0}
                                                    {room.max_participants ? `/${room.max_participants}` : ""}
                                                </span>
                                                <span className="flex items-center gap-1 font-mono text-xs">
                                                    #{room.room_code}
                                                </span>
                                            </div>
                                            {room.scheduled_start && (
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {fmtDate(room.scheduled_start)}
                                                </div>
                                            )}
                                            <div className="flex gap-2 mt-auto pt-2">
                                                {room.status !== "ended" && (
                                                    <Button
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => handleJoin(room.room_code)}
                                                        disabled={isConnecting}
                                                    >
                                                        <DoorOpen className="w-3.5 h-3.5 mr-1.5" />
                                                        Rejoindre
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => loadRoomDetail(room)}
                                                >
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => copyRoomLink(room)}
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </Button>
                                                {room.status === "active" && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleEndRoom(room)}
                                                    >
                                                        <StopCircle className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                                {room.status === "ended" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteRoom(room)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Room detail tab ───────────────────────────────────── */}
                    <TabsContent value="detail" className="mt-4">
                        {!selectedRoom ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                <Settings2 className="w-12 h-12 opacity-30" />
                                <p>Sélectionner une salle depuis l'onglet Salles</p>
                            </div>
                        ) : loadingDetail ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                Chargement...
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Participants */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Participants ({participants.length})
                                            </CardTitle>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => selectedRoom && loadRoomDetail(selectedRoom)}
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-64">
                                            {participants.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                                                    <Users className="w-8 h-8 opacity-30 mb-2" />
                                                    Aucun participant
                                                </div>
                                            ) : (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Nom</TableHead>
                                                            <TableHead>Rôle</TableHead>
                                                            <TableHead>Statut</TableHead>
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {participants.map((p) => (
                                                            <TableRow key={p.id}>
                                                                <TableCell className="font-medium">
                                                                    {p.display_name}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {p.role}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex gap-1">
                                                                        {p.is_muted && (
                                                                            <Badge variant="secondary" className="text-xs">
                                                                                <MicOff className="w-3 h-3 mr-1" />
                                                                                Muet
                                                                            </Badge>
                                                                        )}
                                                                        {p.is_screen_sharing && (
                                                                            <Badge variant="secondary" className="text-xs">
                                                                                Partage
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {p.role !== "host" && (
                                                                        <div className="flex justify-end gap-1">
                                                                            {!p.is_muted && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => handleMute(p.id)}
                                                                                    title="Couper le micro"
                                                                                >
                                                                                    <MicOff className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="text-destructive hover:text-destructive"
                                                                                onClick={() => handleKick(p.id)}
                                                                                title="Expulser"
                                                                            >
                                                                                <UserX className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </ScrollArea>
                                    </CardContent>
                                </Card>

                                {/* Recordings */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Circle className="w-4 h-4" />
                                                Enregistrements ({recordings.length})
                                            </CardTitle>
                                            {selectedRoom.status === "active" && !activeRecording ? (
                                                <Button size="sm" onClick={handleStartRecording}>
                                                    <Play className="w-3.5 h-3.5 mr-1.5" />
                                                    Enregistrer
                                                </Button>
                                            ) : activeRecording ? (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleStopRecording(activeRecording.id)}
                                                >
                                                    <Square className="w-3.5 h-3.5 mr-1.5" />
                                                    Arrêter
                                                </Button>
                                            ) : null}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <ScrollArea className="h-64">
                                            {recordings.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                                                    <Circle className="w-8 h-8 opacity-30 mb-2" />
                                                    Aucun enregistrement
                                                </div>
                                            ) : (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Statut</TableHead>
                                                            <TableHead>Durée</TableHead>
                                                            <TableHead>Taille</TableHead>
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {recordings.map((rec) => (
                                                            <TableRow key={rec.id}>
                                                                <TableCell>
                                                                    <RecordingStatusBadge status={rec.status} />
                                                                </TableCell>
                                                                <TableCell>{fmtDuration(rec.duration_seconds)}</TableCell>
                                                                <TableCell>{fmtBytes(rec.file_size_bytes)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-1">
                                                                        {rec.status === "recording" && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={() => handleStopRecording(rec.id)}
                                                                                title="Arrêter"
                                                                            >
                                                                                <Square className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        )}
                                                                        {rec.download_url && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                asChild
                                                                                title="Télécharger"
                                                                            >
                                                                                <a href={rec.download_url} download>
                                                                                    <Download className="w-3.5 h-3.5" />
                                                                                </a>
                                                                            </Button>
                                                                        )}
                                                                        {/* Idea 7: Create doc from recording */}
                                                                        {rec.status === "ready" && (
                                                                            <MeetRecordingToDoc
                                                                                meetingId={rec.id}
                                                                                meetingTitle={selectedRoom?.name || 'Réunion'}
                                                                                transcript=""
                                                                            />
                                                                        )}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="text-destructive hover:text-destructive"
                                                                            onClick={() => handleDeleteRecording(rec.id)}
                                                                            title="Supprimer"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </ScrollArea>
                                    </CardContent>
                                </Card>

                                {/* Waiting room */}
                                <Card className="lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Salle d'attente ({waitingRoom.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {waitingRoom.length === 0 ? (
                                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4 justify-center">
                                                <CheckCircle className="w-4 h-4" />
                                                Salle d'attente vide
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nom</TableHead>
                                                        <TableHead>Arrivée</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {waitingRoom.map((p) => (
                                                        <TableRow key={p.id}>
                                                            <TableCell className="font-medium">{p.display_name}</TableCell>
                                                            <TableCell>{fmtDate(p.joined_at)}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button size="sm" variant="default">
                                                                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                                                        Admettre
                                                                    </Button>
                                                                    <Button size="sm" variant="destructive">
                                                                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                                                        Refuser
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>

                    {/* ── History tab ───────────────────────────────────────── */}
                    <TabsContent value="history" className="mt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Historique des réunions</CardTitle>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={loadHistory}
                                        disabled={loadingHistory}
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loadingHistory ? (
                                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                        Chargement...
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                                        <History className="w-12 h-12 opacity-30" />
                                        <p>Aucune réunion dans l'historique</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Salle</TableHead>
                                                <TableHead>Démarré</TableHead>
                                                <TableHead>Terminé</TableHead>
                                                <TableHead>Durée</TableHead>
                                                <TableHead>Participants</TableHead>
                                                <TableHead>Enregistrement</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.map((h) => (
                                                <TableRow key={h.id}>
                                                    <TableCell className="font-medium">{h.room_name}</TableCell>
                                                    <TableCell>{fmtDate(h.started_at)}</TableCell>
                                                    <TableCell>{fmtDate(h.ended_at)}</TableCell>
                                                    <TableCell>{fmtDuration(h.duration_seconds)}</TableCell>
                                                    <TableCell>
                                                        <span className="flex items-center gap-1">
                                                            <Users className="w-3.5 h-3.5" />
                                                            {h.participant_count}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {h.had_recording ? (
                                                            <Badge variant="secondary" className="text-xs">
                                                                <Circle className="w-3 h-3 mr-1 fill-current" />
                                                                Oui
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">Non</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Config tab ────────────────────────────────────────── */}
                    {config && (
                        <TabsContent value="config" className="mt-4">
                            <Card className="max-w-md">
                                <CardHeader>
                                    <CardTitle className="text-base">Configuration du service</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm font-medium">URL LiveKit</span>
                                        <span className="text-sm text-muted-foreground font-mono">{config.livekit_url}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm font-medium">Participants max / salle</span>
                                        <Badge variant="outline">{config.max_participants_per_room}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-sm font-medium">Enregistrements activés</span>
                                        {config.recording_enabled ? (
                                            <Badge variant="default">Oui</Badge>
                                        ) : (
                                            <Badge variant="outline">Non</Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>
            </div>

            {/* ── Create Room Dialog ────────────────────────────────────────── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nouvelle salle</DialogTitle>
                        <DialogDescription>
                            Créer une salle de visioconférence et inviter des participants.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="room-name">Nom de la salle *</Label>
                            <Input
                                id="room-name"
                                placeholder="ex: Réunion équipe produit"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="room-desc">Description</Label>
                            <Input
                                id="room-desc"
                                placeholder="Optionnel"
                                value={createDescription}
                                onChange={(e) => setCreateDescription(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="room-max">Nombre de participants max</Label>
                            <Input
                                id="room-max"
                                type="number"
                                placeholder="Illimité"
                                min={2}
                                value={createMaxParticipants}
                                onChange={(e) => setCreateMaxParticipants(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                            <div>
                                <div className="text-sm font-medium">Salle privée</div>
                                <div className="text-xs text-muted-foreground">
                                    Nécessite un mot de passe pour rejoindre
                                </div>
                            </div>
                            <Switch
                                checked={createIsPrivate}
                                onCheckedChange={setCreateIsPrivate}
                            />
                        </div>
                    </div>
                    <DialogFooter showCloseButton>
                        <Button onClick={handleCreateRoom} disabled={creating || !createName.trim()}>
                            {creating ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Créer la salle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    )
}
