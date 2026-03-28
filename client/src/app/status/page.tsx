"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity } from "lucide-react"
import { format } from "date-fns"

interface ServiceStatus {
  name: string
  status: "operational" | "degraded" | "outage"
  uptime: number
  latency?: number
  last_incident?: string
}

const MOCK_SERVICES: ServiceStatus[] = [
  { name: "Identity Service",  status: "operational", uptime: 99.98, latency: 45  },
  { name: "Mail Service",      status: "operational", uptime: 99.95, latency: 120 },
  { name: "Drive / Storage",   status: "operational", uptime: 99.9,  latency: 80  },
  { name: "Meet / Video",      status: "degraded",    uptime: 98.5,  latency: 280, last_incident: "2026-03-27T14:30:00Z" },
  { name: "Media Processing",  status: "operational", uptime: 99.7,  latency: 200 },
  { name: "Metrics Service",   status: "operational", uptime: 100,   latency: 15  },
  { name: "Scheduler",         status: "operational", uptime: 99.99, latency: 30  },
  { name: "AI / Whisper",      status: "operational", uptime: 99.2,  latency: 500 },
]

const HISTORY_DAYS = 90

function UptimeBar({ uptime }: { uptime: number }) {
  const bars = Array.from({ length: 30 }, (_, i) => {
    const r = Math.random()
    if (uptime >= 99.9) return r > 0.002 ? "bg-emerald-500" : "bg-red-400"
    if (uptime >= 99.5) return r > 0.01 ? "bg-emerald-500" : r > 0.005 ? "bg-yellow-400" : "bg-red-400"
    return r > 0.05 ? "bg-emerald-500" : r > 0.02 ? "bg-yellow-400" : "bg-red-400"
  })
  return (
    <div className="flex gap-px">
      {bars.map((c, i) => <div key={i} className={`h-5 w-2 rounded-sm ${c}`} />)}
    </div>
  )
}

const STATUS_META = {
  operational: { label: "Operational", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/10", badgeColor: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  degraded:    { label: "Degraded",    icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-500/10", badgeColor: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
  outage:      { label: "Outage",      icon: XCircle, color: "text-red-600", bg: "bg-red-500/10", badgeColor: "bg-red-500/10 text-red-700 border-red-500/20" },
}

export default function StatusPage() {
  const [services] = useState<ServiceStatus[]>(MOCK_SERVICES)
  const [updated, setUpdated] = useState(new Date())

  const overall = services.every(s => s.status === "operational") ? "operational"
    : services.some(s => s.status === "outage") ? "outage" : "degraded"

  const overallMeta = STATUS_META[overall]
  const OverallIcon = overallMeta.icon

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">SignApps Platform Status</h1>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${overallMeta.bg}`}>
            <OverallIcon className={`h-5 w-5 ${overallMeta.color}`} />
            <span className={`font-semibold ${overallMeta.color}`}>
              {overall === "operational" ? "All systems operational" : overall === "degraded" ? "Some systems degraded" : "Service outage"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Updated {format(updated, "MMM d, HH:mm")}
          </p>
        </div>

        {/* Services */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {services.map(service => {
                const meta = STATUS_META[service.status]
                const Icon = meta.icon
                return (
                  <div key={service.name} className="py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color} shrink-0`} />
                        <span className="font-medium text-sm">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {service.latency && (
                          <span className="text-xs text-muted-foreground">{service.latency}ms</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${meta.badgeColor}`}>{meta.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <UptimeBar uptime={service.uptime} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{service.uptime}% uptime</span>
                    </div>
                    {service.last_incident && (
                      <p className="text-xs text-muted-foreground pl-6">
                        Last incident: {format(new Date(service.last_incident), "MMM d, HH:mm")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Past incidents */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Past 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No major incidents in the past 30 days</p>
              <p className="text-xs text-muted-foreground mt-1">Minor degradation on Meet service on Mar 27</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          This page is publicly accessible · Powered by SignApps Platform
        </p>
      </div>
    </div>
  )
}
