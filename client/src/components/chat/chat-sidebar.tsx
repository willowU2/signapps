"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { MessageSquare, Hash, User, Plus, Loader2 } from "lucide-react"
import { chatApi, Channel } from "@/lib/api/chat"

interface ChatSidebarProps {
    selectedChannel: string | null
    onSelectChannel: (id: string) => void
}

const DMS = [
    { id: "dm-1", name: "Alice Smith", type: "dm", status: "online" },
    { id: "dm-2", name: "Bob Jones", type: "dm", status: "offline" },
]

export function ChatSidebar({ selectedChannel, onSelectChannel }: ChatSidebarProps) {
    const [channels, setChannels] = useState<Channel[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        loadChannels()
    }, [])

    const loadChannels = async () => {
        try {
            const response = await chatApi.getChannels()
            setChannels(response.data)
        } catch (error) {
            console.error("Failed to load channels", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateChannel = async () => {
        const name = prompt("Enter channel name:")
        if (!name) return

        try {
            const response = await chatApi.createChannel({ name, is_private: false })
            const newChannel = response.data
            setChannels([newChannel, ...channels])
            onSelectChannel(newChannel.id)
        } catch (error) {
            console.error("Failed to create channel", error)
            alert("Failed to create channel")
        }
    }

    return (
        <div className="flex flex-col h-full bg-muted/10">
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-semibold text-lg tracking-tight">Messages</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCreateChannel}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 px-2">
                <div className="py-4 space-y-4">
                    <div>
                        <h3 className="px-2 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            Channels
                        </h3>
                        {isLoading ? (
                            <div className="px-2 flex items-center gap-2 text-muted-foreground text-sm">
                                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {channels.map((channel) => (
                                    <Button
                                        key={channel.id}
                                        variant={selectedChannel === channel.id ? "secondary" : "ghost"}
                                        className="w-full justify-start gap-2 h-9"
                                        onClick={() => onSelectChannel(channel.id)}
                                    >
                                        <Hash className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{channel.name}</span>
                                    </Button>
                                ))}
                                {channels.length === 0 && (
                                    <div className="px-2 text-xs text-muted-foreground italic">
                                        No channels yet
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="px-2 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            Direct Messages
                        </h3>
                        <div className="space-y-1">
                            {DMS.map((dm) => (
                                <Button
                                    key={dm.id}
                                    variant={selectedChannel === dm.id ? "secondary" : "ghost"}
                                    className="w-full justify-start gap-2 h-9"
                                    onClick={() => onSelectChannel(dm.id)}
                                >
                                    <div className="relative">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        {dm.status === "online" && (
                                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border-2 border-background" />
                                        )}
                                    </div>
                                    <span className="truncate">{dm.name}</span>
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
