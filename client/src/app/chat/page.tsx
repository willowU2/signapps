"use client"

import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { EmptyChatState } from "@/components/chat/empty-chat-state"
import { Menu, MessageSquare, Video, Settings, Search, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkspaceShell } from "@/components/layout/workspace-shell"
import { useSelectedChannel, useChatActions } from "@/lib/store/chat-store"

export default function ChatPage() {
    const selectedChannel = useSelectedChannel()
    const { setSelectedChannel } = useChatActions()

    return (
        <WorkspaceShell
            className="bg-[#f2f6fc]"
            header={
                <header className="h-16 flex items-center justify-between px-4 bg-[#f2f6fc] shrink-0">
                    <div className="flex items-center gap-4 w-[250px]">
                        <Button variant="ghost" size="icon" className="text-[#444746] hover:bg-black/5 rounded-full">
                            <Menu className="h-6 w-6" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-6 w-6 text-[#1a73e8]" />
                            <span className="text-xl font-normal text-[#444746]">Chat</span>
                        </div>
                    </div>

                    <div className="flex-1 max-w-[720px] px-4">
                        <div className="flex items-center bg-[#eaf1fb] px-4 py-2 rounded-full h-12 w-full">
                            <Search className="h-5 w-5 text-[#444746] mr-4" />
                            <input 
                                type="text" 
                                placeholder="Rechercher une discussion" 
                                className="bg-transparent border-none outline-none flex-1 text-base placeholder-[#444746]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden md:flex items-center bg-background px-3 py-1.5 rounded-full border shadow-sm mr-2 cursor-pointer hover:bg-gray-50">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                            <span className="text-sm font-medium text-[#444746]">Actif</span>
                            <ChevronDown className="h-4 w-4 text-[#444746] ml-2" />
                        </div>
                        <Button variant="ghost" size="icon" className="text-[#444746] hover:bg-black/5 rounded-full">
                            <Settings className="h-6 w-6" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-[#444746] hover:bg-black/5 rounded-full">
                            <Settings className="h-6 w-6" />
                        </Button>
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium ml-2 cursor-pointer">
                            E
                        </div>
                    </div>
                </header>
            }
            sidebar={
                <div className="w-[260px] flex flex-col shrink-0 mt-2 mr-2">
                    <ChatSidebar
                        selectedChannel={selectedChannel}
                        onSelectChannel={setSelectedChannel}
                    />
                </div>
            }
        >
            <div className="flex-1 glass-panel rounded-2xl shadow-premium border border-border/50 overflow-hidden flex flex-col min-w-0 mt-2 mb-2">
                {selectedChannel ? (
                    <ChatWindow channelId={selectedChannel} />
                ) : (
                    <EmptyChatState />
                )}
            </div>
        </WorkspaceShell>
    )
}
