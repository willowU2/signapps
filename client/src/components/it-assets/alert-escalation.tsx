"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Bell, Plus, Trash2, ChevronRight, Phone, Mail, User, Clock } from "lucide-react"
import { getClient, ServiceName } from "@/lib/api/factory"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EscalationLevel {
  delay_minutes: number
  notify_email: string
  notify_label: string
  sms_number?: string
}

interface EscalationPolicy {
  id: string
  name: string
  description?: string
  l1: EscalationLevel
  l2: EscalationLevel
  l3: EscalationLevel & { sms_number?: string }
  enabled: boolean
  created_at: string
}

interface CreatePolicyRequest {
  name: string
  description?: string
  l1_delay_minutes: number
  l1_notify_email: string
  l1_notify_label: string
  l2_delay_minutes: number
  l2_notify_email: string
  l2_notify_label: string
  l3_delay_minutes: number
  l3_notify_email: string
  l3_notify_label: string
  l3_sms_number?: string
}

// ─── API ──────────────────────────────────────────────────────────────────────

const client = getClient(ServiceName.IT_ASSETS)

const escalationApi = {
  list:   ()                                    => client.get<EscalationPolicy[]>("/it-assets/escalation-policies"),
  create: (data: CreatePolicyRequest)            => client.post<EscalationPolicy>("/it-assets/escalation-policies", data),
  delete: (id: string)                          => client.delete(`/it-assets/escalation-policies/${id}`),
  toggle: (id: string, enabled: boolean)        => client.patch<EscalationPolicy>(`/it-assets/escalation-policies/${id}`, { enabled }),
}

// ─── Level Card ───────────────────────────────────────────────────────────────

interface LevelCardProps {
  level: number
  label: string
  color: string
  delayLabel: string
  form: { email: string; label: string; sms?: string }
  onChange: (field: "email" | "label" | "sms", value: string) => void
  showSms?: boolean
}

function LevelCard({ level, label, color, delayLabel, form, onChange, showSms }: LevelCardProps) {
  return (
    <div className={`rounded-lg border-l-4 ${color} pl-4 py-3 pr-3 space-y-2 bg-card`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.replace("border-", "bg-")} bg-opacity-10`}>
          Level {level}
        </span>
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className="ml-auto text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {delayLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Notify label</Label>
          <Input className="mt-0.5 h-8 text-sm" value={form.label} onChange={e => onChange("label", e.target.value)} placeholder="Assigned tech" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input className="mt-0.5 h-8 text-sm" type="email" value={form.email} onChange={e => onChange("email", e.target.value)} placeholder="tech@company.com" />
        </div>
        {showSms && (
          <div className="col-span-2">
            <Label className="text-xs">SMS number (optional)</Label>
            <Input className="mt-0.5 h-8 text-sm" value={form.sms ?? ""} onChange={e => onChange("sms", e.target.value)} placeholder="+1 555 000 0000" />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Policy Form ──────────────────────────────────────────────────────────────

const BLANK_FORM: CreatePolicyRequest = {
  name: "", description: "",
  l1_delay_minutes: 0,  l1_notify_email: "", l1_notify_label: "Assigned tech",
  l2_delay_minutes: 15, l2_notify_email: "", l2_notify_label: "Team lead",
  l3_delay_minutes: 30, l3_notify_email: "", l3_notify_label: "Manager", l3_sms_number: "",
}

function PolicyForm({ onSave, onClose }: { onSave: (data: CreatePolicyRequest) => void; onClose: () => void }) {
  const [form, setForm] = useState<CreatePolicyRequest>({ ...BLANK_FORM })
  const set = <K extends keyof CreatePolicyRequest>(k: K, v: CreatePolicyRequest[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  function submit() {
    if (!form.name) return
    onSave(form)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Escalation Policy</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Policy name</Label>
            <Input className="mt-1" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Standard IT escalation" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Input className="mt-1" value={form.description ?? ""} onChange={e => set("description", e.target.value)} />
          </div>

          <div className="space-y-3">
            <LevelCard
              level={1} label="Immediate notification" color="border-blue-500"
              delayLabel="0-15 min"
              form={{ email: form.l1_notify_email, label: form.l1_notify_label }}
              onChange={(f, v) => set(f === "email" ? "l1_notify_email" : "l1_notify_label", v)}
            />
            <div className="flex items-center justify-center"><ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
            <LevelCard
              level={2} label="Team lead escalation" color="border-yellow-500"
              delayLabel="15-30 min"
              form={{ email: form.l2_notify_email, label: form.l2_notify_label }}
              onChange={(f, v) => set(f === "email" ? "l2_notify_email" : "l2_notify_label", v)}
            />
            <div className="flex items-center justify-center"><ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
            <LevelCard
              level={3} label="Management escalation + SMS" color="border-red-500"
              delayLabel="30 min+"
              form={{ email: form.l3_notify_email, label: form.l3_notify_label, sms: form.l3_sms_number }}
              onChange={(f, v) => {
                if (f === "sms") set("l3_sms_number", v)
                else set(f === "email" ? "l3_notify_email" : "l3_notify_label", v)
              }}
              showSms
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Create Policy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Policy Row ───────────────────────────────────────────────────────────────

function PolicyLevelBadge({ level, label, email }: { level: number; label: string; email?: string }) {
  if (!email && !label) return null
  const colors = ["", "bg-blue-100 text-blue-800", "bg-yellow-100 text-yellow-800", "bg-red-100 text-red-800"]
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[level]}`}>
      L{level}: {label || email}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AlertEscalation() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: policies = [], isLoading } = useQuery<EscalationPolicy[]>({
    queryKey: ["escalation-policies"],
    queryFn: () => escalationApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePolicyRequest) => escalationApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["escalation-policies"] }); setShowForm(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => escalationApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escalation-policies"] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => escalationApi.toggle(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["escalation-policies"] }),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Alert Escalation Policies
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Policy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : policies.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Bell className="h-8 w-8 mx-auto opacity-20 mb-2" />
            No escalation policies defined.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Escalation chain</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name}
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      <PolicyLevelBadge level={1} label={p.l1.notify_label} email={p.l1.notify_email} />
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <PolicyLevelBadge level={2} label={p.l2.notify_label} email={p.l2.notify_email} />
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <PolicyLevelBadge level={3} label={p.l3.notify_label} email={p.l3.notify_email} />
                      {p.l3.sms_number && <Badge variant="outline" className="text-xs gap-1"><Phone className="h-2.5 w-2.5" />SMS</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={v => toggleMutation.mutate({ id: p.id, enabled: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {showForm && <PolicyForm onSave={data => createMutation.mutate(data)} onClose={() => setShowForm(false)} />}
    </Card>
  )
}
