"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Target, Plus, Flame, AlertTriangle, CheckCircle, Trash2 } from "lucide-react"

interface SLO {
  id: string
  name: string
  sli_description: string
  target_percent: number
  current_percent: number
  window_days: number
}

function calcErrorBudget(slo: SLO) {
  const totalMinutes = slo.window_days * 24 * 60
  const budgetMinutes = totalMinutes * (1 - slo.target_percent / 100)
  const consumedMinutes = totalMinutes * Math.max(0, (slo.target_percent - slo.current_percent) / 100)
  const remaining = Math.max(0, budgetMinutes - consumedMinutes)
  const remainingPct = budgetMinutes > 0 ? (remaining / budgetMinutes) * 100 : 0
  const burnRate = budgetMinutes > 0 ? consumedMinutes / budgetMinutes : 0
  return { budgetMinutes, consumedMinutes, remaining, remainingPct, burnRate }
}

export function SloTracker() {
  const [slos, setSlos] = useState<SLO[]>([
    { id: "1", name: "API Availability", sli_description: "HTTP 5xx rate < 0.1%", target_percent: 99.9, current_percent: 99.95, window_days: 30 },
    { id: "2", name: "Latency p99 < 200ms", sli_description: "p99 request latency", target_percent: 99.0, current_percent: 97.5, window_days: 7 },
  ])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: "", sli_description: "", target_percent: "99.9", current_percent: "100", window_days: "30" })

  const handleAdd = () => {
    if (!form.name.trim()) return
    setSlos(s => [...s, {
      id: Date.now().toString(),
      name: form.name,
      sli_description: form.sli_description,
      target_percent: parseFloat(form.target_percent) || 99,
      current_percent: parseFloat(form.current_percent) || 100,
      window_days: parseInt(form.window_days) || 30,
    }])
    setForm({ name: "", sli_description: "", target_percent: "99.9", current_percent: "100", window_days: "30" })
    setDialogOpen(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-indigo-500" />
            SLO Tracking &amp; Error Budget
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">Service Level Objectives with burn rate monitoring</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add SLO
        </Button>
      </CardHeader>
      <CardContent>
        {slos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No SLOs defined</p>
          </div>
        ) : (
          <div className="space-y-4">
            {slos.map(slo => {
              const eb = calcErrorBudget(slo)
              const passing = slo.current_percent >= slo.target_percent
              const critical = eb.remainingPct < 10
              return (
                <div key={slo.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {passing ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-red-500" />}
                        <span className="font-medium text-sm">{slo.name}</span>
                        <Badge className={passing ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}>
                          {passing ? "Met" : "Breached"}
                        </Badge>
                      </div>
                      {slo.sli_description && <p className="text-xs text-muted-foreground ml-6 mt-0.5">{slo.sli_description}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSlos(s => s.filter(x => x.id !== slo.id))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-sm font-bold">{slo.current_percent.toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">Current SLI</p>
                    </div>
                    <div className="rounded bg-muted/50 p-2">
                      <p className="text-sm font-bold">{slo.target_percent}%</p>
                      <p className="text-xs text-muted-foreground">Target SLO</p>
                    </div>
                    <div className={`rounded p-2 ${critical ? "bg-red-500/10" : "bg-muted/50"}`}>
                      <div className="flex items-center justify-center gap-1">
                        {critical && <Flame className="h-3 w-3 text-red-500" />}
                        <p className={`text-sm font-bold ${critical ? "text-red-600" : ""}`}>{eb.remainingPct.toFixed(0)}%</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Budget Left</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Error Budget ({slo.window_days}d window)</span>
                      <span>{eb.remaining.toFixed(0)} / {eb.budgetMinutes.toFixed(0)} min remaining</span>
                    </div>
                    <Progress value={eb.remainingPct} className={`h-2 ${critical ? "[&>div]:bg-red-500" : "[&>div]:bg-indigo-500"}`} />
                    {eb.burnRate > 1 && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        Burn rate: {eb.burnRate.toFixed(1)}x — budget will be exhausted early
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add SLO</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>SLO Name *</Label>
              <Input placeholder="e.g. API Availability" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>SLI Description</Label>
              <Input placeholder="e.g. HTTP 2xx rate" value={form.sli_description} onChange={e => setForm(f => ({ ...f, sli_description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Target %</Label>
                <Input type="number" min="0" max="100" step="0.01" value={form.target_percent} onChange={e => setForm(f => ({ ...f, target_percent: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Current %</Label>
                <Input type="number" min="0" max="100" step="0.01" value={form.current_percent} onChange={e => setForm(f => ({ ...f, current_percent: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Window (d)</Label>
                <Input type="number" min="1" value={form.window_days} onChange={e => setForm(f => ({ ...f, window_days: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.name.trim()}>Add SLO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
