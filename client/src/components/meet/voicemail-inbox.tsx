'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, Play, Pause, Download, Trash2, Loader2, Clock, User } from 'lucide-react'
import { getClient, ServiceName } from '@/lib/api/factory'

const meetClient = getClient(ServiceName.MEET)

interface VoiceMessage {
  id: string
  caller: string
  callerPhone?: string
  date: string
  duration: number // seconds
  transcription: string
  isNew: boolean
  audioUrl?: string
}

export function VoicemailInbox() {
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await meetClient.get<any[]>('/meet/voicemails')
        const loaded: VoiceMessage[] = (res.data ?? []).map((m: any) => ({
          id: m.id ?? crypto.randomUUID(),
          caller: m.caller_name ?? m.caller ?? 'Unknown',
          callerPhone: m.caller_phone ?? m.phone ?? undefined,
          date: m.received_at ?? m.created_at ?? new Date().toISOString(),
          duration: m.duration_seconds ?? m.duration ?? 0,
          transcription: m.transcription ?? '',
          isNew: m.is_new ?? m.unread ?? false,
          audioUrl: m.audio_url ?? undefined,
        }))
        setMessages(loaded)
        localStorage.setItem('signapps_voicemails', JSON.stringify(loaded))
      } catch {
        try {
          const raw = localStorage.getItem('signapps_voicemails')
          setMessages(raw ? JSON.parse(raw) : [])
        } catch {
          setMessages([])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const markRead = async (id: string) => {
    meetClient.patch(`/meet/voicemails/${id}`, { is_new: false }).catch(() => {})
  }

  const handleDelete = (id: string) => {
    const updated = messages.filter((m) => m.id !== id)
    setMessages(updated)
    localStorage.setItem('signapps_voicemails', JSON.stringify(updated))
    meetClient.delete(`/meet/voicemails/${id}`).catch(() => {})
  }

  const toggleTranscription = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
    const msg = messages.find((m) => m.id === id)
    if (msg?.isNew) {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isNew: false } : m))
      markRead(id)
    }
  }

  const togglePlayback = (id: string) => {
    setPlayingId(playingId === id ? null : id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Phone className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Voicemails</h3>
          <p className="text-muted-foreground text-center mt-2">Your voicemail inbox is empty</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Voicemail Inbox</CardTitle>
          <CardDescription>Manage your voice messages and transcriptions</CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {messages.map((message) => (
          <Card key={message.id} className={message.isNew ? 'border-blue-200 bg-blue-50/30' : ''}>
            <CardContent className="pt-6">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-semibold">{message.caller}</h4>
                    {message.isNew && <Badge className="bg-blue-600">New</Badge>}
                  </div>
                  {message.callerPhone && (
                    <p className="text-sm text-muted-foreground ml-6">{message.callerPhone}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium">{message.date}</p>
                  <div className="flex items-center gap-1 mt-1 justify-end text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(message.duration)}</span>
                  </div>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePlayback(message.id)}
                  className="flex-1"
                  disabled={!message.audioUrl || message.audioUrl === '#'}
                >
                  {playingId === message.id ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!message.audioUrl || message.audioUrl === '#'}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(message.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Transcription Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleTranscription(message.id)}
                className="w-full"
              >
                {expandedId === message.id ? 'Hide Transcription' : 'Show Transcription'}
              </Button>

              {/* Transcription */}
              {expandedId === message.id && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-foreground leading-relaxed">{message.transcription}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
