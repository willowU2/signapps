"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MeetRoom } from "@/components/meet/meet-room"
import { Copy, Plus, Video } from "lucide-react"
import { toast } from "sonner"

export default function MeetPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    
    const [roomId, setRoomId] = useState("")
    const [inRoom, setInRoom] = useState(false)
    const [joinedRoomId, setJoinedRoomId] = useState("")
    const [token, setToken] = useState("")
    const [isConnecting, setIsConnecting] = useState(false)

    useEffect(() => {
        const roomQuery = searchParams.get("room")
        if (roomQuery) {
            setRoomId(roomQuery)
        }
    }, [searchParams])

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (roomId.trim()) {
            try {
                setIsConnecting(true)
                const res = await fetch(`/api/livekit/get-token?room=${encodeURIComponent(roomId)}&username=User`)
                const data = await res.json()
                
                if (data.token) {
                    setToken(data.token)
                    setJoinedRoomId(roomId)
                    setInRoom(true)
                } else {
                    console.error("Failed to get token", data)
                }
            } catch (err) {
                console.error("Error fetching LiveKit token:", err)
            } finally {
                setIsConnecting(false)
            }
        }
    }

    const handleNewMeeting = () => {
        const newRoomId = `meet-${Math.random().toString(36).substring(2, 9)}`
        setRoomId(newRoomId)
        
        const joinLink = `${window.location.origin}/meet?room=${newRoomId}`
        navigator.clipboard.writeText(joinLink).then(() => {
            toast.success("Lien de la réunion copié !", {
                description: "Vous pouvez le partager avec d'autres participants."
            })
            
            // Optionally auto-join or just let the user click Rejoindre
        }).catch(() => {
            toast.error("Erreur lors de la copie du lien.")
        })
    }

    return (
        <AppLayout>
            <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center">
                {!inRoom ? (
                    <div className="w-full max-w-md p-8 border rounded-lg bg-card shadow-sm space-y-6">
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-bold">Workspace Meet</h1>
                            <p className="text-muted-foreground">Rejoindre une salle de visioconférence</p>
                        </div>
                        <form onSubmit={handleJoin} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    placeholder="Code de la réunion (ex: daily-standup)"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    disabled={isConnecting}
                                />
                            </div>
                            <Button type="submit" className="w-full" size="lg" disabled={isConnecting}>
                                <Video className="w-4 h-4 mr-2" />
                                {isConnecting ? "Connexion..." : "Rejoindre"}
                            </Button>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">ou</span>
                            </div>
                        </div>

                        <Button 
                            variant="outline" 
                            className="w-full" 
                            size="lg" 
                            onClick={handleNewMeeting}
                            disabled={isConnecting}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle réunion
                        </Button>
                    </div>
                ) : (
                    <MeetRoom 
                        roomId={joinedRoomId} 
                        token={token}
                        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880"}
                        onLeave={() => {
                            setInRoom(false)
                            setToken("")
                            // Clear URL params if desired, but keep it simple for now
                        }} 
                    />
                )}
            </div>
        </AppLayout>
    )
}
