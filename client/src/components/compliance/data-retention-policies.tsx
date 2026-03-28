"use client"

// IDEA-278: Data retention policies — configure per data type, auto-purge

import { useState, useEffect } from "react"
import { Timer, Plus, Trash2, Pencil, Play, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { toast } from "sonner"

type PurgeAction = "delete" | "anonymize" | "archive"
type RetentionUnit = "days" | "months" | "years"

interface RetentionPolicy {
  id: string
  name: string
  data_type: string
  retention_value: number
  retention_unit: RetentionUnit
  purge_action: PurgeAction
  auto_purge: boolean
  last_run_at?: string
  next_run_at?: string
  records_affected?: number
  active: boolean
}

const ACTION_LABELS: Record<PurgeAction, string> = {
  delete: "Permanently delete",
  anonymize: "Anonymize",
  archive: "Archive",
}

const ACTION_VARIANTS: Record<PurgeAction, "destructive" | "secondary" | "outline"> = {
  delete: "destructive",
  anonymize: "secondary",
  archive: "outline",
}

export function DataRetentionPolicies() {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPolicy, setEditPolicy] = useState<RetentionPolicy | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    data_type: "",
    retention_value: 12,
    retention_unit: "months" as RetentionUnit,
    purge_action: "anonymize" as PurgeAction,
    auto_purge: true,
    active: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadPolicies() }, [])

  async function loadPolicies() {
    setLoading(true)
    try {
      const res = await fetch("/api/compliance/retention-policies")
      const data = await res.json()
      setPolicies(data.data ?? [])
    } catch {
      toast.error("Impossible de charger les politiques de rétention")
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditPolicy(null)
    setForm({ name: "", data_type: "", retention_value: 12, retention_unit: "months", purge_action: "anonymize", auto_purge: true, active: true })
    setDialogOpen(true)
  }

  function openEdit(p: RetentionPolicy) {
    setEditPolicy(p)
    setForm({ name: p.name, data_type: p.data_type, retention_value: p.retention_value, retention_unit: p.retention_unit, purge_action: p.purge_action, auto_purge: p.auto_purge, active: p.active })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.data_type) { toast.error("Le nom et le type de données sont requis"); return }
    setSaving(true)
    try {
      if (editPolicy) {
        const res = await fetch(`/api/compliance/retention-policies/${editPolicy.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const updated = await res.json()
        setPolicies(prev => prev.map(p => p.id === editPolicy.id ? updated : p))
        toast.success("Politique mise à jour")
      } else {
        const res = await fetch("/api/compliance/retention-policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const created = await res.json()
        setPolicies(prev => [...prev, created])
        toast.success("Politique créée")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Impossible d'enregistrer")
    } finally {
      setSaving(false)
    }
  }

  async function runPolicy(id: string) {
    setRunningId(id)
    try {
      const res = await fetch(`/api/compliance/retention-policies/${id}/run`, { method: "POST" })
      const result = await res.json()
      setPolicies(prev => prev.map(p => p.id === id ? { ...p, last_run_at: new Date().toISOString(), records_affected: result.affected } : p))
      toast.success(`Policy run: ${result.affected} records processed`)
    } catch {
      toast.error("Échec de l'exécution de la politique")
    } finally {
      setRunningId(null)
    }
  }

  async function deletePolicy(id: string) {
    try {
      await fetch(`/api/compliance/retention-policies/${id}`, { method: "DELETE" })
      setPolicies(prev => prev.filter(p => p.id !== id))
      toast.success("Politique supprimée")
    } catch {
      toast.error("Impossible de supprimer")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Timer className="h-4 w-4" /> Data Retention Policies
        </CardTitle>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Policy
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80">
          {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
          {!loading && policies.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No retention policies</p>
          )}
          {policies.map(p => (
            <div key={p.id} className="flex items-start justify-between px-4 py-3 border-b last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium">{p.name}</p>
                  {!p.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Data: <span className="font-medium">{p.data_type}</span>
                  {" · "}Retain {p.retention_value} {p.retention_unit}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={ACTION_VARIANTS[p.purge_action]} className="text-xs">{ACTION_LABELS[p.purge_action]}</Badge>
                  {p.auto_purge && <Badge variant="outline" className="text-xs">Auto-purge</Badge>}
                  {p.records_affected !== undefined && (
                    <span className="text-xs text-muted-foreground">{p.records_affected} records</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => runPolicy(p.id)} disabled={runningId === p.id}>
                  <Play className={`h-3.5 w-3.5 ${runningId === p.id ? "animate-pulse" : ""}`} />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deletePolicy(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPolicy ? "Edit Policy" : "New Retention Policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Policy name</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Customer emails" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Data type</Label>
                <Input value={form.data_type} onChange={e => setForm(p => ({ ...p, data_type: e.target.value }))} placeholder="emails / contacts / logs…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Retain for</Label>
                <div className="flex gap-2">
                  <Input type="number" min={1} value={form.retention_value} onChange={e => setForm(p => ({ ...p, retention_value: Number(e.target.value) }))} className="w-20" />
                  <Select value={form.retention_unit} onValueChange={v => setForm(p => ({ ...p, retention_unit: v as RetentionUnit }))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="years">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">After expiry</Label>
                <Select value={form.purge_action} onValueChange={v => setForm(p => ({ ...p, purge_action: v as PurgeAction }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ACTION_LABELS) as PurgeAction[]).map(a => (
                      <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto-purge (run daily)</Label>
              <Switch checked={form.auto_purge} onCheckedChange={v => setForm(p => ({ ...p, auto_purge: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Active</Label>
              <Switch checked={form.active} onCheckedChange={v => setForm(p => ({ ...p, active: v }))} />
            </div>
            {form.purge_action === "delete" && (
              <div className="flex items-center gap-2 rounded-md border border-destructive p-2 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive">Permanent deletion cannot be undone.</p>
              </div>
            )}
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
