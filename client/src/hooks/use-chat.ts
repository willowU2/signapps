"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { chatApi } from '@/lib/api/chat'

export interface Message {
    id: string
    senderId: string
    senderName: string
    content: string
    timestamp: string
    parentId?: string
    reactions?: Record<string, number>
}

// Map backend ChatMessage shape to local Message shape
function mapApiMessage(m: {
    id: string
    user_id: string
    username: string
    content: string
    created_at: string
    parent_id?: string
    reactions?: Record<string, number>
}): Message {
    return {
        id: m.id,
        senderId: m.user_id,
        senderName: m.username,
        content: m.content,
        timestamp: m.created_at,
        parentId: m.parent_id,
        reactions: m.reactions,
    }
}

// Shape of real-time WebSocket event from signapps-chat
interface WsEvent {
    type: 'new_message' | 'reaction_added' | 'message_deleted'
    channel_id?: string
    message?: {
        id: string
        user_id: string
        username: string
        content: string
        created_at: string
        parent_id?: string
        reactions?: Record<string, number>
    }
    message_id?: string
    emoji?: string
    count?: number
}

export function useChat(channelId: string, userId: string, userName: string) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isConnected, setIsConnected] = useState(false)
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
                    const loaded = (res.data || []).map(mapApiMessage)
                    setMessages(loaded)
                }
            } catch (e) {
                console.debug('Failed to load messages for channel', channelId, e)
            }
        }

        loadMessages()
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
                console.debug('Connected to chat WebSocket')
                setIsConnected(true)
                // Subscribe to the channel
                ws.send(JSON.stringify({ type: 'subscribe', channel_id: channelId }))
            }

            ws.onmessage = (event) => {
                try {
                    const evt: WsEvent = JSON.parse(event.data)

                    if (evt.type === 'new_message' && evt.message) {
                        const msg = mapApiMessage(evt.message)
                        setMessages(prev => {
                            // Avoid duplicates (optimistic update already added it)
                            if (prev.find(m => m.id === msg.id)) return prev
                            return [...prev, msg]
                        })
                    } else if (evt.type === 'reaction_added' && evt.message_id && evt.emoji) {
                        setMessages(prev => prev.map(m => {
                            if (m.id !== evt.message_id) return m
                            const reactions = { ...(m.reactions || {}) }
                            reactions[evt.emoji!] = evt.count ?? (reactions[evt.emoji!] || 0) + 1
                            return { ...m, reactions }
                        }))
                    } else if (evt.type === 'message_deleted' && evt.message_id) {
                        setMessages(prev => prev.filter(m => m.id !== evt.message_id))
                    }
                } catch (e) {
                    console.debug('Failed to parse WS event', e)
                }
            }

            ws.onclose = () => {
                console.debug('Chat WebSocket closed, reconnecting in 3s...')
                setIsConnected(false)
                // Auto-reconnect
                reconnectTimeoutRef.current = setTimeout(connect, 3000)
            }

            ws.onerror = () => {
                console.debug('Chat WebSocket error')
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
    }, [channelId])

    const sendMessage = useCallback(async (content: string, parentId?: string) => {
        if (!channelId || channelId === 'accueil') return

        // Optimistic insert
        const optimisticId = `opt-${Date.now()}-${Math.random()}`
        const optimistic: Message = {
            id: optimisticId,
            senderId: userId,
            senderName: userName,
            content,
            timestamp: new Date().toISOString(),
            parentId,
        }
        setMessages(prev => [...prev, optimistic])

        try {
            const res = await chatApi.sendMessage(channelId, {
                content,
                parent_id: parentId,
            })
            const confirmed = mapApiMessage(res.data)
            // Replace optimistic with confirmed
            setMessages(prev => prev.map(m => m.id === optimisticId ? confirmed : m))
        } catch (e) {
            console.error('Failed to send message', e)
            // Remove optimistic on error
            setMessages(prev => prev.filter(m => m.id !== optimisticId))
        }
    }, [channelId, userId, userName])

    const addReaction = useCallback(async (msgId: string, emoji: string) => {
        // Optimistic update
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
            // Rollback optimistic
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

    return {
        messages,
        sendMessage,
        addReaction,
        isConnected,
    }
}
