"use client"

// IDEA-275: Automatic document numbering — sequential IDs (INV-001, etc.)

import { useState, useEffect } from "react"
import { Hash, Plus, Pencil, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface NumberingScheme {
  id: string
  name: string
  prefix: string        // "INV", "PO", "DOC"
  suffix?: string       // optional suffix
  padding: number       // leading zeros: 3 → 001
  separator: string     // "-", "/", ""
  current_value: number
  reset_annually: boolean
  year_in_number: boolean  // INV-2026-001
  active: boolean
  preview: string          // computed preview
}

function buildPreview(s: Omit<NumberingScheme, "id" | "preview">): string {
  const num = s.current_value.toString().padStart(s.padding, "0")
  const year = s.year_in_number ? `${new Date().getFullYear()}${s.separator}` : ""
  const suffix = s.suffix ? `${s.separator}${s.suffix}` : ""
  return `${s.prefix}${s.separator}${year}${num}${suffix}`
}

export function DocNumberingSchemes() {
  const [schemes, setSchemes] = useState<NumberingScheme[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editScheme, setEditScheme] = useState<NumberingScheme | null>(null)
  const [form, setForm] = useState({
    name: "",
    prefix: "DOC",
    suffix: "",
    padding: 3,
    separator: "-",
    current_value: 1,
    reset_annually: false,
    year_in_number: false,
    active: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSchemes() }, [])

  async function loadSchemes() {
    setLoading(true)
    try {
      const res = await fetch("/api/docs/numbering")
      const data = await res.json()
      setSchemes((data.data ?? []).map((s: NumberingScheme) => ({
        ...s,
        preview: buildPreview(s),
      })))
    } catch {
      toast.error("Failed to load numbering schemes")
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditScheme(null)
    setForm({ name: "", prefix: "DOC", suffix: "", padding: 3, separator: "-", current_value: 1, reset_annually: false, year_in_number: false, active: true })
    setDialogOpen(true)
  }

  function openEdit(s: NumberingScheme) {
    setEditScheme(s)
    setForm({ name: s.name, prefix: s.prefix, suffix: s.suffix ?? "", padding: s.padding, separator: s.separator, current_value: s.current_value, reset_annually: s.reset_annually, year_in_number: s.year_in_number, active: s.active })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.prefix) { toast.error("Name and prefix required"); return }
    setSaving(true)
    try {
      const payload = { ...form, suffix: form.suffix || undefined }
      if (editScheme) {
        const res = await fetch(`/api/docs/numbering/${editScheme.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const updated = await res.json()
        setSchemes(prev => prev.map(s => s.id === editScheme.id ? { ...updated, preview: buildPreview(updated) } : s))
        toast.success("Scheme updated")
      } else {
        const res = await fetch("/api/docs/numbering", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const created = await res.json()
        setSchemes(prev => [...prev, { ...created, preview: buildPreview(created) }])
        toast.success("Scheme created")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Impossible d'enregistrer")
    } finally {
      setSaving(false)
    }
  }

  async function deleteScheme(id: string) {
    try {
      await fetch(`/api/docs/numbering/${id}`, { method: "DELETE" })
      setSchemes(prev => prev.filter(s => s.id !== id))
      toast.success("Scheme deleted")
    } catch {
      toast.error("Impossible de supprimer")
    }
  }

  const preview = buildPreview(form as Omit<NumberingScheme, "id" | "preview">)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Hash className="h-4 w-4" /> Document Numbering
        </CardTitle>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Scheme
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground py-2">Loading…</p>}
        {!loading && schemes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No numbering schemes configured</p>
        )}
        {schemes.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{s.name}</p>
                {s.active ? <Badge variant="default" className="text-xs">Active</Badge> : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
              </div>
              <code className="text-xs text-muted-foreground">{s.preview}</code>
              <p className="text-xs text-muted-foreground">Current: {s.current_value} · Next: {s.current_value + 1}</p>
            </div>
            <div className="flex items-center gap-1 ml-3 flex-shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteScheme(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editScheme ? "Edit Scheme" : "New Numbering Scheme"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Invoices" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prefix</Label>
                <Input value={form.prefix} onChange={e => setForm(p => ({ ...p, prefix: e.target.value.toUpperCase() }))} placeholder="INV" className="h-8 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Separator</Label>
                <Input value={form.separator} onChange={e => setForm(p => ({ ...p, separator: e.target.value }))} placeholder="-" className="h-8 w-16 font-mono" maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Padding (zeros)</Label>
                <Input type="number" min={1} max={8} value={form.padding} onChange={e => setForm(p => ({ ...p, padding: Number(e.target.value) }))} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start at</Label>
                <Input type="number" min={1} value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: Number(e.target.value) }))} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Suffix (optional)</Label>
                <Input value={form.suffix} onChange={e => setForm(p => ({ ...p, suffix: e.target.value }))} placeholder="FR" className="h-8 font-mono" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Include year</Label>
              <Switch checked={form.year_in_number} onCheckedChange={v => setForm(p => ({ ...p, year_in_number: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Reset annually</Label>
              <Switch checked={form.reset_annually} onCheckedChange={v => setForm(p => ({ ...p, reset_annually: v }))} />
            </div>
            <div className="rounded-md bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground">Preview:</p>
              <code className="text-sm font-mono font-medium">{preview}</code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
