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
import { Activity, Plus, Trash2, CheckCircle2, XCircle, Clock, Globe, Server, FileText, Cpu } from "lucide-react"
import { usePageTitle } from "@/hooks/use-page-title"
import { getClient, ServiceName } from "@/lib/api/factory"

// ─── Types ────────────────────────────────────────────────────────────────────

type MonitorType = "http_check" | "port_check" | "service_check" | "file_check" | "process_check"
type MonitorStatus = "ok" | "fail" | "unknown"
type Interval = 1 | 5 | 15 | 60

interface CustomMonitor {
  id: string
  name: string
  type: MonitorType
  // http
  url?: string
  expected_status_code?: number
  response_contains?: string
  // port
  host?: string
  port?: number
  // service / process / file
  service_name?: string
  file_path?: string
  process_name?: string
  interval_minutes: Interval
  enabled: boolean
  last_checked_at?: string
  last_status?: MonitorStatus
  last_error?: string
  consecutive_failures: number
  alert_on_failure: boolean
  alert_threshold: number
}

interface CreateMonitorRequest {
  name: string
  type: MonitorType
  url?: string
  expected_status_code?: number
  response_contains?: string
  host?: string
  port?: number
  service_name?: string
  file_path?: string
  process_name?: string
  interval_minutes: Interval
  alert_on_failure: boolean
  alert_threshold: number
}

// ─── API ──────────────────────────────────────────────────────────────────────

const client = getClient(ServiceName.IT_ASSETS)

