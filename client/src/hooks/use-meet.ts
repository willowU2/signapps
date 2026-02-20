"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export interface Peer {
    id: string
    stream: MediaStream
}

interface SignalingMessage {
    type: 'join' | 'offer' | 'answer' | 'candidate' | 'leave'
    senderId: string
    targetId?: string
    payload?: any
}

// ICE Servers (Stun/Turn)
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
}

export function useMeet(roomId: string, userId: string, userName: string) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [peers, setPeers] = useState<Peer[]>([])
    const [isConnected, setIsConnected] = useState(false)

    const wsRef = useRef<WebSocket | null>(null)
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
    const localStreamRef = useRef<MediaStream | null>(null)

    // Initialize local stream
    useEffect(() => {
        async function initStream() {
            try {
                // Request video/audio
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                })
                setLocalStream(stream)
                localStreamRef.current = stream
            } catch (err) {
                console.error("Failed to get local stream", err)
            }
        }
        initStream()

        return () => {
            // Cleanup stream
            localStreamRef.current?.getTracks().forEach(track => track.stop())
        }
    }, [])

    // Initialize WebSocket and Signaling
    useEffect(() => {
        if (!roomId || !userId || !localStream) return

        const wsUrl = `ws://localhost:3010/api/v1/collab/ws/${roomId}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('Connected to signaling server')
            setIsConnected(true)
            // Send join message
            sendSignal({ type: 'join', senderId: userId })
        }

        ws.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg: SignalingMessage = JSON.parse(event.data)
                    if (msg.senderId === userId) return // Ignore own messages

                    handleSignal(msg)
                } catch (e) {
                    console.error("Failed to parse signaling message", e)
                }
            }
        }

        return () => {
            ws.close()
            // Cleanup peers
            peersRef.current.forEach(pc => pc.close())
            peersRef.current.clear()
        }
    }, [roomId, userId, localStream]) // Re-run if stream changes? No, stream is stable usually.

    const sendSignal = (msg: SignalingMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg))
        }
    }

    const createPeerConnection = (peerId: string) => {
        if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)!

        const pc = new RTCPeerConnection(ICE_SERVERS)
        peersRef.current.set(peerId, pc)

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'candidate',
                    senderId: userId,
                    targetId: peerId,
                    payload: event.candidate
                })
            }
        }

        pc.ontrack = (event) => {
            console.log("Received track from", peerId)
            const stream = event.streams[0]
            if (stream) {
                setPeers(prev => {
                    if (prev.find(p => p.id === peerId)) return prev
                    return [...prev, { id: peerId, stream }]
                })
            }
        }

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!)
            })
        }

        return pc
    }

    const handleSignal = async (msg: SignalingMessage) => {
        const { type, senderId, payload } = msg

        switch (type) {
            case 'join': {
                // New peer joined, create offer
                console.log("Peer joined:", senderId)
                const pc = createPeerConnection(senderId)
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                sendSignal({
                    type: 'offer',
                    senderId: userId,
                    targetId: senderId,
                    payload: offer
                })
                break
            }
            case 'offer': {
                if (msg.targetId !== userId) return
                console.log("Received offer from:", senderId)
                const pc = createPeerConnection(senderId)
                await pc.setRemoteDescription(new RTCSessionDescription(payload))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                sendSignal({
                    type: 'answer',
                    senderId: userId,
                    targetId: senderId,
                    payload: answer
                })
                break
            }
            case 'answer': {
                if (msg.targetId !== userId) return
                console.log("Received answer from:", senderId)
                const pc = peersRef.current.get(senderId)
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload))
                }
                break
            }
            case 'candidate': {
                if (msg.targetId !== userId) return
                const pc = peersRef.current.get(senderId)
                if (pc) {
                    await pc.addIceCandidate(new RTCIceCandidate(payload))
                }
                break
            }
        }
    }

    return {
        localStream,
        peers,
        isConnected
    }
}
