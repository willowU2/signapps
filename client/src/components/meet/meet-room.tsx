"use client"

import { useState } from "react"
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    TrackReferenceOrPlaceholder,
    useLocalParticipant,
    useConnectionState
} from "@livekit/components-react"
import "@livekit/components-styles"
import { Track, ConnectionState } from "livekit-client"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    MessageSquare,
    Users,
    Settings,
    MonitorUp,
    Hand,
    Smile,
    Subtitles,
    MoreVertical,
    Info,
    Shield
} from "lucide-react"

import { MeetInfoCard } from "./meet-info-card"
import { MeetAiCard } from "./meet-ai-card"

interface MeetRoomProps {
    roomId: string
    token: string
    serverUrl: string
    onLeave: () => void
}

export function MeetRoom({ roomId, token, serverUrl, onLeave }: MeetRoomProps) {
    if (!token) return null;

    return (
        <LiveKitRoom
            video={false}
            audio={false}
            token={token}
            serverUrl={serverUrl}
            data-lk-theme="default"
            style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
            onError={(err) => {
                console.warn("LiveKitRoom Error:", err)
                toast.error("Une erreur critique est survenue dans la salle.")
            }}
        >
            <RoomAudioRenderer />
            <MeetUiContent onLeave={onLeave} roomId={roomId} />
        </LiveKitRoom>
    )
}

