'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, Play, Pause, Download, Trash2, Loader2, Clock, User } from 'lucide-react'

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
    // Mock data - replace with API call
    const mockMessages: VoiceMessage[] = [
      {
        id: '1',
        caller: 'John Smith',
        callerPhone: '+1 (555) 123-4567',
        date: 'Today, 2:30 PM',
        duration: 145,
        transcription:
          'Hi, this is John calling about the project update. Can you please review the latest documents and get back to me with your thoughts? Thanks.',
        isNew: true,
        audioUrl: '#',
      },
      {
        id: '2',
        caller: 'Sarah Johnson',
        callerPhone: '+1 (555) 987-6543',
        date: 'Today, 11:15 AM',
        duration: 62,
        transcription: 'Hello, just confirming our meeting tomorrow at 3 PM. Looking forward to discussing the Q4 strategy.',
        isNew: true,
        audioUrl: '#',
      },
      {
        id: '3',
        caller: 'Unknown',
        callerPhone: '+1 (555) 555-0000',
        date: 'Yesterday, 5:45 PM',
        duration: 28,
        transcription: 'This is an automated reminder about your appointment.',
        isNew: false,
        audioUrl: '#',
      },
      {
        id: '4',
        caller: 'Michael Chen',
        callerPhone: '+1 (555) 246-8135',
        date: 'Yesterday, 10:30 AM',
        duration: 203,
        transcription:
          'Hi there, wanted to touch base about the new requirements. I have some concerns about the timeline and resource allocation. Call me back when you get a chance.',
        isNew: false,
        audioUrl: '#',
      },
    ]

    setMessages(mockMessages)
    setLoading(false)
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDelete = (id: string) => {
    setMessages(messages.filter((m) => m.id !== id))
  }

  const toggleTranscription = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
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
                <Button variant="outline" size="sm">
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
