"use client"

import { useState } from "react"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { GlobalHeader } from "@/components/layout/global-header"
import { Menu, MessageSquare, Hash, Video, Settings, Search, Layers, Columns, ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ChatPage() {
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

    return (
        <div className="flex flex-col h-screen w-screen bg-[#f2f6fc] overflow-hidden">
            {/* Header Global (Simplifié pour correspondre à Gmail/Chat Workspace) */}
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
                        <Settings className="h-6 w-6" />{/* App drawer icon replacement */}
                    </Button>
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium ml-2 cursor-pointer">
                        E
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden p-2 pt-0 gap-2">
                {/* Rail Gauche Extrême */}
                <div className="w-[72px] flex flex-col items-center py-2 gap-4 shrink-0 mt-2">
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

                {/* Panneau Latéral (Sidebar Chat) */}
                <div className="w-[260px] flex flex-col shrink-0 mt-2">
                    <ChatSidebar
                        selectedChannel={selectedChannel}
                        onSelectChannel={setSelectedChannel}
                    />
                </div>

                {/* Zone Principale (Chat Window) */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col min-w-0">
                    {selectedChannel ? (
                        <ChatWindow channelId={selectedChannel} />
                    ) : (
                        <div className="flex h-full items-center justify-center flex-col bg-white">
                            <div className="w-64 h-64 flex items-center justify-center relative mb-6">
                                {/* SVG Illustration type "Google Chat Empty State" */}
                                <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M120 150H80C50 150 40 140 40 110V80C40 50 50 40 80 40H110V20L150 50V110C150 140 140 150 120 150Z" fill="#F8F9FA" stroke="#DADCE0" strokeWidth="2"/>
                                    <path d="M140 120H100C80 120 70 110 70 90V60H110C130 60 140 70 140 90V120Z" fill="white" stroke="#DADCE0" strokeWidth="2"/>
                                    <rect x="85" y="75" width="40" height="4" rx="2" fill="#E8EAED"/>
                                    <rect x="85" y="85" width="30" height="4" rx="2" fill="#E8EAED"/>
                                    <path d="M110 160L90 140H130L110 160Z" fill="#DADCE0"/>
                                    <circle cx="105" cy="110" r="16" fill="#FCE8E6"/>
                                    <circle cx="105" cy="110" r="8" fill="#EA4335"/>
                                </svg>
                            </div>
                            <span className="text-[22px] font-normal text-[#1f1f1f] mb-2">Aucune conversation sélectionnée</span>
                            <span className="text-sm text-[#444746]">
                                Appuyez sur le bouton pour activer le mode Simple volet ou Double volet
                            </span>
                        </div>
                    )}
                </div>

                {/* Barre Latérale Droite (Add-ons) */}
                <div className="w-14 flex flex-col items-center py-4 shrink-0 bg-[#f2f6fc] gap-6 mt-2">
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
            </div>
        </div>
    )
}