function MeetUiContent({ onLeave, roomId }: { onLeave: () => void, roomId: string }) {
    const [showInfo, setShowInfo] = useState(true)

    // Current time for the bottom left
    const [currentTime, setCurrentTime] = useState(() => {
        const now = new Date()
        return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    })

    const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant()
    const connectionState = useConnectionState()
        const isConnected = connectionState === ConnectionState.Connected

        const toggleMic = async () => {
            if (!isConnected) return;
            try {
                await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
            } catch (err: any) {
                console.warn("Mic toggle error:", err)
                if (err.name === 'NotAllowedError' || err.message?.includes('Permission refusée')) {
                    toast.error("Accès au micro refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.")
                } else {
                    toast.error("Impossible d'activer le micro. Erreur inattendue.")
                }
            }
        }

        const toggleCamera = async () => {
            if (!isConnected) return;
            try {
                await localParticipant.setCameraEnabled(!isCameraEnabled)
            } catch (err: any) {
                console.warn("Camera toggle error:", err)
                if (err.name === 'NotAllowedError' || err.message?.includes('Permission refusée')) {
                    toast.error("Accès à la caméra refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.")
                } else {
                    toast.error("Impossible d'activer la caméra. Erreur inattendue.")
                }
            }
        }

        const toggleScreenShare = async () => {
            if (!isConnected) return;
            try {
                await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
            } catch (err: any) {
                console.warn("Screen share toggle error:", err)
                toast.error("Impossible de partager l'écran. Le serveur de flux (ICE) semble injoignable.")
            }
        }

        return (
        <div className="flex flex-col h-full w-full bg-[#202124] relative overflow-hidden font-sans rounded-xl border border-border">
            {/* Main Video Area */}
            <div className="flex-1 relative p-4 pb-0 flex items-center justify-center">
                <VideoComponent />
                
                {/* Floating Overlays */}
                {showInfo && <MeetInfoCard roomId={roomId} onClose={() => setShowInfo(false)} />}
                <MeetAiCard />
            </div>

            {/* Bottom Control Bar */}
            <div className="h-[80px] bg-[#202124] flex items-center justify-between px-6 shrink-0 z-20">
                
                {/* Left: Time and Room Code */}
                <div className="flex items-center gap-4 w-[250px]">
                    <span className="text-white text-[15px] font-medium tracking-wide">
                        {currentTime}
                    </span>
                    <div className="h-4 w-[1px] bg-[#5f6368]"></div>
                    <span className="text-white text-[15px] font-medium tracking-wide">
                        {roomId.substring(0, 12)}
                    </span>
                </div>

                {/* Center: Controls */}
                <div className="flex items-center gap-3">
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        onClick={toggleMic}
                        disabled={!isConnected}
                        className={`h-[40px] w-[40px] rounded-full border-none transition-colors ${
                            !isConnected ? "opacity-50 cursor-not-allowed " : ""
                        }${
                            isMicrophoneEnabled 
                                ? "bg-[#3c4043] hover:bg-[#4d5156] text-white" 
                                : "bg-[#ea4335] hover:bg-[#d93025] text-white"
                        }`}
                    >
                        {isMicrophoneEnabled ? <Mic className="h-[20px] w-[20px]" /> : <MicOff className="h-[20px] w-[20px]" />}
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        onClick={toggleCamera}
                        disabled={!isConnected}
                        className={`h-[40px] w-[40px] rounded-full border-none transition-colors ${
                            !isConnected ? "opacity-50 cursor-not-allowed " : ""
                        }${
                            isCameraEnabled 
                                ? "bg-[#3c4043] hover:bg-[#4d5156] text-white" 
                                : "bg-[#ea4335] hover:bg-[#d93025] text-white"
                        }`}
                    >
                        {isCameraEnabled ? <Video className="h-[20px] w-[20px]" /> : <VideoOff className="h-[20px] w-[20px]" />}
                    </Button>
                    <Button variant="secondary" size="icon" className="h-[40px] w-[40px] rounded-full bg-[#3c4043] hover:bg-[#4d5156] text-white border-none">
                        <Subtitles className="h-[20px] w-[20px]" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-[40px] w-[40px] rounded-full bg-[#3c4043] hover:bg-[#4d5156] text-white border-none">
                        <Smile className="h-[20px] w-[20px]" />
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="icon" 
                        onClick={toggleScreenShare}
                        disabled={!isConnected}
                        className={`h-[40px] w-[40px] rounded-full border-none transition-colors ${
                            !isConnected ? "opacity-50 cursor-not-allowed " : ""
                        }${
                            isScreenShareEnabled 
                                ? "bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124]" 
                                : "bg-[#3c4043] hover:bg-[#4d5156] text-white"
                        }`}
                    >
                        <MonitorUp className="h-[20px] w-[20px]" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-[40px] w-[40px] rounded-full bg-[#3c4043] hover:bg-[#4d5156] text-white border-none">
                        <Hand className="h-[20px] w-[20px]" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-[40px] w-[40px] rounded-full bg-[#3c4043] hover:bg-[#4d5156] text-white border-none">
                        <MoreVertical className="h-[20px] w-[20px]" />
                    </Button>
                    
                    {/* Custom Hangup behavior handling via wrapper */}
                    <div className="px-2">
                        <Button
                            variant="destructive"
                            className="h-[40px] w-[60px] rounded-full bg-[#ea4335] hover:bg-[#d93025] border-none shadow-sm flex items-center justify-center"
                            onClick={onLeave}
                        >
                            <PhoneOff className="h-[20px] w-[20px] text-white" />
                        </Button>
                    </div>
                </div>

                {/* Right: Side panel toggles */}
                <div className="flex items-center gap-1 w-[250px] justify-end">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-white hover:bg-[#3c4043]" onClick={() => setShowInfo(!showInfo)}>
                        <Info className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-white hover:bg-[#3c4043]">
                        <Users className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-white hover:bg-[#3c4043]">
                        <MessageSquare className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-white hover:bg-[#3c4043]">
                        <Shield className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

function VideoComponent() {
    const connectionState = useConnectionState()
    
    // Collect all camera tracks and screen share tracks from the room
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    )
    
    if (connectionState === ConnectionState.Connecting) {
        return (
            <div className="w-full h-full bg-[#3c4043] rounded-xl flex items-center justify-center flex-col gap-4">
                <div className="w-8 h-8 rounded-full border-4 border-[#8ab4f8] border-t-transparent animate-spin"></div>
                <span className="text-white text-lg font-medium">Connexion au serveur...</span>
            </div>
        )
    }

    if (connectionState === ConnectionState.Disconnected) {
        return (
            <div className="w-full h-full bg-[#3c4043] rounded-xl flex items-center justify-center flex-col gap-2">
                <span className="text-[#ea4335] text-lg font-medium">Impossible de se connecter au serveur</span>
                <span className="text-gray-300 text-sm">Vérifiez que LiveKit tourne sur {process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880"}</span>
            </div>
        )
    }

    return (
        <GridLayout tracks={tracks} style={{ height: '100%', width: '100%' }}>
            <ParticipantTile />
        </GridLayout>
    )
}
