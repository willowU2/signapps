"use client"

// IDEA-264: Email delegation — delegate inbox access to another user

import { useState, useEffect } from "react"
import { UserPlus, Trash2, Shield, ShieldCheck, Eye, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { accountApi } from "@/lib/api-mail"
import { format } from "date-fns"

interface Delegation {
  id: string
  account_id: string
  delegate_email: string
  delegate_name?: string
  can_read: boolean
  can_send: boolean
  can_delete: boolean
  expires_at?: string
  created_at: string
}

interface EmailDelegationProps {
  accountId: string
}

export function EmailDelegation({ accountId }: EmailDelegationProps) {
  const [delegations, setDelegations] = useState<Delegation[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    delegate_email: "",
    can_read: true,
    can_send: false,
    can_delete: false,
    expires_at: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadDelegations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  async function loadDelegations() {
    setLoading(true)
    try {
      const data = await accountApi.listDelegations(accountId)
      setDelegations(data)
    } catch {
      toast.error("Impossible de charger les délégations")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!form.delegate_email.includes("@")) {
      toast.error("Email invalide")
      return
    }
    setSaving(true)
    try {
      const created = await accountApi.createDelegation(accountId, {
        ...form,
        expires_at: form.expires_at || undefined,
      })
      setDelegations(prev => [...prev, created])
      setDialogOpen(false)
      toast.success("Délégation créée — invitation envoyée")
    } catch {
      toast.error("Impossible de créer delegation")
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(id: string) {
    try {
      await accountApi.revokeDelegation(accountId, id)
      setDelegations(prev => prev.filter(d => d.id !== id))
      toast.success("Délégation révoquée")
    } catch {
      toast.error("Impossible de révoquer")
    }
  }

  function permBadges(d: Delegation) {
    const badges = []
    if (d.can_read) badges.push(<Badge key="r" variant="secondary" className="text-xs gap-1"><Eye className="h-3 w-3" />Read</Badge>)
    if (d.can_send) badges.push(<Badge key="s" variant="secondary" className="text-xs gap-1"><Send className="h-3 w-3" />Send</Badge>)
    if (d.can_delete) badges.push(<Badge key="d" variant="destructive" className="text-xs">Supprimer</Badge>)
    return badges
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Inbox Delegation
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Delegate
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground py-2">Loading…</p>}
        {!loading && delegations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No delegations active</p>
        )}
        {delegations.map(d => (
          <div key={d.id} className="flex items-start justify-between rounded-md border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{d.delegate_name ?? d.delegate_email}</p>
              <p className="text-xs text-muted-foreground">{d.delegate_email}</p>
              <div className="flex flex-wrap gap-1 mt-1">{permBadges(d)}</div>
              {d.expires_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expires {format(new Date(d.expires_at), "MMM d, yyyy")}
                </p>
              )}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive ml-2 flex-shrink-0" onClick={() => handleRevoke(d.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delegate Inbox Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Delegate to (email)</Label>
              <Input
                value={form.delegate_email}
                onChange={e => setForm(p => ({ ...p, delegate_email: e.target.value }))}
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2 rounded-md border p-3">
                {[
                  { key: "can_read", label: "Read emails", icon: <Eye className="h-3.5 w-3.5" /> },
                  { key: "can_send", label: "Send as me", icon: <Send className="h-3.5 w-3.5" /> },
                  { key: "can_delete", label: "Delete emails", icon: <Trash2 className="h-3.5 w-3.5 text-destructive" /> },
                ].map(({ key, label, icon }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={form[key as keyof typeof form] as boolean}
                      onCheckedChange={v => setForm(p => ({ ...p, [key]: !!v }))}
                    />
                    <label htmlFor={key} className="text-sm flex items-center gap-1.5 cursor-pointer">
                      {icon}{label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expires (optional)</Label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Delegation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
