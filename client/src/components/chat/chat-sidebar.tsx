"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MessageSquare, Hash, Plus, Loader2, Search, Settings, ChevronDown, Bell } from "lucide-react"
import { chatApi, Channel } from "@/lib/api/chat"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ChatSidebarProps {
    selectedChannel: string | null
    onSelectChannel: (id: string) => void
}

const DMS = [
    { id: "dm-1", name: "Alice Smith", type: "dm", status: "online", unread: 2 },
    { id: "dm-2", name: "Bob Jones", type: "dm", status: "offline", unread: 0 },
    { id: "dm-3", name: "Charlie Team", type: "dm", status: "away", unread: 0 },
]

export function ChatSidebar({ selectedChannel, onSelectChannel }: ChatSidebarProps) {
    const [channels, setChannels] = useState<Channel[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

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

    const filteredChannels = channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    const filteredDMs = DMS.filter(dm => dm.name.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div className="flex flex-col h-full bg-muted/20 backdrop-blur-3xl shadow-[inset_-1px_0_0_rgba(0,0,0,0.05)]">
            {/* Header Area */}
            <div className="p-4 py-3 flex items-center justify-between border-b bg-background/50">
                <Button variant="ghost" className="px-2 -ml-2 font-semibold text-lg tracking-tight hover:bg-transparent flex items-center gap-1.5 focus-visible:ring-0">
                    SignApps Chat
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-accent/50">
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" onClick={handleCreateChannel}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="p-3 pb-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search conversations..."
                        className="pl-8 bg-background/50 border-none shadow-sm h-8 text-sm focus-visible:ring-1 transition-all rounded-md"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-3 mt-4">
                <div className="space-y-6 pb-4">
                    {/* Spaces / Channels */}
                    <div>
                        <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer">
                            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
                                Spaces
                            </h3>
                            <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {isLoading ? (
                            <div className="px-2 flex items-center gap-2 text-muted-foreground text-sm pt-2">
                                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filteredChannels.map((channel) => (
                                    <Button
                                        key={channel.id}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-2.5 h-8 px-2 text-sm font-medium rounded-md transition-colors",
                                            selectedChannel === channel.id
                                                ? "bg-accent/80 text-accent-foreground font-semibold shadow-sm"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                        onClick={() => onSelectChannel(channel.id)}
                                    >
                                        <div className="flex items-center justify-center w-5 h-5 rounded bg-muted-foreground/10 text-muted-foreground shrink-0">
                                            <Hash className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="truncate flex-1 text-left">{channel.name}</span>
                                        {/* Mock unread badge for demonstration */}
                                        {channel.name === 'general' && selectedChannel !== channel.id && (
                                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                                                3
                                            </span>
                                        )}
                                    </Button>
                                ))}
                                {filteredChannels.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground italic">
                                        No spaces found.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Direct Messages */}
                    <div>
                        <div className="flex items-center justify-between px-2 mb-1 group cursor-pointer">
                            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
                                Direct Messages
                            </h3>
                            <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="space-y-0.5">
                            {filteredDMs.map((dm) => (
                                <Button
                                    key={dm.id}
                                    variant="ghost"
                                    className={cn(
                                        "w-full justify-start gap-2.5 h-[34px] px-2 text-sm rounded-md transition-colors",
                                        selectedChannel === dm.id
                                            ? "bg-accent/80 text-accent-foreground font-semibold shadow-sm"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                    onClick={() => onSelectChannel(dm.id)}
                                >
                                    <div className="relative shrink-0">
                                        <Avatar className="h-5 w-5 rounded-sm">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.name}`} />
                                            <AvatarFallback className="rounded-sm bg-primary/10 text-primary text-[9px]">{dm.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        {dm.status === "online" && (
                                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-background/80" />
                                        )}
                                        {dm.status === "away" && (
                                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-500 ring-2 ring-background/80" />
                                        )}
                                    </div>
                                    <span className={cn("truncate flex-1 text-left", dm.unread > 0 && selectedChannel !== dm.id ? "font-bold text-foreground" : "")}>
                                        {dm.name}
                                    </span>
                                    {dm.unread > 0 && selectedChannel !== dm.id && (
                                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                                            {dm.unread}
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
