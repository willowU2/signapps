"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
    Bot,
    Loader2,
    RefreshCw,
    Send,
    Square,
    Sparkles,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiStream } from "@/hooks/use-ai-stream"
import { mailApi } from "@/lib/api-mail"
import { toast } from "sonner"
import { useAiRouting } from "@/hooks/use-ai-routing"

interface ComposeAiDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ComposeAiDialog({ open, onOpenChange }: ComposeAiDialogProps) {
    const [recipient, setRecipient] = useState("")
    const [description, setDescription] = useState("")
    const [subject, setSubject] = useState("")
    const [body, setBody] = useState("")
    const [generated, setGenerated] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [draftId, setDraftId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const initialLoad = useRef(true)

    const { stream, stop, isStreaming } = useAiStream()
    const { getRouteConfig } = useAiRouting()

    // Auto-save draft
    useEffect(() => {
        if (!open) return
        if (!recipient && !subject && !body && !description) return

        if (initialLoad.current) {
            initialLoad.current = false
            return
        }

        const timer = setTimeout(async () => {
            setIsSaving(true)
            try {
                if (draftId) {
                    await mailApi.update(draftId, {
                        recipient: recipient.trim() || undefined,
                        subject: subject.trim() || (description ? description.slice(0, 30) : undefined),
                        body: body.trim() || undefined,
                        folder: "drafts",
                    })
                } else {
                    const res = await mailApi.send({
                        sender: "me@signapps.local", // Using stub ID for MVP
                        recipient: recipient.trim() || "",
                        subject: subject.trim() || (description ? description.slice(0, 30) : ""),
                        body: body.trim() || "",
                        folder: "drafts",
                    })
                    setDraftId(res.id)
                }
            } catch (err) {
                console.error("Failed to auto-save draft", err)
            } finally {
                setIsSaving(false)
            }
        }, 1500)

        return () => clearTimeout(timer)
    }, [recipient, subject, body, description, open, draftId])

    const handleGenerate = useCallback(async () => {
        if (!description.trim() || isStreaming) return
        setGenerated(false)
        setGenerating(true)
        setSubject("")
        setBody("")

        let fullText = ""
        let subjectParsed = false

        await stream(
            `Write a professional email based on this description:\n\nRecipient: ${recipient || "colleague"}\nDescription: ${description}`,
            {
                onToken: (token) => {
                    fullText += token

                    // Parse SUBJECT from first line
                    if (!subjectParsed) {
                        const lines = fullText.split("\n")
                        const firstLine = lines[0]
                        if (firstLine.startsWith("SUBJECT:") && lines.length > 1) {
                            setSubject(firstLine.replace("SUBJECT:", "").trim())
                            setBody(lines.slice(1).join("\n").trimStart())
                            subjectParsed = true
                        } else if (lines.length > 1 && !firstLine.startsWith("SUBJECT")) {
                            // No SUBJECT prefix, use first line as subject
                            setSubject(firstLine.trim())
                            setBody(lines.slice(1).join("\n").trimStart())
                            subjectParsed = true
                        } else {
                            // Still on first line, show in body for now
                            setBody(fullText)
                        }
                    } else {
                        // After subject parsed, append to body
                        const lines = fullText.split("\n")
                        setBody(lines.slice(1).join("\n").trimStart())
                    }
                },
                onDone: () => {
                    setGenerating(false)
                    setGenerated(true)

                    // Final parse if subject wasn't parsed
                    if (!subjectParsed) {
                        const lines = fullText.split("\n")
                        if (lines[0]?.startsWith("SUBJECT:")) {
                            setSubject(lines[0].replace("SUBJECT:", "").trim())
                            setBody(lines.slice(1).join("\n").trimStart())
                        } else {
                            setSubject(description.slice(0, 60))
                            setBody(fullText)
                        }
                    }
                },
                onError: (err) => {
                    setGenerating(false)
                    toast.error(`Generation failed: ${err}`)
                },
            },
            {
                systemPrompt:
                    "You are a professional email writer. Write a clear, well-structured email. " +
                    "Output format: First line MUST be 'SUBJECT: <email subject>', then a blank line, then the email body. " +
                    "Do not include any other meta-text or explanations. Use an appropriate greeting and sign-off.",
                language: "en",
                provider: getRouteConfig('mail').providerId || undefined,
                model: getRouteConfig('mail').modelId || undefined,
            },
        )
    }, [description, recipient, isStreaming, stream, getRouteConfig])

    const handleSend = async () => {
        if (!recipient.trim() || !subject.trim() || !body.trim()) {
            toast.error("Please fill in all fields")
            return
        }

        try {
            if (draftId) {
                await mailApi.update(draftId, {
                    recipient: recipient.trim(),
                    subject: subject.trim(),
                    body: body.trim(),
                    folder: "sent",
                })
            } else {
                await mailApi.send({
                    sender: "me@signapps.local",
                    recipient: recipient.trim(),
                    subject: subject.trim(),
                    body: body.trim(),
                    folder: "sent",
                })
            }
            toast.success("Email sent!")
            handleReset()
            onOpenChange(false)
        } catch {
            toast.error("Failed to send email")
        }
    }

    const handleReset = () => {
        setRecipient("")
        setDescription("")
        setSubject("")
        setBody("")
        setGenerated(false)
        setGenerating(false)
        setDraftId(null)
        initialLoad.current = true
        if (isStreaming) stop()
    }

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!v) handleReset()
            onOpenChange(v)
        }}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-purple-600" />
                        Compose with AI
                        {isSaving && (
                            <span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full animate-pulse">
                                Saving draft...
                            </span>
                        )}
                        {!isSaving && draftId && (
                            <span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                                Draft saved
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* Recipient */}
                    <div className="grid gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">To</label>
                        <Input
                            placeholder="recipient@example.com"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            disabled={isStreaming}
                        />
                    </div>

                    {/* Description */}
                    <div className="grid gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                            Describe the email you want to write
                        </label>
                        <Textarea
                            placeholder="e.g., Follow up on last week's meeting about the Q3 budget proposal..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isStreaming}
                            rows={3}
                        />
                    </div>

                    {/* Generate button */}
                    {!generated && !generating && (
                        <Button
                            onClick={handleGenerate}
                            disabled={!description.trim() || isStreaming}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Email
                        </Button>
                    )}

                    {/* Generated content */}
                    {(generating || generated) && (
                        <>
                            <div className="grid gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                                {generating && !subject ? (
                                    <Skeleton className="h-9 w-full" />
                                ) : (
                                    <Input
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="Email subject..."
                                    />
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                    Body
                                    {isStreaming && (
                                        <span className="text-[10px] text-purple-500 animate-pulse">generating...</span>
                                    )}
                                </label>
                                <Textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={8}
                                    className="font-mono text-sm"
                                />
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {isStreaming && (
                        <Button variant="outline" onClick={stop} className="text-red-500">
                            <Square className="h-3.5 w-3.5 mr-2" />
                            Stop
                        </Button>
                    )}
                    {generated && !isStreaming && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleGenerate}
                                disabled={isStreaming}
                            >
                                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                                Regenerate
                            </Button>
                            <Button
                                onClick={handleSend}
                                disabled={!recipient.trim() || !subject.trim() || !body.trim()}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Send className="h-3.5 w-3.5 mr-2" />
                                Send
                            </Button>
                        </>
                    )}
                    {generating && !isStreaming && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing...
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
