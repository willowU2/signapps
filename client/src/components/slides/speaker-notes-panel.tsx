"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronUp, Mic, MicOff, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface SpeakerNotesPanelProps {
    slideId: string | null
    notes: string
    onNotesChange: (notes: string) => void
    isReadOnly?: boolean
}

export function SpeakerNotesPanel({
    slideId,
    notes,
    onNotesChange,
    isReadOnly = false
}: SpeakerNotesPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [localNotes, setLocalNotes] = useState(notes)
    const [isRecording, setIsRecording] = useState(false)

    // Sync local notes when slide changes
    useEffect(() => {
        setLocalNotes(notes)
    }, [notes, slideId])

    // Debounced save
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (localNotes !== notes) {
                onNotesChange(localNotes)
            }
        }, 500)
        return () => clearTimeout(timeout)
    }, [localNotes, notes, onNotesChange])

    const handleVoiceNote = useCallback(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            alert("La reconnaissance vocale n'est pas supportée par ce navigateur.")
            return
        }

        const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognitionCtor()
        recognition.lang = 'fr-FR'
        recognition.continuous = false
        recognition.interimResults = false

        recognition.onstart = () => setIsRecording(true)
        recognition.onend = () => setIsRecording(false)
        recognition.onerror = () => setIsRecording(false)

        recognition.onresult = (event: Parameters<NonNullable<SpeechRecognition["onresult"]>>[0]) => {
            const transcript = event.results[0][0].transcript
            setLocalNotes(prev => prev ? `${prev}\n${transcript}` : transcript)
        }

        if (isRecording) {
            recognition.stop()
        } else {
            recognition.start()
        }
    }, [isRecording])

    if (!slideId) {
        return null
    }

    return (
        <div className={cn(
            "border-t bg-muted/30 transition-all duration-200",
            isExpanded ? "h-48" : "h-10"
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 h-10 cursor-pointer hover:bg-muted/50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>Notes du présentateur</span>
                    {localNotes && !isExpanded && (
                        <span className="text-xs text-muted-foreground/60 ml-2 truncate max-w-[200px]">
                            {localNotes.substring(0, 50)}{localNotes.length > 50 ? '...' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {isExpanded && !isReadOnly && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleVoiceNote()
                            }}
                            className={cn(
                                "h-6 px-2",
                                isRecording && "text-red-500 animate-pulse"
                            )}
                        >
                            {isRecording ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        </Button>
                    )}
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronUp className="w-4 h-4" />
                    )}
                </div>
            </div>

            {/* Notes Editor */}
            {isExpanded && (
                <div className="px-4 pb-3 h-[calc(100%-2.5rem)]">
                    <Textarea
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        placeholder="Ajoutez vos notes de présentation ici. Ces notes ne seront visibles que par vous lors de la présentation..."
                        className="h-full resize-none text-sm bg-background"
                        disabled={isReadOnly}
                    />
                </div>
            )}
        </div>
    )
}
