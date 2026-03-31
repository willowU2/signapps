"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MonitorSmartphone, Wifi, WifiOff, StopCircle, RefreshCw, Eye, MousePointer, EyeOff } from "lucide-react"
import { getClient, ServiceName } from "@/lib/api/factory"

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionMode = "observe" | "share" | "control"

interface ActiveSession {
  session_id: string
  hardware_id: string
  device_name: string
  admin_name: string
  mode: SessionMode
  started_at: string
  status: "active" | "connecting"
}

// ─── API ──────────────────────────────────────────────────────────────────────

const client = getClient(ServiceName.IT_ASSETS)

const sessionsApi = {
  listActive: () => client.get<ActiveSession[]>("/it-assets/remote-sessions/active"),
  disconnect: (sessionId: string) =>
    client.post(`/it-assets/remote-sessions/${sessionId}/disconnect`, {}),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string): string {
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

const MODE_ICONS: Record<SessionMode, React.ReactNode> = {
  observe: <Eye          className="h-3.5 w-3.5" />,
  share:   <EyeOff       className="h-3.5 w-3.5" />,
  control: <MousePointer className="h-3.5 w-3.5" />,
}

const MODE_LABELS: Record<SessionMode, string> = {
  observe: "Observe",
  share:   "Share",
  control: "Control",
}

function ModeBadge({ mode }: { mode: SessionMode }) {
  const variants: Record<SessionMode, "secondary" | "default" | "destructive"> = {
    observe: "secondary",
    share:   "default",
    control: "destructive",
  }
  return (
    <Badge variant={variants[mode]} className="gap-1 text-xs">
      {MODE_ICONS[mode]}{MODE_LABELS[mode]}
    </Badge>
  )
}

// ─── Duration ticker ─────────────────────────────────────────────────────────

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [dur, setDur] = useState(formatDuration(startedAt))
  useEffect(() => {
    const t = setInterval(() => setDur(formatDuration(startedAt)), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  return <span className="font-mono text-xs">{dur}</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActiveSessions() {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  async function fetchSessions() {
    try {
      const resp = await sessionsApi.listActive()
      setSessions(resp.data)
    } catch {
      // If endpoint not yet available, show empty state
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  // Initial load + auto-refresh every 5s
  useEffect(() => {
    fetchSessions()
    const t = setInterval(fetchSessions, 5000)
    return () => clearInterval(t)
  }, [])

  async function disconnect(sessionId: string) {
    setDisconnecting(sessionId)
    try {
      await sessionsApi.disconnect(sessionId)
      setSessions(prev => prev.filter(s => s.session_id !== sessionId))
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-primary" />
            Active Remote Sessions
            {sessions.length > 0 && (
              <Badge variant="destructive" className="text-xs">{sessions.length} active</Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchSessions} className="h-7 w-7 p-0" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <WifiOff className="h-8 w-8 opacity-20" />
            <p>No active remote sessions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map(s => (
                <TableRow key={s.session_id}>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium text-sm">
                      <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      {s.device_name}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{s.admin_name}</TableCell>
                  <TableCell><ModeBadge mode={s.mode} /></TableCell>
                  <TableCell><LiveDuration startedAt={s.started_at} /></TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs gap-1"
                      disabled={disconnecting === s.session_id}
                      onClick={() => disconnect(s.session_id)}
                    >
                      <StopCircle className="h-3 w-3" />
                      Disconnect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground px-4 py-2 border-t">Auto-refreshes every 5s</p>
      </CardContent>
    </Card>
  )
}
