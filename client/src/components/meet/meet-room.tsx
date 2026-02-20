"use client"

import { useEffect, useRef, useState } from "react"
import { useMeet } from "@/hooks/use-meet"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react"

interface MeetRoomProps {
    roomId: string
    onLeave: () => void
}

export function MeetRoom({ roomId, onLeave }: MeetRoomProps) {
    // Generate random user for now
    const [user] = useState(() => ({
        id: "user-" + Math.floor(Math.random() * 10000),
        name: "User " + Math.floor(Math.random() * 10000)
    }))

    const { localStream, peers, isConnected } = useMeet(roomId, user.id, user.name)
    const localVideoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream
        }
    }, [localStream])

    return (
        <div className="flex flex-col h-full w-full bg-black/90 rounded-xl overflow-hidden relative">
            {/* Header */}
            <div className="absolute top-4 left-4 z-10 bg-black/50 px-3 py-1 rounded-full text-white text-sm backdrop-blur">
                Room: {roomId} ({isConnected ? "Connected" : "Connecting..."})
            </div>

            {/* Video Grid */}
            <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                {/* Local Video */}
                <div className="relative bg-muted rounded-lg overflow-hidden aspect-video border-2 border-primary/50">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover transform scale-x-[-1]"
                    />
                    <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                        You ({user.name})
                    </div>
                </div>

                {/* Remote Peers */}
                {peers.map(peer => (
                    <PeerVideo key={peer.id} peer={peer} />
                ))}
            </div>

            {/* Controls */}
            <div className="h-20 bg-background/10 backdrop-blur border-t border-white/10 flex items-center justify-center gap-4">
                <Button variant="secondary" size="icon" className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0">
                    <Mic className="h-5 w-5" />
                </Button>
                <Button variant="secondary" size="icon" className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0">
                    <Video className="h-5 w-5" />
                </Button>
                <Button
                    variant="destructive"
                    size="icon"
                    className="rounded-full h-12 w-12"
                    onClick={onLeave}
                >
                    <PhoneOff className="h-6 w-6" />
                </Button>
            </div>
        </div>
    )
}

function PeerVideo({ peer }: { peer: { id: string, stream: MediaStream } }) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (peer.stream && videoRef.current) {
            videoRef.current.srcObject = peer.stream
        }
    }, [peer.stream])

    return (
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                Peer {peer.id}
            </div>
        </div>
    )
}
