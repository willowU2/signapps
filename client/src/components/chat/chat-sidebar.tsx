"use client"

import { SpinnerInfinity } from 'spinners-react';
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { MessageSquare, Hash, Plus, ChevronDown, X, Lock, Globe } from 'lucide-react';
import { chatApi, Channel, DirectMessage, PresenceEntry } from "@/lib/api/chat"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FEATURES } from "@/lib/features"
import { useAuth } from "@/hooks/use-auth"
import { useSelectedChannel, useChatActions, useUsersMap, useHiddenDms } from "@/lib/store/chat-store"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface ChatSidebarProps {
    selectedChannel: string | null
    onSelectChannel: (id: string, name?: string, isDm?: boolean, isPrivate?: boolean) => void
}

interface DmDisplay {
    id: string
    name: string
    recipientId?: string
    status: 'online' | 'offline' | 'away' | 'busy'
    unread: number
}

const STATUS_COLORS: Record<string, string> = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
}

export function ChatSidebar({ selectedChannel, onSelectChannel }: ChatSidebarProps) {
    const [channels, setChannels] = useState<Channel[]>([])
    const [directMessages, setDirectMessages] = useState<DmDisplay[]>([])
    const [presenceMap, setPresenceMap] = useState<Record<string, PresenceEntry>>({})
    const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    const { user } = useAuth()
    const usersMap = useUsersMap()
    const hiddenDms = useHiddenDms()
    const { setSelectedChannel, hideDm, unhideDm } = useChatActions()

    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [newChannelName, setNewChannelName] = useState("")
    const [newChannelTopic, setNewChannelTopic] = useState("")
    const [newChannelPrivate, setNewChannelPrivate] = useState(false)
    const [isCreating, setIsCreating] = useState(false)

    const [dmDialogOpen, setDmDialogOpen] = useState(false)
    const [isCreatingDm, setIsCreatingDm] = useState(false)

    const loadData = useCallback(async () => {
        setIsLoading(true)
        try {
            const channelsRes = await chatApi.getChannels()
            setChannels(channelsRes.data || [])

            try {
                const dmsRes = await chatApi.getDirectMessages()
                const dms = (dmsRes.data || []).map((dm: DirectMessage) => {
                    const others = dm.participants.filter(p => p.user_id !== user?.id)
                    let dmName = "Direct Message"
                    let recipientId: string | undefined

                    if (others.length > 0) {
                        const names = others.map(op => {
                            const u = usersMap[op.user_id]
                            if (u && (u.display_name || u.username || u.email)) return u.display_name || u.username || u.email
                            if (op.username?.trim()) return op.username
                            return "Utilisateur"
                        })
                        dmName = names.join(", ")
                        recipientId = others[0].user_id
                    }

                    return { id: dm.id, name: dmName, recipientId, status: 'offline' as const, unread: 0 }
                })
                setDirectMessages(dms)
            } catch { setDirectMessages([]) }

            // IDEA-136: load presence
            if (FEATURES.CHAT_PRESENCE) {
                try {
                    const presRes = await chatApi.getPresence()
                    const map: Record<string, PresenceEntry> = {}
                    for (const p of presRes.data || []) map[p.user_id] = p
                    setPresenceMap(map)
                } catch {}
            }

            // IDEA-140: unread counts
            if (FEATURES.CHAT_UNREAD_COUNT) {
                try {
                    const unreadRes = await chatApi.getAllUnreadCounts()
                    const map: Record<string, number> = {}
                    for (const s of unreadRes.data || []) map[s.channel_id] = s.unread_count
                    setUnreadMap(map)
                } catch {}
            }
        } catch (err) {
            console.debug("Failed to load chat data", err)
        } finally {
            setIsLoading(false)
        }
    }, [user?.id])

    useEffect(() => { loadData() }, [loadData])

    // Poll presence every 30s
    useEffect(() => {
        if (!FEATURES.CHAT_PRESENCE) return
        const interval = setInterval(async () => {
            try {
                const res = await chatApi.getPresence()
                const map: Record<string, PresenceEntry> = {}
                for (const p of res.data || []) map[p.user_id] = p
                setPresenceMap(map)
            } catch {}
        }, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) { toast.error("Channel name is required"); return }
        setIsCreating(true)
        try {
            const res = await chatApi.createChannel({ name: newChannelName.trim(), topic: newChannelTopic.trim() || undefined, is_private: newChannelPrivate })
            const ch = res.data
            setChannels([ch, ...channels])
            onSelectChannel(ch.id, ch.name, false, ch.is_private)
            setCreateDialogOpen(false)
            setNewChannelName("")
            setNewChannelTopic("")
            setNewChannelPrivate(false)
            toast.success("Channel created")
        } catch { toast.error("Impossible de créer channel") }
        finally { setIsCreating(false) }
    }

    const handleCreateDm = async (userId: string) => {
        const existing = directMessages.find(dm => dm.recipientId === userId)
        if (existing) {
            unhideDm(existing.id)
            onSelectChannel(existing.id, existing.name, true)
            setDmDialogOpen(false)
            return
        }
        setIsCreatingDm(true)
        try {
            const res = await chatApi.createDirectMessage({ participant_ids: [userId] })
            const dm = res.data
            const others = dm.participants.filter(p => p.user_id !== user?.id)
            let dmName = "Direct Message"
            let recipientId: string | undefined
            if (others.length > 0) {
                const names = others.map(op => {
                    const u = usersMap[op.user_id]
                    if (u && (u.display_name || u.username || u.email)) return u.display_name || u.username || u.email
                    if (op.username?.trim()) return op.username
                    return "Utilisateur"
                })
                dmName = names.join(", ")
                recipientId = others[0].user_id
            }
            const newDm: DmDisplay = { id: dm.id, name: dmName, recipientId, status: 'offline', unread: 0 }
            if (!directMessages.find(d => d.id === dm.id)) setDirectMessages([newDm, ...directMessages])
            onSelectChannel(newDm.id, newDm.name, true)
            setDmDialogOpen(false)
        } catch { toast.error("Failed to start conversation") }
        finally { setIsCreatingDm(false) }
    }

    const handleDeleteDm = (e: React.MouseEvent, dmId: string) => {
        e.stopPropagation()
        hideDm(dmId)
        if (selectedChannel === dmId) onSelectChannel("accueil", "Accueil", false)
        toast.success("Conversation supprimée")
    }

    const filteredChannels = channels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    const filteredDMs = directMessages.filter(dm => !hiddenDms.includes(dm.id) && dm.name.toLowerCase().includes(searchQuery.toLowerCase()))

    const getPresenceStatus = (recipientId?: string): 'online' | 'away' | 'busy' | 'offline' => {
        if (!recipientId || !FEATURES.CHAT_PRESENCE) return 'offline'
        return (presenceMap[recipientId]?.status as any) || 'offline'
    }

    return (
        <div className="flex flex-col h-full bg-muted/30 dark:bg-background text-foreground">
            {/* Header */}
            <div className="p-4 py-3 flex items-center justify-between">
                <Button
                    variant="ghost"
                    className="px-2 -ml-2 font-semibold text-lg hover:bg-transparent flex items-center gap-1.5 focus-visible:ring-0"
                    onClick={() => setCreateDialogOpen(true)}
                >
                    Nouveau chat
                </Button>
                <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                    onClick={() => setCreateDialogOpen(true)}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 px-3 mt-2">
                <div className="space-y-4 pb-4">
                    {/* Quick nav */}
                    <div className="space-y-0.5">
                        <Button
                            variant="ghost"
                            className={cn("w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full transition-colors",
                                selectedChannel === "accueil" ? "bg-primary/15 text-primary font-semibold dark:bg-primary/20" : "text-muted-foreground hover:bg-muted"
                            )}
                            onClick={() => onSelectChannel("accueil", "Accueil", false)}
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span className="truncate flex-1 text-left">Accueil</span>
                        </Button>
                        <Button variant="ghost" className="w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full text-muted-foreground hover:bg-muted">
                            <span className="font-bold text-lg leading-none mt-[-4px]">@</span>
                            <span className="truncate flex-1 text-left">Mentions</span>
                        </Button>
                        <Button variant="ghost" className="w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full text-muted-foreground hover:bg-muted">
                            <span className="font-bold text-lg leading-none mt-[-4px]">☆</span>
                            <span className="truncate flex-1 text-left">Suivis</span>
                        </Button>
                    </div>

                    {/* Direct Messages */}
                    <div>
                        <div className="flex items-center justify-between px-3 h-8 group hover:bg-muted rounded-full cursor-pointer transition-colors mb-1">
                            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                <ChevronDown className="h-3 w-3" />
                                Messages privés
                            </h3>
                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted rounded overflow-hidden"
                                onClick={(e) => { e.stopPropagation(); setDmDialogOpen(true) }}>
                                <Plus className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                        <div className="space-y-0.5">
                            {filteredDMs.length === 0 && !isLoading && (
                                <p className="px-3 text-xs text-muted-foreground py-2">Aucune conversation privée</p>
                            )}
                            {filteredDMs.map((dm) => {
                                const targetUser = dm.recipientId ? usersMap[dm.recipientId] : undefined
                                let dynamicName = dm.name
                                if (targetUser) {
                                    const dn = targetUser.display_name?.trim()
                                    const un = targetUser.username?.trim()
                                    if (dn) dynamicName = dn
                                    else if (un) dynamicName = un
                                    else if (targetUser.email) dynamicName = targetUser.email.split('@')[0]
                                }
                                const avatarUrl = targetUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dynamicName}`
                                const status = getPresenceStatus(dm.recipientId)
                                const dmUnread = unreadMap[dm.id] || 0

                                return (
                                    <Button
                                        key={dm.id}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start gap-3 h-8 px-3 text-sm rounded-full transition-colors group relative pr-8",
                                            selectedChannel === dm.id ? "bg-primary/15 text-primary font-semibold dark:bg-primary/20" : "text-muted-foreground hover:bg-muted"
                                        )}
                                        onClick={() => onSelectChannel(dm.id, dynamicName, true)}
                                    >
                                        {/* IDEA-136: presence dot */}
                                        <div className="relative shrink-0">
                                            <div className="h-6 w-6 rounded-full overflow-hidden">
                                                <Avatar className="h-full w-full">
                                                    <AvatarImage src={avatarUrl} />
                                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{dynamicName.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                            {FEATURES.CHAT_PRESENCE && (
                                                <span className={cn("absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background", STATUS_COLORS[status])} />
                                            )}
                                        </div>
                                        {/* IDEA-140: unread bold name */}
                                        <span className={cn("truncate flex-1 text-left", dmUnread > 0 && selectedChannel !== dm.id ? "font-bold text-foreground" : "")}>
                                            {dynamicName}
                                        </span>
                                        {/* IDEA-140: unread badge */}
                                        {FEATURES.CHAT_UNREAD_COUNT && dmUnread > 0 && selectedChannel !== dm.id && (
                                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
                                                {dmUnread}
                                            </span>
                                        )}
                                        <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded-full"
                                            onClick={(e) => handleDeleteDm(e, dm.id)}>
                                            <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                        </div>
                                    </Button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Channels (Espaces) */}
                    <div>
                        <div className="flex items-center justify-between px-3 h-8 group hover:bg-muted rounded-full cursor-pointer transition-colors mb-1">
                            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                                <ChevronDown className="h-3 w-3" />
                                Espaces
                            </h3>
                            <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {isLoading ? (
                            <div className="px-3 flex items-center gap-2 text-muted-foreground text-sm pt-2">
                                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3 w-3" /> Chargement...
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filteredChannels.map((channel) => {
                                    const chUnread = unreadMap[channel.id] || 0
                                    return (
                                        <Button
                                            key={channel.id}
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start gap-3 h-8 px-3 text-sm font-medium rounded-full transition-colors",
                                                selectedChannel === channel.id ? "bg-primary/15 text-primary font-semibold dark:bg-primary/20" : "text-muted-foreground hover:bg-muted"
                                            )}
                                            onClick={() => onSelectChannel(channel.id, channel.name, false, channel.is_private)}
                                        >
                                            {/* IDEA-141: private/public icon */}
                                            <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-muted-foreground shrink-0">
                                                {FEATURES.CHAT_PRIVATE_CHANNELS && channel.is_private
                                                    ? <Lock className="h-3.5 w-3.5" />
                                                    : <Hash className="h-3.5 w-3.5" />
                                                }
                                            </div>
                                            <span className={cn("truncate flex-1 text-left", chUnread > 0 && selectedChannel !== channel.id ? "font-bold text-foreground" : "")}>
                                                {channel.name}
                                            </span>
                                            {/* IDEA-140: unread badge on channels */}
                                            {FEATURES.CHAT_UNREAD_COUNT && chUnread > 0 && selectedChannel !== channel.id && (
                                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5">
                                                    {chUnread}
                                                </span>
                                            )}
                                            {/* IDEA-141: private badge */}
                                            {FEATURES.CHAT_PRIVATE_CHANNELS && channel.is_private && (
                                                <Globe className="h-3 w-3 text-muted-foreground/50 shrink-0" style={{ display: 'none' }} />
                                            )}
                                        </Button>
                                    )
                                })}
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
                            <Input id="channel-name" placeholder="ex: projet-alpha" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="channel-topic">Description (optionnel)</Label>
                            <Input id="channel-topic" placeholder="De quoi parle cet espace ?" value={newChannelTopic} onChange={(e) => setNewChannelTopic(e.target.value)} />
                        </div>
                        {/* IDEA-141: private channel toggle */}
                        {FEATURES.CHAT_PRIVATE_CHANNELS && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="channel-private">Espace privé</Label>
                                    <p className="text-xs text-muted-foreground">Seuls les membres invités peuvent voir cet espace</p>
                                </div>
                                <Switch id="channel-private" checked={newChannelPrivate} onCheckedChange={setNewChannelPrivate} />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
                        <Button onClick={handleCreateChannel} disabled={isCreating || !newChannelName.trim()}>
                            {isCreating && <SpinnerInfinity size={20} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4" />}
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
                            .map((u) => {
                                const uStatus = getPresenceStatus(u.id)
                                return (
                                    <div
                                        key={u.id}
                                        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer border border-transparent hover:border-border transition-all"
                                        onClick={() => handleCreateDm(u.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} />
                                                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{u.username.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                {FEATURES.CHAT_PRESENCE && (
                                                    <span className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background", STATUS_COLORS[uStatus])} />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{u.display_name || u.username || u.email || "Utilisateur"}</span>
                                                {(u.display_name || u.username) && (
                                                    <span className="text-xs text-muted-foreground">@{u.username || u.email}</span>
                                                )}
                                            </div>
                                        </div>
                                        {isCreatingDm && <SpinnerInfinity size={18} />}
                                    </div>
                                )
                            })
                        }
                        {Object.keys(usersMap).length <= 1 && (
                            <div className="text-sm text-center text-muted-foreground py-4">Aucun autre utilisateur trouvé.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
