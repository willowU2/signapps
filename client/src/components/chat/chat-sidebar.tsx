"use client"

import { SpinnerInfinity } from 'spinners-react';

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { MessageSquare, Hash, Plus, ChevronDown, Users, X } from 'lucide-react';
import { chatApi, Channel, DirectMessage } from "@/lib/api/chat"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FEATURES } from "@/lib/features"
import { useAuth } from "@/hooks/use-auth"
import { useSelectedChannel, useSelectedChannelName, useChatActions, useIsDm, useUsersMap, useHiddenDms } from "@/lib/store/chat-store"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface ChatSidebarProps {
    selectedChannel: string | null
    onSelectChannel: (id: string, name?: string, isDm?: boolean) => void
}

interface DmDisplay {
    id: string
    name: string
    recipientId?: string
    status: 'online' | 'offline' | 'away'
    unread: number
}

export function ChatSidebar({ selectedChannel, onSelectChannel }: ChatSidebarProps) {
    const [channels, setChannels] = useState<Channel[]>([])
    const [directMessages, setDirectMessages] = useState<DmDisplay[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    const { user } = useAuth()
    const usersMap = useUsersMap()
    const hiddenDms = useHiddenDms()
    const { setSelectedChannel, clearSelectedChannel, hideDm, unhideDm } = useChatActions()
    // Channel creation dialog
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [newChannelName, setNewChannelName] = useState("")
    const [newChannelTopic, setNewChannelTopic] = useState("")
    const [newChannelPrivate, setNewChannelPrivate] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    // DM creation dialog
    const [dmDialogOpen, setDmDialogOpen] = useState(false)
    const [isCreatingDm, setIsCreatingDm] = useState(false)

    const loadData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Load channels
            const channelsResponse = await chatApi.getChannels()
            setChannels(channelsResponse.data || [])

            // Load DMs
            try {
                const dmsResponse = await chatApi.getDirectMessages()
                const dms = (dmsResponse.data || []).map((dm: DirectMessage) => {
                    const otherParticipants = dm.participants.filter(p => p.user_id !== user?.id);
                    let dmName = "Direct Message";
                    let recipientId: string | undefined = undefined;

                    if (otherParticipants.length > 0) {
                        const names = otherParticipants.map(op => {
                            const u = usersMap[op.user_id];
                            if (u && (u.display_name || u.username || u.email)) return u.display_name || u.username || u.email;
                            if (op.username && op.username.trim() !== "") return op.username;
                            return "Utilisateur";
                        });
                        dmName = names.join(", ");
                        recipientId = otherParticipants[0].user_id;
                    }

                    return {
                        id: dm.id,
                        name: dmName,
                        recipientId,
                        status: FEATURES.CHAT_PRESENCE ? 'online' as const : 'offline' as const,
                        unread: FEATURES.CHAT_UNREAD_COUNT ? 0 : 0,
                    };
                })
                setDirectMessages(dms)
            } catch {
                // DMs might not exist yet, use empty array
                setDirectMessages([])
            }
        } catch (error) {
            console.debug("Failed to load chat data", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) {
            toast.error("Channel name is required")
            return
        }

        setIsCreating(true)
        try {
            const response = await chatApi.createChannel({
                name: newChannelName.trim(),
                topic: newChannelTopic.trim() || undefined,
                is_private: newChannelPrivate,
            })
            const newChannel = response.data
            setChannels([newChannel, ...channels])
            onSelectChannel(newChannel.id, newChannel.name)
            setCreateDialogOpen(false)
            setNewChannelName("")
            setNewChannelTopic("")
            setNewChannelPrivate(false)
            toast.success("Channel created")
        } catch (error) {
            console.debug("Failed to create channel", error)
            toast.error("Failed to create channel")
        } finally {
            setIsCreating(false)
        }
    }

    const handleCreateDm = async (userId: string) => {
        // Rediriger vers le DM existant s'il y en a un
        const existingDm = directMessages.find(dm => dm.recipientId === userId)
        if (existingDm) {
            unhideDm(existingDm.id) // Restore the DM if it was previously hidden
            onSelectChannel(existingDm.id, existingDm.name, true)
            setDmDialogOpen(false)
            return
        }

        setIsCreatingDm(true)
        try {
            const response = await chatApi.createDirectMessage({ participant_ids: [userId] })
            const dm = response.data
            
            const otherParticipants = dm.participants.filter(p => p.user_id !== user?.id);
            let dmName = "Direct Message";
            let recipientId: string | undefined = undefined;

            if (otherParticipants.length > 0) {
                const names = otherParticipants.map(op => {
                    const u = usersMap[op.user_id];
                    if (u && (u.display_name || u.username || u.email)) return u.display_name || u.username || u.email;
                    if (op.username && op.username.trim() !== "") return op.username;
                    return "Utilisateur";
                });
                dmName = names.join(", ");
                recipientId = otherParticipants[0].user_id;
            }

            const newDmDisplay: DmDisplay = {
                id: dm.id,
                name: dmName,
                recipientId,
                status: FEATURES.CHAT_PRESENCE ? 'online' : 'offline',
                unread: 0
            }
            if (!directMessages.find(d => d.id === dm.id)) {
                setDirectMessages([newDmDisplay, ...directMessages])
            }
            onSelectChannel(newDmDisplay.id, newDmDisplay.name, true)
            setDmDialogOpen(false)
        } catch (error) {
            console.error("Failed to create DM", error)
            toast.error("Failed to start conversation")
        } finally {
            setIsCreatingDm(false)
        }
    }

    const handleDeleteDm = async (e: React.MouseEvent, dmId: string) => {
        e.stopPropagation();
        try {
            // On masquait physiquement le DM avant, maintenant on le cache simplement côté UI
            hideDm(dmId);
            if (selectedChannel === dmId) {
                onSelectChannel("accueil", "Accueil", false);
            }
            toast.success("Conversation supprimée");
        } catch (error) {
            console.error("Failed to delete DM", error);
            toast.error("Échec de la suppression");
        }
    }

    const filteredChannels = channels.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    const filteredDMs = directMessages.filter(dm =>
        !hiddenDms.includes(dm.id) && dm.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex flex-col h-full bg-[#f2f6fc] text-[#1f1f1f]">
            {/* Header Area */}
            <div className="p-4 py-3 flex items-center justify-between">
                <Button
                    variant="ghost"
                    className="px-2 -ml-2 font-semibold text-lg hover:bg-transparent flex items-center gap-1.5 focus-visible:ring-0"
                    onClick={() => setCreateDialogOpen(true)}
                >
                    Nouveau chat
                </Button>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-black/5"
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 px-3 mt-2">
                <div className="space-y-4 pb-4">
                    {/* Accueil, Mentions, Suivis */}
                    <div className="space-y-0.5">
                        <Button
                            variant="ghost"
                            className={cn(
                                "w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full transition-colors",
                                selectedChannel === "accueil"
                                    ? "bg-[#d3e3fd] text-[#001d35] font-semibold"
                                    : "text-[#444746] hover:bg-black/5"
                            )}
                            onClick={() => onSelectChannel("accueil", "Accueil", false)}
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span className="truncate flex-1 text-left">Accueil</span>
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full transition-colors text-[#444746] hover:bg-black/5"
                        >
                            <span className="font-bold text-lg leading-none mt-[-4px]">@</span>
                            <span className="truncate flex-1 text-left">Mentions</span>
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full transition-colors text-[#444746] hover:bg-black/5"
                        >
                            <span className="font-bold text-lg leading-none mt-[-4px]">☆</span>
                            <span className="truncate flex-1 text-left">Suivis</span>
                        </Button>
                    </div>

                    {/* Messages privés */}
                    <div>
                        <div className="flex items-center justify-between px-3 h-8 group hover:bg-black/5 rounded-full cursor-pointer transition-colors mb-1">
                            <h3 className="text-xs font-semibold text-[#444746] flex items-center gap-2">
                                <ChevronDown className="h-3 w-3" />
                                Messages privés
                            </h3>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 bg-transparent hover:bg-black/10 rounded overflow-hidden"
                                onClick={(e) => { e.stopPropagation(); setDmDialogOpen(true); }}
                            >
                                <Plus className="h-4 w-4 text-[#444746]" />
                            </Button>
                        </div>
                        <div className="space-y-0.5">
                            {filteredDMs.length === 0 && !isLoading && (
                                <p className="px-3 text-xs text-muted-foreground py-2">
                                    Aucune conversation privée
                                </p>
                            )}
                            {filteredDMs.map((dm) => {
                                const targetUser = dm.recipientId ? usersMap[dm.recipientId] : undefined;
                                
                                let dynamicName = dm.name;
                                if (targetUser) {
                                    const dn = targetUser.display_name?.trim();
                                    const un = targetUser.username?.trim();
                                    if (dn && dn.length > 0) dynamicName = dn;
                                    else if (un && un.length > 0) dynamicName = un;
                                    else if (targetUser.email) dynamicName = targetUser.email.split('@')[0];
                                }

                                const avatarUrl = targetUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dynamicName}`;

                                return (
                                    <Button
                                        key={dm.id}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-3 h-8 px-3 text-sm rounded-full transition-colors group relative pr-8",
                                            selectedChannel === dm.id
                                                ? "bg-[#d3e3fd] text-[#001d35] font-semibold"
                                                : "text-[#444746] hover:bg-black/5"
                                        )}
                                        onClick={() => onSelectChannel(dm.id, dynamicName, true)}
                                    >
                                        <div className="relative shrink-0 flex items-center justify-center">
                                            <div className="h-6 w-6 rounded-full overflow-hidden flex-shrink-0">
                                                <Avatar className="h-full w-full">
                                                    <AvatarImage src={avatarUrl} />
                                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{dynamicName.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                            {FEATURES.CHAT_PRESENCE && dm.status === "online" && (
                                                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border border-white" />
                                            )}
                                        </div>
                                        <span className={cn("truncate flex-1 text-left", dm.unread > 0 && selectedChannel !== dm.id ? "font-bold text-foreground" : "")}>
                                            {dynamicName}
                                        </span>
                                        {FEATURES.CHAT_UNREAD_COUNT && dm.unread > 0 && selectedChannel !== dm.id && (
                                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
                                                {dm.unread}
                                            </span>
                                        )}
                                        
                                        <div 
                                            className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded-full"
                                            onClick={(e) => handleDeleteDm(e, dm.id)}
                                            title="Supprimer la conversation"
                                        >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Espaces */}
                    <div>
                         <div className="flex items-center justify-between px-3 h-8 group hover:bg-black/5 rounded-full cursor-pointer transition-colors mb-1">
                            <h3 className="text-xs font-semibold text-[#444746] flex items-center gap-2">
                                <ChevronDown className="h-3 w-3" />
                                Espaces
                            </h3>
                            <Plus className="h-4 w-4 text-[#444746] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {isLoading ? (
                            <div className="px-3 flex items-center gap-2 text-[#444746] text-sm pt-2">
                                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3 w-3 " /> Chargement...
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filteredChannels.map((channel) => (
                                    <Button
                                        key={channel.id}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full transition-colors",
                                            selectedChannel === channel.id
                                                ? "bg-[#d3e3fd] text-[#001d35] font-semibold"
                                                : "text-[#444746] hover:bg-black/5"
                                        )}
                                        onClick={() => onSelectChannel(channel.id, channel.name, false)}
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded bg-[#e8eaed] text-[#444746] shrink-0">
                                            {(channel as any).is_private ? <Hash className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
                                        </div>
                                        <span className="truncate flex-1 text-left">{channel.name}</span>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Create Channel Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Créer un espace</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="channel-name">Nom de l&apos;espace</Label>
                            <Input
                                id="channel-name"
                                placeholder="ex: projet-alpha"
                                value={newChannelName}
                                onChange={(e) => setNewChannelName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="channel-topic">Description (optionnel)</Label>
                            <Input
                                id="channel-topic"
                                placeholder="De quoi parle cet espace ?"
                                value={newChannelTopic}
                                onChange={(e) => setNewChannelTopic(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="channel-private">Espace privé</Label>
                                <p className="text-xs text-muted-foreground">
                                    Seuls les membres invités peuvent voir cet espace
                                </p>
                            </div>
                            <Switch
                                id="channel-private"
                                checked={newChannelPrivate}
                                onCheckedChange={setNewChannelPrivate}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCreateDialogOpen(false)}
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleCreateChannel}
                            disabled={isCreating || !newChannelName.trim()}
                        >
                            {isCreating && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                            Créer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create DM Dialog */}
            <Dialog open={dmDialogOpen} onOpenChange={setDmDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Nouveau message privé</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 py-4 max-h-[300px] overflow-y-auto pr-2">
                        {Object.values(usersMap)
                            .filter(u => u.id !== user?.id)
                            .map((u) => (
                                <div 
                                    key={u.id} 
                                    className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer border border-transparent hover:border-border transition-all"
                                    onClick={() => handleCreateDm(u.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} />
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{u.username.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium leading-none">{u.display_name || u.username || u.email || "Utilisateur"}</span>
                                            {(u.display_name || u.username) && <span className="text-xs text-muted-foreground mt-1">@{u.username || u.email}</span>}
                                        </div>
                                    </div>
                                    {isCreatingDm && <SpinnerInfinity size={20} />}
                                </div>
                            ))
                        }
                        {Object.keys(usersMap).length <= 1 && (
                            <div className="text-sm text-center text-muted-foreground py-4">
                                Aucun autre utilisateur trouvé.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
