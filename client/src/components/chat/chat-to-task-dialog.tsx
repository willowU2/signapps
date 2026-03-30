"use client"

import { useState, useEffect } from "react"
import { CheckSquare, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { calendarApi, tasksApi } from "@/lib/api/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ChatTaskMessage {
  content: string
  author: string
  channel: string
}

interface ChatToTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: ChatTaskMessage | null
}

export function ChatToTaskDialog({ open, onOpenChange, message }: ChatToTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState(2)
  const [saving, setSaving] = useState(false)

  // Pre-fill when dialog opens
  useEffect(() => {
    if (open && message) {
      setTitle(message.content.slice(0, 80))
      setDescription(
        `[Message de ${message.author} dans #${message.channel}]\n\n${message.content.slice(0, 500)}${message.content.length > 500 ? "..." : ""}`,
      )
      setDueDate("")
      setPriority(2)
    }
  }, [open, message])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Le titre est requis")
      return
    }

    setSaving(true)

    try {
      const calendarsResponse = await calendarApi.listCalendars()
      const calendars = (calendarsResponse as any).data || calendarsResponse || []

      if (Array.isArray(calendars) && calendars.length > 0) {
        await tasksApi.createTask(calendars[0].id, {
          title: title.trim(),
          description: description.trim(),
          priority,
          due_date: dueDate || undefined,
        })
        toast.success("Tâche créée avec succès")
      } else {
        saveToLocalStorage()
        toast.success("Tâche enregistrée localement")
      }
    } catch {
      saveToLocalStorage()
      toast.success("Tâche enregistrée localement (service indisponible)")
    } finally {
      setSaving(false)
      onOpenChange(false)
    }
  }

  const saveToLocalStorage = () => {
    const tasks = JSON.parse(localStorage.getItem("chat-tasks") || "[]")
    tasks.push({
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      priority,
      due_date: dueDate || null,
      source: "chat",
      source_channel: message?.channel,
      source_author: message?.author,
      status: "open",
      created_at: new Date().toISOString(),
    })
    localStorage.setItem("chat-tasks", JSON.stringify(tasks))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-500" />
            Créer une tâche depuis ce message
          </DialogTitle>
          <DialogDescription>
            Transformez ce message chat en tâche actionnable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="chat-task-title">Titre *</Label>
            <Input
              id="chat-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la tâche"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chat-task-desc">Description</Label>
            <Textarea
              id="chat-task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails de la tâche..."
              rows={5}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="chat-task-due">Date d&apos;échéance</Label>
              <Input
                id="chat-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chat-task-priority">Priorité</Label>
              <select
                id="chat-task-priority"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
              >
                <option value={1}>Haute</option>
                <option value={2}>Moyenne</option>
                <option value={3}>Basse</option>
              </select>
            </div>
          </div>

          {message && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Message de <strong>{message.author}</strong> dans{" "}
                <strong>#{message.channel}</strong>. Vous pourrez retrouver
                cette tâche dans le module Tâches.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Enregistrement..." : "Créer la tâche"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
