"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { UserCheck, History, Plus, UserX } from "lucide-react"
import { format } from "date-fns"
import type { HardwareAsset } from "@/lib/api/it-assets"
import { itAssetsApi } from "@/lib/api/it-assets"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

interface AssignmentRecord {
  id: string
  user: string
  assigned_at: string
  unassigned_at?: string
  note?: string
}

interface Props {
  asset: HardwareAsset
}

export function AssetAssignment({ asset }: Props) {
  const queryClient = useQueryClient()
  const [history, setHistory] = useState<AssignmentRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ user: "", note: "" })
  const [saving, setSaving] = useState(false)

  const handleAssign = async () => {
    if (!form.user.trim()) return
    setSaving(true)
    try {
      await itAssetsApi.updateHardware(asset.id, { assigned_user_id: form.user })
      setHistory(h => [{
        id: Date.now().toString(),
        user: form.user,
        assigned_at: new Date().toISOString(),
        note: form.note || undefined,
      }, ...h])
      toast.success(`Assigned to ${form.user}`)
      queryClient.invalidateQueries({ queryKey: ['it-assets'] })
      setDialogOpen(false)
      setForm({ user: "", note: "" })
    } catch {
      toast.error("Impossible d'assigner l'équipement")
    } finally {
      setSaving(false)
    }
  }

  const handleUnassign = async () => {
    setSaving(true)
    try {
      await itAssetsApi.updateHardware(asset.id, { assigned_user_id: "" })
      setHistory(h => h.map((r, i) => i === 0 ? { ...r, unassigned_at: new Date().toISOString() } : r))
      toast.success("Équipement désassigné")
      queryClient.invalidateQueries({ queryKey: ['it-assets'] })
    } catch {
      toast.error("Impossible de désassigner")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-teal-500" />
          Assignment
        </CardTitle>
        <div className="flex gap-2">
          {asset.assigned_user_id && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={handleUnassign} disabled={saving}>
              <UserX className="h-3.5 w-3.5 mr-1" />
              Unassign
            </Button>
          )}
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Assign
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <UserCheck className="h-5 w-5 text-teal-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">Currently assigned to</p>
            {asset.assigned_user_id ? (
              <Badge className="mt-1 bg-teal-500/10 text-teal-700 border-teal-500/20">{asset.assigned_user_id}</Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Unassigned</span>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <History className="h-3 w-3" />
              Assignment History
            </p>
            <div className="space-y-1.5">
              {history.map(r => (
                <div key={r.id} className="flex items-start justify-between text-xs border rounded-md px-3 py-2">
                  <div>
                    <span className="font-medium">{r.user}</span>
                    {r.note && <span className="text-muted-foreground ml-2">— {r.note}</span>}
                    <div className="text-muted-foreground mt-0.5">
                      {format(new Date(r.assigned_at), "MMM d, yyyy HH:mm")}
                      {r.unassigned_at && ` → ${format(new Date(r.unassigned_at), "MMM d, yyyy HH:mm")}`}
                    </div>
                  </div>
                  <Badge variant={r.unassigned_at ? "secondary" : "outline"} className="ml-2 shrink-0">
                    {r.unassigned_at ? "Returned" : "Active"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Assign Asset</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Employee / User *</Label>
              <Input placeholder="e.g. john.doe or employee ID" value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea rows={2} placeholder="Optional assignment note…" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={!form.user.trim() || saving}>
              {saving ? "Saving…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
