"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Globe, Plus, Trash2, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"

interface Monitor {
  id: string
  url: string
  expected_status: number
  checks: Check[]
}

interface Check {
  ts: number
  status: number | null
  ok: boolean
  latency_ms: number
}

function calcUptime(checks: Check[], windowHours: number): number {
  const cutoff = Date.now() - windowHours * 3600_000
  const recent = checks.filter(c => c.ts >= cutoff)
  if (recent.length === 0) return 100
  return (recent.filter(c => c.ok).length / recent.length) * 100
}

function UptimePill({ pct }: { pct: number }) {
  const color = pct >= 99 ? "bg-emerald-500" : pct >= 95 ? "bg-yellow-500" : "bg-red-500"
  return (
    <span className={`text-xs font-semibold text-white px-2 py-0.5 rounded-full ${color}`}>
      {pct.toFixed(1)}%
    </span>
  )
}

const CHECK_INTERVAL_MS = 60_000

export function UptimeChecker() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [url, setUrl] = useState("")
  const [expected, setExpected] = useState(200)
  const [checking, setChecking] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addMonitor = () => {
    if (!url.trim()) return
    const id = crypto.randomUUID()
    setMonitors(prev => [...prev, { id, url: url.trim(), expected_status: expected, checks: [] }])
    setUrl("")
    setExpected(200)
  }

  const removeMonitor = (id: string) => {
    setMonitors(prev => prev.filter(m => m.id !== id))
  }

  const checkOne = async (monitor: Monitor): Promise<Check> => {
    const start = performance.now()
    try {
      // Use a no-cors request; we can only detect success/failure for same-origin
      // For MVP: use a fetch with no-cors mode and infer from opaque response
      const resp = await fetch(monitor.url, {
        method: "HEAD",
        mode: "no-cors",
        signal: AbortSignal.timeout(10000),
      })
      const latency = Math.round(performance.now() - start)
      // With no-cors, resp.type = 'opaque', status = 0 — treat 0 as success
      const ok = resp.type === "opaque" || resp.ok
      return { ts: Date.now(), status: resp.status || null, ok, latency_ms: latency }
    } catch {
      const latency = Math.round(performance.now() - start)
      return { ts: Date.now(), status: null, ok: false, latency_ms: latency }
    }
  }

  const runChecks = async () => {
    for (const m of monitors) {
      setChecking(m.id)
      const check = await checkOne(m)
      setMonitors(prev =>
        prev.map(mon =>
          mon.id === m.id
            ? { ...mon, checks: [...mon.checks.slice(-1440), check] } // keep 24h of 1-min checks
            : mon
        )
      )
    }
    setChecking(null)
  }

  useEffect(() => {
    if (monitors.length === 0) return
    runChecks()
    intervalRef.current = setInterval(runChecks, CHECK_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitors.length])

  return (
    <div className="space-y-4">
      {/* Add monitor form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> HTTP Uptime Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-48">
              <Label className="sr-only">URL</Label>
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={e => e.key === "Enter" && addMonitor()}
              />
            </div>
            <div>
              <Label className="sr-only">Expected status</Label>
              <Input
                type="number"
                value={expected}
                onChange={e => setExpected(Number(e.target.value))}
                className="w-24"
                placeholder="200"
              />
            </div>
            <Button onClick={addMonitor} disabled={!url.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monitor list */}
      {monitors.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">No monitors yet. Add a URL above.</div>
      ) : (
        <div className="space-y-3">
          {monitors.map(m => {
            const lastCheck = m.checks.at(-1)
            const isUp = lastCheck?.ok ?? null
            const up24 = calcUptime(m.checks, 24)
            const up7d = calcUptime(m.checks, 168)
            const up30d = calcUptime(m.checks, 720)
            const isChecking = checking === m.id

            return (
              <Card key={m.id} className={`border ${isUp === false ? "border-destructive/30" : ""}`}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {isChecking ? (
                        <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                      ) : isUp === null ? (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      ) : isUp ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>

                    {/* URL */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.url}</p>
                      {lastCheck && (
                        <p className="text-xs text-muted-foreground">
                          Last: {new Date(lastCheck.ts).toLocaleTimeString()} — {lastCheck.latency_ms}ms
                          {lastCheck.status ? ` — HTTP ${lastCheck.status}` : ""}
                        </p>
                      )}
                    </div>

                    {/* Uptime pills */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">24h</span>
                      <UptimePill pct={up24} />
                      <span className="text-xs text-muted-foreground">7d</span>
                      <UptimePill pct={up7d} />
                      <span className="text-xs text-muted-foreground">30d</span>
                      <UptimePill pct={up30d} />
                    </div>

                    <Button
                      variant="ghost" size="icon"
                      onClick={() => removeMonitor(m.id)}
                      className="h-7 w-7 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Mini history bar */}
                  {m.checks.length > 0 && (
                    <div className="mt-2 flex gap-px h-4 overflow-hidden rounded">
                      {m.checks.slice(-60).map((c, i) => (
                        <div
                          key={i}
                          className={`flex-1 ${c.ok ? "bg-emerald-400" : "bg-red-400"}`}
                          title={`${new Date(c.ts).toLocaleTimeString()} — ${c.ok ? "up" : "down"}`}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
