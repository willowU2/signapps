"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LayoutDashboard, Plus, GripVertical, X, BarChart2, LineChartIcon, Activity } from "lucide-react"
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

type ChartType = "line" | "bar" | "area"
type MetricKey = "cpu" | "memory" | "disk" | "networkRx" | "networkTx"

interface Widget {
  id: string
  title: string
  metric: MetricKey
  chartType: ChartType
  color: string
}

interface MetricPoint {
  time: string
  cpu: number
  memory: number
  disk: number
  networkRx: number
  networkTx: number
}

const METRIC_LABELS: Record<MetricKey, string> = {
  cpu: "CPU %", memory: "Memory %", disk: "Disk %", networkRx: "Net RX (MB)", networkTx: "Net TX (MB)",
}

const CHART_ICONS: Record<ChartType, typeof LineChartIcon> = {
  line: LineChartIcon, bar: BarChart2, area: Activity,
}

const COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ef4444", "#06b6d4"]

// Mock data generator
function genData(): MetricPoint[] {
  return Array.from({ length: 20 }, (_, i) => ({
    time: `${i}s`,
    cpu: 20 + Math.random() * 50,
    memory: 40 + Math.random() * 30,
    disk: 60 + Math.random() * 10,
    networkRx: Math.random() * 10,
    networkTx: Math.random() * 5,
  }))
}

function WidgetChart({ widget, data }: { widget: Widget; data: MetricPoint[] }) {
  const common = {
    data,
    children: [
      <CartesianGrid key="grid" strokeDasharray="3 3" className="stroke-muted" />,
      <XAxis key="x" dataKey="time" tick={{ fontSize: 10 }} />,
      <YAxis key="y" tick={{ fontSize: 10 }} width={30} />,
      <Tooltip key="tip" contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 11 }} />,
    ],
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      {widget.chartType === "bar" ? (
        <BarChart {...common}>
          {common.children}
          <Bar dataKey={widget.metric} fill={widget.color} radius={[2, 2, 0, 0]} />
        </BarChart>
      ) : widget.chartType === "area" ? (
        <AreaChart {...common}>
          {common.children}
          <Area type="monotone" dataKey={widget.metric} stroke={widget.color} fill={widget.color} fillOpacity={0.2} strokeWidth={2} dot={false} />
        </AreaChart>
      ) : (
        <LineChart {...common}>
          {common.children}
          <Line type="monotone" dataKey={widget.metric} stroke={widget.color} strokeWidth={2} dot={false} />
        </LineChart>
      )}
    </ResponsiveContainer>
  )
}

export function CustomMetricDashboard() {
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: "1", title: "CPU Usage", metric: "cpu", chartType: "line", color: COLORS[0] },
    { id: "2", title: "Memory", metric: "memory", chartType: "area", color: COLORS[1] },
  ])
  const [data] = useState<MetricPoint[]>(genData())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: "", metric: "cpu" as MetricKey, chartType: "line" as ChartType, color: COLORS[0] })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const addWidget = () => {
    if (!form.title.trim()) return
    setWidgets(w => [...w, { id: Date.now().toString(), ...form }])
    setDialogOpen(false)
    setForm({ title: "", metric: "cpu", chartType: "line", color: COLORS[0] })
  }

  const removeWidget = (id: string) => setWidgets(w => w.filter(x => x.id !== id))

  const handleDragEnd = useCallback(() => {
    if (!dragging || !dragOver || dragging === dragOver) { setDragging(null); setDragOver(null); return }
    setWidgets(prev => {
      const arr = [...prev]
      const from = arr.findIndex(w => w.id === dragging)
      const to = arr.findIndex(w => w.id === dragOver)
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
    setDragging(null)
    setDragOver(null)
  }, [dragging, dragOver])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-blue-500" />
          Custom Metric Dashboard
          <Badge variant="secondary" className="ml-1">{widgets.length} widgets</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Widget
        </Button>
      </CardHeader>
      <CardContent>
        {widgets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LayoutDashboard className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No widgets yet. Add your first chart widget.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {widgets.map(widget => {
              const ChartIcon = CHART_ICONS[widget.chartType]
              return (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => setDragging(widget.id)}
                  onDragOver={e => { e.preventDefault(); setDragOver(widget.id) }}
                  onDragEnd={handleDragEnd}
                  className={`border rounded-lg p-3 bg-card transition-all ${dragOver === widget.id ? "border-primary/50 bg-primary/5" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                      <ChartIcon className="h-3.5 w-3.5" style={{ color: widget.color }} />
                      <span className="text-sm font-medium">{widget.title}</span>
                      <Badge variant="outline" className="text-xs py-0 px-1">{METRIC_LABELS[widget.metric]}</Badge>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeWidget(widget.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <WidgetChart widget={widget} data={data} />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Chart Widget</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="Widget title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Metric</Label>
              <Select value={form.metric} onValueChange={v => setForm(f => ({ ...f, metric: v as MetricKey }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(METRIC_LABELS) as [MetricKey, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chart Type</Label>
              <Select value={form.chartType} onValueChange={v => setForm(f => ({ ...f, chartType: v as ChartType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="area">Area</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`h-6 w-6 rounded-full ring-2 ${form.color === c ? "ring-primary ring-offset-2" : "ring-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={addWidget} disabled={!form.title.trim()}>Add Widget</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
