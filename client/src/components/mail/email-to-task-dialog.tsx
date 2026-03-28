"use client"

import { useState, useEffect } from "react"
import { CheckSquare, Calendar as CalendarIcon, AlertCircle } from "lucide-react"
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

interface EmailToTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailSubject: string
  emailBody: string
  emailFrom: string
  emailId: string
}

export function EmailToTaskDialog({
  open,
  onOpenChange,
  emailSubject,
  emailBody,
  emailFrom,
  emailId,
}: EmailToTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [priority, setPriority] = useState(2)
  const [saving, setSaving] = useState(false)

  // Pre-fill when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(emailSubject || "")
      // Take first 500 chars of body as description snippet
      const snippet = emailBody
        ? `[Email de ${emailFrom}]\n\n${emailBody.slice(0, 500)}${emailBody.length > 500 ? "..." : ""}`
        : `[Email de ${emailFrom}]`
      setDescription(snippet)
      setDueDate("")
      setPriority(2)
    }
  }, [open, emailSubject, emailBody, emailFrom])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Le titre est requis")
      return
    }

    setSaving(true)

    try {
      // Try to create task via API
      const calendarsResponse = await calendarApi.listCalendars()
      const calendars = calendarsResponse.data || []

      if (calendars.length > 0) {
        await tasksApi.createTask(calendars[0].id, {
          title: title.trim(),
          description: description.trim(),
          priority,
          due_date: dueDate || undefined,
        })
        toast.success("Tâche créée avec succès")
      } else {
        // Fallback: store in localStorage
        saveToLocalStorage()
        toast.success("Tâche enregistrée localement")
      }
    } catch {
      // Fallback: store in localStorage
      saveToLocalStorage()
      toast.success("Tâche enregistrée localement (service indisponible)")
    } finally {
      setSaving(false)
      onOpenChange(false)
    }
  }

  const saveToLocalStorage = () => {
    const tasks = JSON.parse(localStorage.getItem("email-tasks") || "[]")
    tasks.push({
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      priority,
      due_date: dueDate || null,
      source_email_id: emailId,
      status: "open",
      created_at: new Date().toISOString(),
    })
    localStorage.setItem("email-tasks", JSON.stringify(tasks))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-500" />
            Creer une tache depuis cet email
          </DialogTitle>
          <DialogDescription>
            Transformez cet email en tache actionnable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titre *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la tache"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details de la tache..."
              rows={5}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Date d&apos;echeance</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priorite</Label>
              <select
                id="task-priority"
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

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>La tache sera liee a l&apos;email de <strong>{emailFrom}</strong>. Vous pourrez la retrouver dans le module Taches.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "Enregistrement..." : "Creer la tache"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
