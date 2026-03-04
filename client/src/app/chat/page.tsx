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
                        <div className="hidden md:flex items-center bg-white px-3 py-1.5 rounded-full border shadow-sm mr-2 cursor-pointer hover:bg-gray-50">
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
            leftRail={
                <div className="w-[72px] flex flex-col items-center py-0 gap-4 shrink-0 mt-2">
                     <div className="flex flex-col items-center gap-1 cursor-pointer group">
                        <div className="w-12 h-8 rounded-full flex items-center justify-center text-[#444746] group-hover:bg-black/5">
                            <span className="relative">
                               <MessageSquare className="h-5 w-5" />
                            </span>
                        </div>
                        <span className="text-[11px] font-medium text-[#444746]">Mail</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 cursor-pointer group">
                        <div className="w-12 h-8 rounded-full flex items-center justify-center bg-[#d3e3fd] text-[#001d35]">
                            <span className="relative">
                               <MessageSquare className="h-5 w-5" />
                               <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#b3261e] text-[9px] font-bold text-white px-1 border-2 border-[#f2f6fc]">
                                   99+
                               </span>
                            </span>
                        </div>
                        <span className="text-[11px] font-bold text-[#001d35]">Chat</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 cursor-pointer group">
                        <div className="w-12 h-8 rounded-full flex items-center justify-center text-[#444746] group-hover:bg-black/5">
                            <Video className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-medium text-[#444746]">Meet</span>
                    </div>
                </div>
            }
            sidebar={
                <div className="w-[260px] flex flex-col shrink-0 mt-2 mr-2">
                    <ChatSidebar
                        selectedChannel={selectedChannel}
                        onSelectChannel={setSelectedChannel}
                    />
                </div>
            }
            rightRail={
                <div className="w-14 flex flex-col items-center py-4 shrink-0 bg-[#f2f6fc] gap-6 mt-2 mr-2">
                     <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/5">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Calendar" className="w-5 h-5"/>
                     </div>
                     <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/5">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/e5/Google_Keep_icon_%282020%29.svg" alt="Keep" className="w-5 h-5"/>
                     </div>
                     <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/5">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Google_Tasks_2021.svg" alt="Tasks" className="w-5 h-5"/>
                     </div>
                     <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/5">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/9/93/Google_Contacts_icon.svg" alt="Contacts" className="w-5 h-5"/>
                     </div>
                     <div className="w-5 border-b border-[#dadce0] my-2"></div>
                     <div className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/5 text-[#444746]">
                        <Plus className="w-5 h-5"/>
                     </div>
                </div>
            }
        >
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0 mt-2 mb-2">
                {selectedChannel ? (
                    <ChatWindow channelId={selectedChannel} />
                ) : (
                    <EmptyChatState />
                )}
            </div>
        </WorkspaceShell>
    )
}
