"use client"

// IDEA-265: Email read tracking dashboard — open rates per email sent

import { useState, useEffect, useCallback } from "react"
import { Eye, BarChart2, RefreshCw, ExternalLink, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { mailApi } from "@/lib/api-mail"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"

interface TrackingRecord {
  email_id: string
  subject: string
  recipient: string
  sent_at: string
  opened: boolean
  open_count: number
  first_open_at?: string
  last_open_at?: string
  clicks: number
}

interface AggregateStats {
  total_sent: number
  total_opened: number
  open_rate: number
  avg_opens_per_email: number
}

type Period = "7d" | "30d" | "90d"

export function ReadTrackingDashboard() {
  const [records, setRecords] = useState<TrackingRecord[]>([])
  const [stats, setStats] = useState<AggregateStats | null>(null)
  const [period, setPeriod] = useState<Period>("7d")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [recs, agg] = await Promise.all([
        mailApi.getTrackingRecords({ period }),
        mailApi.getTrackingStats({ period }),
      ])
      setRecords(recs)
      setStats(agg)
    } catch {
      toast.error("Failed to load tracking data")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4" /> Read Tracking
        </h2>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Sent", value: stats.total_sent, icon: <BarChart2 className="h-4 w-4" /> },
            { label: "Opened", value: stats.total_opened, icon: <Eye className="h-4 w-4" /> },
            { label: "Open Rate", value: `${stats.open_rate.toFixed(1)}%`, icon: <TrendingUp className="h-4 w-4" /> },
            { label: "Avg Opens", value: stats.avg_opens_per_email.toFixed(1), icon: <Eye className="h-4 w-4" /> },
          ].map(({ label, value, icon }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-muted-foreground">{icon}</span>
                </div>
                <p className="text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Sent Emails</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-72">
            {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
            {!loading && records.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No tracking data</p>
            )}
            {records.map(r => (
              <div key={r.email_id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/30">
                <div className={cn(
                  "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                  r.opened ? "bg-green-500" : "bg-muted-foreground"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">{r.recipient}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Sent {formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })}
                    </span>
                    {r.opened && r.first_open_at && (
                      <span className="text-xs text-green-600">
                        Opened {formatDistanceToNow(new Date(r.first_open_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {r.open_count > 0 && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={Math.min(r.open_count * 20, 100)} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">{r.open_count}x</span>
                    </div>
                  )}
                </div>
                <Badge variant={r.opened ? "default" : "secondary"} className="text-xs flex-shrink-0">
                  {r.opened ? "Read" : "Unread"}
                </Badge>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