const monitorsApi = {
  list:   ()                          => client.get<CustomMonitor[]>("/it-assets/monitors"),
  create: (data: CreateMonitorRequest) => client.post<CustomMonitor>("/it-assets/monitors", data),
  delete: (id: string)                => client.delete(`/it-assets/monitors/${id}`),
  toggle: (id: string, enabled: boolean) => client.patch<CustomMonitor>(`/it-assets/monitors/${id}`, { enabled }),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<MonitorType, React.ReactNode> = {
  http_check:    <Globe    className="h-4 w-4 text-blue-500" />,
  port_check:    <Server   className="h-4 w-4 text-purple-500" />,
  service_check: <Cpu      className="h-4 w-4 text-orange-500" />,
  file_check:    <FileText className="h-4 w-4 text-yellow-500" />,
  process_check: <Activity className="h-4 w-4 text-cyan-500" />,
}

const TYPE_LABELS: Record<MonitorType, string> = {
  http_check:    "HTTP Check",
  port_check:    "Port Check",
  service_check: "Service Check",
  file_check:    "File Check",
  process_check: "Process Check",
}

function StatusBadge({ status }: { status?: MonitorStatus }) {
  if (!status || status === "unknown") return <Badge variant="outline">Unknown</Badge>
  if (status === "ok")   return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />OK</Badge>
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Fail</Badge>
}

function fmtTime(iso?: string) {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

// ─── Monitor Form ─────────────────────────────────────────────────────────────

const BLANK: CreateMonitorRequest = {
  name: "", type: "http_check", interval_minutes: 5, alert_on_failure: true, alert_threshold: 1,
}

function MonitorForm({ onSave, onClose }: { onSave: (data: CreateMonitorRequest) => void; onClose: () => void }) {
  const [form, setForm] = useState<CreateMonitorRequest>({ ...BLANK })
  const set = <K extends keyof CreateMonitorRequest>(k: K, v: CreateMonitorRequest[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  function submit() {
    if (!form.name) return
    onSave(form)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Custom Monitor</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input className="mt-1" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Homepage health" />
          </div>

          <div>
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => set("type", v as MonitorType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as MonitorType[]).map(t => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">{TYPE_ICONS[t]}{TYPE_LABELS[t]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type-specific config */}
          {form.type === "http_check" && (
            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <div><Label className="text-xs">URL</Label><Input className="mt-1" value={form.url ?? ""} onChange={e => set("url", e.target.value)} placeholder="https://example.com/health" /></div>
              <div><Label className="text-xs">Expected status code</Label><Input className="mt-1" type="number" value={form.expected_status_code ?? 200} onChange={e => set("expected_status_code", Number(e.target.value))} /></div>
              <div><Label className="text-xs">Response must contain (optional)</Label><Input className="mt-1" value={form.response_contains ?? ""} onChange={e => set("response_contains", e.target.value)} placeholder='"status":"ok"' /></div>
            </div>
          )}

          {form.type === "port_check" && (
            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <div><Label className="text-xs">Host</Label><Input className="mt-1" value={form.host ?? ""} onChange={e => set("host", e.target.value)} placeholder="192.168.1.10" /></div>
              <div><Label className="text-xs">Port</Label><Input className="mt-1" type="number" value={form.port ?? ""} onChange={e => set("port", Number(e.target.value))} placeholder="443" /></div>
            </div>
          )}

          {form.type === "service_check" && (
            <div className="rounded-md border p-3 bg-muted/30">
              <Label className="text-xs">Service name</Label><Input className="mt-1" value={form.service_name ?? ""} onChange={e => set("service_name", e.target.value)} placeholder="postgresql" />
            </div>
          )}

          {form.type === "file_check" && (
            <div className="rounded-md border p-3 bg-muted/30">
              <Label className="text-xs">File path</Label><Input className="mt-1" value={form.file_path ?? ""} onChange={e => set("file_path", e.target.value)} placeholder="/var/run/app.pid" />
            </div>
          )}

          {form.type === "process_check" && (
            <div className="rounded-md border p-3 bg-muted/30">
              <Label className="text-xs">Process name</Label><Input className="mt-1" value={form.process_name ?? ""} onChange={e => set("process_name", e.target.value)} placeholder="nginx" />
            </div>
          )}

          {/* Schedule */}
          <div>
            <Label>Check every</Label>
            <Select value={String(form.interval_minutes)} onValueChange={v => set("interval_minutes", Number(v) as Interval)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 minute</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alert */}
          <div className="flex items-center gap-3">
            <Switch checked={form.alert_on_failure} onCheckedChange={v => set("alert_on_failure", v)} />
            <Label>Alert on failure</Label>
            {form.alert_on_failure && (
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">after</Label>
                <Input className="w-16 h-7 text-xs" type="number" min={1} max={10} value={form.alert_threshold} onChange={e => set("alert_threshold", Number(e.target.value))} />
                <Label className="text-xs whitespace-nowrap">failure(s)</Label>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Create Monitor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomMonitorsPage() {
  usePageTitle("Custom Monitors")
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: monitors = [], isLoading } = useQuery<CustomMonitor[]>({
    queryKey: ["custom-monitors"],
    queryFn: () => monitorsApi.list().then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateMonitorRequest) => monitorsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-monitors"] }); setShowForm(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => monitorsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-monitors"] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => monitorsApi.toggle(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-monitors"] }),
  })

  const stats = { total: monitors.length, ok: monitors.filter(m => m.last_status === "ok").length, fail: monitors.filter(m => m.last_status === "fail").length }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Custom Monitors
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Define and schedule custom health checks for any endpoint or service</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Monitor
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total monitors</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-emerald-600">{stats.ok}</p><p className="text-xs text-muted-foreground">Passing</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-2xl font-bold text-destructive">{stats.fail}</p><p className="text-xs text-muted-foreground">Failing</p></CardContent></Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading monitors…</p>
            ) : monitors.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Activity className="h-10 w-10 opacity-20 mx-auto mb-2" />
                <p className="text-sm">No monitors yet. Create one to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last check</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitors.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">{TYPE_ICONS[m.type]}{TYPE_LABELS[m.type]}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {m.url ?? m.host ?? m.service_name ?? m.file_path ?? m.process_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.interval_minutes}m</span>
                      </TableCell>
                      <TableCell><StatusBadge status={m.last_status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtTime(m.last_checked_at)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={m.enabled}
                          onCheckedChange={v => toggleMutation.mutate({ id: m.id, enabled: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <MonitorForm onSave={data => createMutation.mutate(data)} onClose={() => setShowForm(false)} />
      )}
    </AppLayout>
  )
}
