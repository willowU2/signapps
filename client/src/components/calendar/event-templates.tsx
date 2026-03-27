"use client"

// IDEA-047: Event templates — save/load reusable event configurations (meeting types)

import { useState, useCallback } from "react"
import { Plus, Trash2, Save, BookOpen, Clock, MapPin, Users, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export interface EventTemplate {
    id: string
    name: string
    title: string
    description?: string
    location?: string
    durationMinutes: number
    category?: string
    color?: string
}

const STORAGE_KEY = "calendar_event_templates"

function loadTemplates(): EventTemplate[] {
    if (typeof window === "undefined") return []
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : getDefaultTemplates()
    } catch {
        return getDefaultTemplates()
    }
}

function saveTemplates(templates: EventTemplate[]) {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

function getDefaultTemplates(): EventTemplate[] {
    return [
        { id: "t1", name: "1:1 Meeting", title: "1:1 with {{name}}", description: "Regular sync meeting", durationMinutes: 30, color: "#039be5", category: "meeting" },
        { id: "t2", name: "Team Standup", title: "Daily Standup", description: "Daily team sync", location: "Conference Room A", durationMinutes: 15, color: "#0b8043", category: "standup" },
        { id: "t3", name: "Client Call", title: "Call with {{client}}", description: "Client consultation call", durationMinutes: 60, color: "#e67c73", category: "external" },
        { id: "t4", name: "Focus Block", title: "Focus Time", description: "Deep work — no interruptions", durationMinutes: 120, color: "#8e24aa", category: "focus" },
    ]
}

interface EventTemplateSelectorProps {
    onSelect: (template: EventTemplate) => void
}

export function EventTemplateSelector({ onSelect }: EventTemplateSelectorProps) {
    const [templates, setTemplates] = useState<EventTemplate[]>(loadTemplates)
    const [editOpen, setEditOpen] = useState(false)
    const [editing, setEditing] = useState<Partial<EventTemplate> | null>(null)

    const handleDelete = (id: string) => {
        const updated = templates.filter((t) => t.id !== id)
        setTemplates(updated)
        saveTemplates(updated)
        toast.success("Template deleted")
    }

    const openCreate = () => {
        setEditing({ name: "", title: "", description: "", location: "", durationMinutes: 60, color: "#039be5" })
        setEditOpen(true)
    }

    const handleSave = () => {
        if (!editing?.name?.trim() || !editing?.title?.trim()) {
            toast.error("Name and title are required")
            return
        }
        const template: EventTemplate = {
            id: editing.id || `t${Date.now()}`,
            name: editing.name!,
            title: editing.title!,
            description: editing.description,
            location: editing.location,
            durationMinutes: editing.durationMinutes || 60,
            color: editing.color || "#039be5",
            category: editing.category,
        }
        const updated = editing.id
            ? templates.map((t) => t.id === editing.id ? template : t)
            : [...templates, template]
        setTemplates(updated)
        saveTemplates(updated)
        setEditOpen(false)
        setEditing(null)
        toast.success(editing.id ? "Template updated" : "Template saved")
    }

    const DURATION_PRESETS = [15, 30, 45, 60, 90, 120]

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Templates
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 p-1">
                    {templates.map((t) => (
                        <DropdownMenuItem
                            key={t.id}
                            className="flex items-start gap-2 p-2 cursor-pointer rounded-lg group"
                            onSelect={() => onSelect(t)}
                        >
                            <div
                                className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                                style={{ background: t.color || "#039be5" }}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{t.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    <Clock className="h-3 w-3" />
                                    <span>{t.durationMinutes} min</span>
                                    {t.location && (
                                        <>
                                            <MapPin className="h-3 w-3" />
                                            <span className="truncate">{t.location}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer rounded-lg" onSelect={openCreate}>
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Create new template
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Edit/Create dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? "Edit Template" : "New Event Template"}</DialogTitle>
                    </DialogHeader>

                    {editing && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Template name *</Label>
                                    <Input className="h-8 text-sm" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Team Standup" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Color</Label>
                                    <Input type="color" className="h-8 p-0.5 w-full" value={editing.color || "#039be5"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Event title * (use {"{{variable}}"} for dynamic parts)</Label>
                                <Input className="h-8 text-sm" value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="1:1 with {{name}}" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Description</Label>
                                <Textarea rows={2} className="text-sm" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Location</Label>
                                    <Input className="h-8 text-sm" value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Room / URL" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Duration</Label>
                                    <div className="flex flex-wrap gap-1">
                                        {DURATION_PRESETS.map((d) => (
                                            <button
                                                key={d}
                                                className={`px-2 py-0.5 text-xs rounded border transition-colors ${editing.durationMinutes === d ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"}`}
                                                onClick={() => setEditing({ ...editing, durationMinutes: d })}
                                            >
                                                {d < 60 ? `${d}m` : `${d / 60}h`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSave}>
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
