"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Zap, Plus, Trash2, Edit, Play, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getClient, ServiceName } from "@/lib/api/factory"
import { usePageTitle } from "@/hooks/use-page-title"
import { formatDistanceToNow } from "date-fns"

const client = getClient(ServiceName.IT_ASSETS)

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger_type: string
  trigger_config: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  cooldown_minutes: number
  last_triggered?: string
  created_at: string
}

const TRIGGER_TYPES = [
  { value: "alert_fired",        label: "Alert Fired" },
  { value: "device_offline",     label: "Device Offline" },
  { value: "patch_available",    label: "Patch Available" },
  { value: "software_detected",  label: "Software Detected" },
  { value: "disk_usage_high",    label: "Disk Usage High" },
  { value: "cpu_high",           label: "CPU High" },
  { value: "memory_high",        label: "Memory High" },
]

const ACTION_TYPES = [
  { value: "run_script",         label: "Run Script" },
  { value: "send_notification",  label: "Send Notification" },
  { value: "create_ticket",      label: "Create Ticket" },
  { value: "reboot_device",      label: "Reboot Device" },
  { value: "send_webhook",       label: "Send Webhook" },
  { value: "deploy_package",     label: "Deploy Package" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerLabel(t: string) {
  return TRIGGER_TYPES.find(x => x.value === t)?.label ?? t
}
function actionLabel(a: string) {
  return ACTION_TYPES.find(x => x.value === a)?.label ?? a
}

function TriggerBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    alert_fired:       "bg-red-100 text-red-800",
    device_offline:    "bg-gray-100 text-gray-800",
    patch_available:   "bg-blue-100 text-blue-800",
    software_detected: "bg-purple-100 text-purple-800",
    disk_usage_high:   "bg-orange-100 text-orange-800",
    cpu_high:          "bg-yellow-100 text-yellow-800",
    memory_high:       "bg-yellow-100 text-yellow-800",
  }
  return (
    <Badge variant="outline" className={`text-xs ${colors[type] ?? "bg-gray-100"}`}>
      {triggerLabel(type)}
    </Badge>
  )
}

function ActionBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    run_script:        "bg-green-100 text-green-800",
    send_notification: "bg-blue-100 text-blue-800",
    create_ticket:     "bg-indigo-100 text-indigo-800",
    reboot_device:     "bg-red-100 text-red-800",
    send_webhook:      "bg-teal-100 text-teal-800",
    deploy_package:    "bg-violet-100 text-violet-800",
  }
  return (
    <Badge variant="outline" className={`text-xs ${colors[type] ?? "bg-gray-100"}`}>
      {actionLabel(type)}
    </Badge>
  )
}

// ─── Rule form ────────────────────────────────────────────────────────────────

function RuleForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<AutomationRule>
  onSave: (data: Partial<AutomationRule>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [triggerType, setTriggerType] = useState(initial?.trigger_type ?? "alert_fired")
  const [actionType, setActionType] = useState(initial?.action_type ?? "send_notification")
  const [cooldown, setCooldown] = useState(String(initial?.cooldown_minutes ?? 60))
  const [actionConfig, setActionConfig] = useState(
    initial?.action_config ? JSON.stringify(initial.action_config, null, 2) : "{}"
  )
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)

  const handleSave = () => {
    let parsedConfig: Record<string, unknown> = {}
    try { parsedConfig = JSON.parse(actionConfig) } catch { toast.error("Invalid action config JSON") ; return }
    onSave({
      name,
      trigger_type: triggerType,
      action_type: actionType,
      action_config: parsedConfig,
      cooldown_minutes: parseInt(cooldown) || 60,
      enabled,
    })
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <Label>Rule Name *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Reboot on high CPU" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Trigger</Label>
          <Select value={triggerType} onValueChange={setTriggerType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Action</Label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Action Config (JSON)</Label>
        <textarea
          className="w-full border rounded-md px-3 py-2 text-sm font-mono min-h-[80px]"
          value={actionConfig}
          onChange={e => setActionConfig(e.target.value)}
          placeholder='{"message": "High CPU detected"}'
        />
        {actionType === "send_webhook" && (
          <p className="text-xs text-muted-foreground">Required: <code>{"{ \"url\": \"https://...\" }"}</code></p>
        )}
        {actionType === "run_script" && (
          <p className="text-xs text-muted-foreground">Required: <code>{"{ \"script_id\": \"uuid\" }"}</code></p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Cooldown (minutes)</Label>
          <Input type="number" min={1} value={cooldown} onChange={e => setCooldown(e.target.value)} />
        </div>
        <div className="space-y-1 flex items-end pb-0.5">
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>{enabled ? "Enabled" : "Disabled"}</Label>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={!name.trim() || saving}>
          {saving ? "Saving…" : "Save Rule"}
        </Button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  usePageTitle("Automation Rules")
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null)
  const [selected, setSelected] = useState<AutomationRule | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["it-automation"],
    queryFn: () => client.get<AutomationRule[]>("/it-assets/automation/rules").then(r => r.data),
  })

  const createRule = useMutation({
    mutationFn: (data: Partial<AutomationRule>) =>
      client.post("/it-assets/automation/rules", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["it-automation"] }); setDialog(null); toast.success("Rule created") },
    onError: () => toast.error("Failed to create rule"),
  })

  const updateRule = useMutation({
    mutationFn: ({ id, ...data }: Partial<AutomationRule> & { id: string }) =>
      client.put(`/it-assets/automation/rules/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["it-automation"] }); setDialog(null); toast.success("Rule updated") },
    onError: () => toast.error("Failed to update rule"),
  })

  const deleteRule = useMutation({
    mutationFn: (id: string) => client.delete(`/it-assets/automation/rules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["it-automation"] }); toast.success("Rule deleted") },
    onError: () => toast.error("Failed to delete rule"),
  })

  const toggleRule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      client.put(`/it-assets/automation/rules/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["it-automation"] }),
  })

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              Automation Rules
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Define condition → action rules that execute automatically when IT events occur
            </p>
          </div>
          <Button onClick={() => { setSelected(null); setDialog("create") }}>
            <Plus className="h-4 w-4 mr-1" />New Rule
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{rules.length}</p>
                <p className="text-sm text-muted-foreground">Total Rules</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{rules.filter(r => r.enabled).length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{rules.filter(r => r.last_triggered).length}</p>
                <p className="text-sm text-muted-foreground">Triggered</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Rules</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading…</div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No rules yet. Create your first automation rule.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell><TriggerBadge type={rule.trigger_type} /></TableCell>
                      <TableCell><ActionBadge type={rule.action_type} /></TableCell>
                      <TableCell className="text-sm">{rule.cooldown_minutes}m</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rule.last_triggered
                          ? formatDistanceToNow(new Date(rule.last_triggered), { addSuffix: true })
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={enabled => toggleRule.mutate({ id: rule.id, enabled })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setSelected(rule); setDialog("edit") }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteRule.mutate(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ── Create/Edit dialog ── */}
        <Dialog open={dialog !== null} onOpenChange={open => !open && setDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{dialog === "edit" ? "Edit Rule" : "New Automation Rule"}</DialogTitle>
            </DialogHeader>
            <RuleForm
              initial={selected ?? undefined}
              onSave={data => {
                if (dialog === "edit" && selected) {
                  updateRule.mutate({ id: selected.id, ...data })
                } else {
                  createRule.mutate(data)
                }
              }}
              onCancel={() => setDialog(null)}
              saving={createRule.isPending || updateRule.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
