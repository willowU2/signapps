"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Mail, Send, CheckCircle, Clock, Calendar } from "lucide-react"
import { toast } from "sonner"
import { format, addDays } from "date-fns"

interface ReportConfig {
  enabled: boolean
  recipients: string
  sendDay: number
  includeAlerts: boolean
  includeTrends: boolean
  includeUptime: boolean
}

export function WeeklyMetricsReport() {
  const [config, setConfig] = useState<ReportConfig>({
    enabled: false,
    recipients: "",
    sendDay: 1,
    includeAlerts: true,
    includeTrends: true,
    includeUptime: true,
  })
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)

  const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  const nextSendDate = () => {
    const now = new Date()
    let d = new Date(now)
    while (d.getDay() !== config.sendDay) d = addDays(d, 1)
    return format(d, "EEE, MMM d")
  }

  const handleSendNow = async () => {
    if (!config.recipients.trim()) { toast.error("Add at least one recipient"); return }
    setSending(true)
    // Simulate API call
    await new Promise(r => setTimeout(r, 1200))
    setSending(false)
    setLastSent(new Date().toISOString())
    toast.success(`Weekly report sent to ${config.recipients.split(",").length} recipient(s)`)
  }

  const toggle = (field: keyof ReportConfig) =>
    setConfig(c => ({ ...c, [field]: !c[field] }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              Weekly Metrics Report
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Auto-email summary every week</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{config.enabled ? "On" : "Off"}</span>
            <Switch checked={config.enabled} onCheckedChange={() => toggle("enabled")} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Recipients (comma-separated)</Label>
          <Input
            placeholder="admin@company.com, ops@company.com"
            value={config.recipients}
            onChange={e => setConfig(c => ({ ...c, recipients: e.target.value }))}
            className="text-sm h-8"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Send on</Label>
          <select className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={config.sendDay} onChange={e => setConfig(c => ({ ...c, sendDay: parseInt(e.target.value) }))}>
            {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Include in report</Label>
          {[
            { key: "includeAlerts" as const, label: "Active alerts summary" },
            { key: "includeTrends" as const, label: "30-day metric trends" },
            { key: "includeUptime" as const, label: "Uptime & SLO status" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <Switch checked={config[key] as boolean} onCheckedChange={() => toggle(key)} />
            </div>
          ))}
        </div>

        {config.enabled && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Next send: <span className="font-medium">{nextSendDate()}</span></span>
          </div>
        )}

        {lastSent && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-lg p-2">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Last sent: {format(new Date(lastSent), "MMM d, HH:mm")}</span>
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleSendNow}
          disabled={sending || !config.recipients.trim()}
        >
          {sending ? (
            <><Clock className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending…</>
          ) : (
            <><Send className="h-3.5 w-3.5 mr-1.5" />Send Now</>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
