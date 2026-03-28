"use client"

// IDEA-284: Regulatory calendar — compliance deadlines with reminders

import { useState, useEffect } from "react"
import { Calendar, Bell, Plus, Trash2, AlertTriangle, CheckCircle2, Clock, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { format, differenceInDays, isPast, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"

type DeadlineType = "gdpr" | "financial" | "tax" | "labor" | "environmental" | "security" | "custom"
type RecurrenceType = "none" | "monthly" | "quarterly" | "annual"

interface ComplianceDeadline {
  id: string
  title: string
  description?: string
  due_date: string
  type: DeadlineType
  recurrence: RecurrenceType
  reminder_days: number
  completed: boolean
  reminder_email?: string
  regulation?: string    // e.g. "GDPR Art. 33"
}

const TYPE_CONFIG: Record<DeadlineType, { label: string; color: string; badge: string }> = {
  gdpr: { label: "GDPR", color: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  financial: { label: "Financial", color: "bg-green-500", badge: "bg-green-100 text-green-700" },
  tax: { label: "Tax", color: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700" },
  labor: { label: "Labor", color: "bg-orange-500", badge: "bg-orange-100 text-orange-700" },
  environmental: { label: "Environmental", color: "bg-teal-500", badge: "bg-teal-100 text-teal-700" },
  security: { label: "Security", color: "bg-red-500", badge: "bg-red-100 text-red-700" },
  custom: { label: "Custom", color: "bg-gray-500", badge: "bg-gray-100 text-gray-700" },
}

// Pre-loaded GDPR recurring deadlines
const GDPR_TEMPLATES: Omit<ComplianceDeadline, "id" | "completed">[] = [
  { title: "Annual GDPR review", description: "Review and update privacy policies, DPAs, and ROPAs.", due_date: "", type: "gdpr", recurrence: "annual", reminder_days: 30, regulation: "GDPR Art. 5(2)" },
  { title: "Data breach notification window", description: "72h window to notify supervisory authority of breaches.", due_date: "", type: "gdpr", recurrence: "none", reminder_days: 1, regulation: "GDPR Art. 33" },
  { title: "Consent renewal", description: "Review and re-obtain consent for long-standing processing.", due_date: "", type: "gdpr", recurrence: "annual", reminder_days: 60, regulation: "GDPR Art. 7" },
]

export function RegulatoryCalendar() {
  const [deadlines, setDeadlines] = useState<ComplianceDeadline[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    type: "gdpr" as DeadlineType,
    recurrence: "none" as RecurrenceType,
    reminder_days: 7,
    reminder_email: "",
    regulation: "",
  })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<"all" | "upcoming" | "overdue" | "completed">("all")

  useEffect(() => { loadDeadlines() }, [])

  async function loadDeadlines() {
    setLoading(true)
    try {
      const res = await fetch("/api/compliance/regulatory-calendar")
      const data = await res.json()
      setDeadlines(data.data ?? [])
    } catch {
      toast.error("Failed to load compliance calendar")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.title || !form.due_date) { toast.error("Title and due date required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/compliance/regulatory-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const created = await res.json()
      setDeadlines(prev => [...prev, created])
      setDialogOpen(false)
      toast.success("Deadline added")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function toggleComplete(id: string, completed: boolean) {
    try {
      await fetch(`/api/compliance/regulatory-calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      })
      setDeadlines(prev => prev.map(d => d.id === id ? { ...d, completed } : d))
      if (completed) toast.success("Marked as complete")
    } catch {
      toast.error("Failed to update")
    }
  }

  async function deleteDeadline(id: string) {
    try {
      await fetch(`/api/compliance/regulatory-calendar/${id}`, { method: "DELETE" })
      setDeadlines(prev => prev.filter(d => d.id !== id))
      toast.success("Deleted")
    } catch {
      toast.error("Failed to delete")
    }
  }

  function urgency(d: ComplianceDeadline): "overdue" | "critical" | "soon" | "ok" {
    if (d.completed) return "ok"
    const daysLeft = differenceInDays(new Date(d.due_date), new Date())
    if (daysLeft < 0) return "overdue"
    if (daysLeft <= 7) return "critical"
    if (daysLeft <= d.reminder_days) return "soon"
    return "ok"
  }

  const filtered = deadlines.filter(d => {
    if (filter === "upcoming") return !d.completed && !isPast(new Date(d.due_date))
    if (filter === "overdue") return !d.completed && isPast(new Date(d.due_date))
    if (filter === "completed") return d.completed
    return true
  }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

  // Calendar view data
  const calDays = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const deadlinesByDay = (day: Date) => deadlines.filter(d => isSameDay(new Date(d.due_date), day))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" /> Regulatory Calendar
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setViewMode(v => v === "list" ? "calendar" : "list")}>
            {viewMode === "list" ? "Calendar" : "List"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {(["all", "upcoming", "overdue", "completed"] as const).map(f => {
          const count = f === "all" ? deadlines.length
            : f === "upcoming" ? deadlines.filter(d => !d.completed && !isPast(new Date(d.due_date))).length
            : f === "overdue" ? deadlines.filter(d => !d.completed && isPast(new Date(d.due_date))).length
            : deadlines.filter(d => d.completed).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium border",
                filter === f ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                f === "overdue" && count > 0 && filter !== f && "border-destructive text-destructive"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </button>
          )
        })}
      </div>

      {viewMode === "list" ? (
        <ScrollArea className="h-80">
          {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
          {filtered.map(d => {
            const u = urgency(d)
            const daysLeft = differenceInDays(new Date(d.due_date), new Date())
            return (
              <div key={d.id} className={cn(
                "flex items-start justify-between px-3 py-3 border-b last:border-0",
                u === "overdue" && !d.completed && "bg-red-50/50 dark:bg-red-950/10",
                u === "critical" && !d.completed && "bg-orange-50/50 dark:bg-orange-950/10",
              )}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Switch
                    checked={d.completed}
                    onCheckedChange={v => toggleComplete(d.id, v)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-medium", d.completed && "line-through text-muted-foreground")}>{d.title}</p>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", TYPE_CONFIG[d.type].badge)}>
                        {TYPE_CONFIG[d.type].label}
                      </span>
                      {d.regulation && <span className="text-xs text-muted-foreground font-mono">{d.regulation}</span>}
                    </div>
                    {d.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(d.due_date), "MMM d, yyyy")}
                      </span>
                      {!d.completed && (
                        <span className={cn("text-xs font-medium",
                          u === "overdue" && "text-destructive",
                          u === "critical" && "text-orange-600",
                          u === "soon" && "text-yellow-600",
                        )}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                        </span>
                      )}
                      {d.recurrence !== "none" && (
                        <Badge variant="outline" className="text-xs capitalize">{d.recurrence}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0 ml-2 text-destructive" onClick={() => deleteDeadline(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No deadlines</p>
          )}
        </ScrollArea>
      ) : (
        // Mini calendar view
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Button size="sm" variant="ghost" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>‹</Button>
            <span className="text-sm font-medium">{format(currentMonth, "MMMM yyyy")}</span>
            <Button size="sm" variant="ghost" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>›</Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
            ))}
            {/* Empty cells for month start */}
            {Array.from({ length: calDays[0].getDay() }).map((_, i) => <div key={`e${i}`} />)}
            {calDays.map(day => {
              const dayDeadlines = deadlinesByDay(day)
              const hasOverdue = dayDeadlines.some(d => !d.completed)
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-start rounded text-xs p-1",
                    isSameDay(day, new Date()) && "bg-primary/10 font-bold",
                    hasOverdue && "ring-1 ring-orange-400"
                  )}
                >
                  <span>{day.getDate()}</span>
                  {dayDeadlines.map(d => (
                    <div key={d.id} className={cn("w-1.5 h-1.5 rounded-full mt-0.5", TYPE_CONFIG[d.type].color)} title={d.title} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Compliance Deadline</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Annual GDPR review" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Due date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as DeadlineType }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_CONFIG) as DeadlineType[]).map(t => (
                      <SelectItem key={t} value={t}>{TYPE_CONFIG[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Recurrence</Label>
                <Select value={form.recurrence} onValueChange={v => setForm(p => ({ ...p, recurrence: v as RecurrenceType }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remind (days before)</Label>
                <Input type="number" min={1} value={form.reminder_days} onChange={e => setForm(p => ({ ...p, reminder_days: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Regulation reference</Label>
              <Input value={form.regulation} onChange={e => setForm(p => ({ ...p, regulation: e.target.value }))} placeholder="GDPR Art. 33, DORA Art. 17…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reminder email</Label>
              <Input value={form.reminder_email} onChange={e => setForm(p => ({ ...p, reminder_email: e.target.value }))} placeholder="compliance@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Add Deadline"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
