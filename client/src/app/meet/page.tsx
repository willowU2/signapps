"use client"

import { useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MeetRoom } from "@/components/meet/meet-room"

export default function MeetPage() {
    const [roomId, setRoomId] = useState("")
    const [inRoom, setInRoom] = useState(false)
    const [joinedRoomId, setJoinedRoomId] = useState("")

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault()
        if (roomId.trim()) {
            setJoinedRoomId(roomId)
            setInRoom(true)
        }
    }

    return (
        <AppLayout>
            <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center">
                {!inRoom ? (
                    <div className="w-full max-w-md p-8 border rounded-lg bg-card shadow-sm space-y-6">
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-bold">Workspace Meet</h1>
                            <p className="text-muted-foreground">Join a meeting room to start video calling</p>
                        </div>
                        <form onSubmit={handleJoin} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    placeholder="Enter Room ID (e.g. daily-standup)"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full" size="lg">Join Meeting</Button>
                        </form>
                    </div>
                ) : (
                    <MeetRoom roomId={joinedRoomId} onLeave={() => setInRoom(false)} />
                )}
            </div>
        </AppLayout>
    )
}
