"use client"

import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'

export interface Message {
    id: string
    senderId: string
    senderName: string
    content: string
    timestamp: string // Yjs serializes dates as strings usually
    parentId?: string
    reactions?: Record<string, number>
}

export function useChat(channelId: string, userId: string, userName: string) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const docRef = useRef<Y.Doc | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const messagesArrayRef = useRef<Y.Array<Message> | null>(null)

    useEffect(() => {
        if (!channelId) return

        // Initialize Yjs Doc
        const doc = new Y.Doc()
        docRef.current = doc

        const messagesArray = doc.getArray<Message>('messages')
        messagesArrayRef.current = messagesArray

        // Bind to Yjs updates
        messagesArray.observe(() => {
            setMessages(messagesArray.toArray())
        })

        // Connect WebSocket
        // Use env var for WS URL
        const baseUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'http://localhost:3010/api/v1';
        const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
        const wsUrl = `${wsBaseUrl}/docs/chat/${channelId}/ws`;
        const ws = new WebSocket(wsUrl)
        ws.binaryType = 'arraybuffer'
        wsRef.current = ws

        ws.onopen = () => {
            console.log('Connected to chat channel:', channelId)
            setIsConnected(true)
        }

        ws.onmessage = (event) => {
            try {
                const update = new Uint8Array(event.data)
                Y.applyUpdate(doc, update)
            } catch (e) {
                console.error('Failed to apply update', e)
            }
        }

        ws.onclose = () => {
            console.log('Disconnected from chat channel')
            setIsConnected(false)
        }

        // Sync local updates to server
        doc.on('update', (update) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(update)
            }
        })

        return () => {
            ws.close()
            doc.destroy()
        }
    }, [channelId])

    const sendMessage = (content: string, parentId?: string) => {
        if (!messagesArrayRef.current) return

        const newMessage: Message = {
            id: crypto.randomUUID(),
            senderId: userId,
            senderName: userName,
            content,
            timestamp: new Date().toISOString(),
            parentId
        }

        // Append to Yjs array
        docRef.current?.transact(() => {
            messagesArrayRef.current?.push([newMessage])
        })
    }

    const addReaction = (msgId: string, emoji: string) => {
        if (!messagesArrayRef.current) return;

        docRef.current?.transact(() => {
            const arr = messagesArrayRef.current!;
            const idx = arr.toArray().findIndex(m => m.id === msgId);
            if (idx !== -1) {
                const msg = arr.get(idx);
                const reactions = { ...(msg.reactions || {}) };
                reactions[emoji] = (reactions[emoji] || 0) + 1;

                // Replace the item to trigger sync
                arr.delete(idx, 1);
                arr.insert(idx, [{ ...msg, reactions }]);
            }
        });
    }

    return {
        messages,
        sendMessage,
        addReaction,
        isConnected
    }
}
