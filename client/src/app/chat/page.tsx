"use client"

import { useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatWindow } from "@/components/chat/chat-window"

export default function ChatPage() {
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

    return (
        <AppLayout>
            <div className="flex h-[calc(100vh-8rem)] w-full border rounded-lg overflow-hidden bg-background shadow-sm">
                <div className="w-72 border-r flex flex-col bg-muted/5">
                    <ChatSidebar
                        selectedChannel={selectedChannel}
                        onSelectChannel={setSelectedChannel}
                    />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                    {selectedChannel ? (
                        <ChatWindow channelId={selectedChannel} />
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground flex-col gap-2">
                            <span className="text-xl font-semibold">Welcome to Chat</span>
                            <span className="text-sm">Select a channel or user to start messaging</span>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    )
}
