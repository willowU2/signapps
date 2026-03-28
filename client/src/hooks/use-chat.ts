"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { chatApi, ChatAttachment as Attachment } from '@/lib/api/chat'

export interface Message {
    id: string
    senderId: string
    senderName: string
    content: string
    timestamp: string
    parentId?: string
    reactions?: Record<string, number>
    attachment?: Attachment
    isPinned?: boolean
}

function mapApiMessage(m: {
    id: string
    user_id: string
    username: string
    content: string
    created_at: string
    parent_id?: string
    reactions?: Record<string, number>
    attachment?: Attachment
    is_pinned?: boolean
}): Message {
    return {
        id: m.id,
        senderId: m.user_id,
        senderName: m.username,
        content: m.content,
        timestamp: m.created_at,
        parentId: m.parent_id,
        reactions: m.reactions,
        attachment: m.attachment,
        isPinned: m.is_pinned,
    }
}

interface WsEvent {
    type: 'new_message' | 'reaction_added' | 'message_deleted' | 'message_pinned' | 'presence_updated'
    channel_id?: string
    message?: {
        id: string
        user_id: string
        username: string
        content: string
        created_at: string
        parent_id?: string
        reactions?: Record<string, number>
        attachment?: Attachment
        is_pinned?: boolean
    }
    message_id?: string
    emoji?: string
    count?: number
    payload?: {
        message_id?: string
        channel_id?: string
        user_id?: string
        status?: string
    }
}

export function useChat(channelId: string, userId: string, userName: string) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Load existing messages via REST on channel change
    useEffect(() => {
        if (!channelId || channelId === 'accueil') return
        setMessages([])

        let cancelled = false

        const loadMessages = async () => {
            try {
                const res = await chatApi.getMessages(channelId)
                if (!cancelled) {
                    setMessages((res.data || []).map(mapApiMessage))
                }
            } catch (e) {
                console.debug('Failed to load messages for channel', channelId, e)
            }
        }

        loadMessages()

        // Mark channel read on entry
        chatApi.markChannelRead(channelId).catch(() => {})

        return () => { cancelled = true }
    }, [channelId])

    // WebSocket connection for real-time events
    useEffect(() => {
        if (!channelId || channelId === 'accueil') return

        const connect = () => {
            const wsUrl = chatApi.getWebSocketUrl()
            const ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onopen = () => {
                setIsConnected(true)
                ws.send(JSON.stringify({ type: 'subscribe', channel_id: channelId }))
            }

            ws.onmessage = (event) => {
                try {
                    const evt: WsEvent = JSON.parse(event.data)

                    if (evt.type === 'new_message' && evt.message) {
                        const msg = mapApiMessage(evt.message)
                        setMessages(prev => {
                            if (prev.find(m => m.id === msg.id)) return prev
                            return [...prev, msg]
                        })
                        // Increment unread if the message is from someone else
                        if (evt.message.user_id !== userId) {
                            setUnreadCount(c => c + 1)
                        }
                    } else if (evt.type === 'reaction_added' && evt.message_id && evt.emoji) {
                        setMessages(prev => prev.map(m => {
                            if (m.id !== evt.message_id) return m
                            const reactions = { ...(m.reactions || {}) }
                            reactions[evt.emoji!] = evt.count ?? (reactions[evt.emoji!] || 0) + 1
                            return { ...m, reactions }
                        }))
                    } else if (evt.type === 'message_deleted' && evt.message_id) {
                        setMessages(prev => prev.filter(m => m.id !== evt.message_id))
                    } else if (evt.type === 'message_pinned' && evt.payload?.message_id) {
                        setMessages(prev => prev.map(m =>
                            m.id === evt.payload?.message_id ? { ...m, isPinned: true } : m
                        ))
                    }
                } catch (e) {
                    console.debug('Failed to parse WS event', e)
                }
            }

            ws.onclose = () => {
                setIsConnected(false)
                reconnectTimeoutRef.current = setTimeout(connect, 3000)
            }

            ws.onerror = () => {
                ws.close()
            }
        }

        connect()

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
            wsRef.current?.close()
            wsRef.current = null
            setIsConnected(false)
        }
    }, [channelId, userId])

    const sendMessage = useCallback(async (content: string, parentId?: string, attachment?: Attachment) => {
        if (!channelId || channelId === 'accueil') return

        const optimisticId = `opt-${Date.now()}-${Math.random()}`
        const optimistic: Message = {
            id: optimisticId,
            senderId: userId,
            senderName: userName,
            content,
            timestamp: new Date().toISOString(),
            parentId,
            attachment,
        }
        setMessages(prev => [...prev, optimistic])

        try {
            const res = await chatApi.sendMessage(channelId, { content, parent_id: parentId })
            const confirmed = mapApiMessage(res.data)
            // Preserve attachment in confirmed message if backend doesn't return it
            if (attachment && !confirmed.attachment) confirmed.attachment = attachment
            setMessages(prev => prev.map(m => m.id === optimisticId ? confirmed : m))
        } catch (e) {
            console.error('Failed to send message', e)
            setMessages(prev => prev.filter(m => m.id !== optimisticId))
        }
    }, [channelId, userId, userName])

    const addReaction = useCallback(async (msgId: string, emoji: string) => {
        setMessages(prev => prev.map(m => {
            if (m.id !== msgId) return m
            const reactions = { ...(m.reactions || {}) }
            reactions[emoji] = (reactions[emoji] || 0) + 1
            return { ...m, reactions }
        }))

        try {
            await chatApi.addReaction(msgId, { emoji })
        } catch (e) {
            console.debug('Failed to add reaction', e)
            setMessages(prev => prev.map(m => {
                if (m.id !== msgId) return m
                const reactions = { ...(m.reactions || {}) }
                if (reactions[emoji] !== undefined) {
                    reactions[emoji] = Math.max(0, reactions[emoji] - 1)
                    if (reactions[emoji] === 0) delete reactions[emoji]
                }
                return { ...m, reactions }
            }))
        }
    }, [])

    const pinMessage = useCallback(async (msgId: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: true } : m))
        try {
            await chatApi.pinMessage(channelId, msgId)
        } catch {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: false } : m))
        }
    }, [channelId])

    const unpinMessage = useCallback(async (msgId: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: false } : m))
        try {
            await chatApi.unpinMessage(channelId, msgId)
        } catch {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: true } : m))
        }
    }, [channelId])

    const markRead = useCallback(() => {
        setUnreadCount(0)
        chatApi.markChannelRead(channelId).catch(() => {})
    }, [channelId])

    return {
        messages,
        sendMessage,
        addReaction,
        pinMessage,
        unpinMessage,
        markRead,
        isConnected,
        unreadCount,
    }
}
