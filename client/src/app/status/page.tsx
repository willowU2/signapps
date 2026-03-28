"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity, Clock, Wifi, WifiOff } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { usePageTitle } from '@/hooks/use-page-title';

// ─── Service definitions ────────────────────────────────────────────────────

interface ServiceDef {
  name: string
  port: number
  path: string
}

const SERVICES: ServiceDef[] = [
  { name: "Identity", port: 3001, path: "/health" },
  { name: "Containers", port: 3002, path: "/health" },
  { name: "Proxy", port: 3003, path: "/health" },
  { name: "Storage", port: 3004, path: "/health" },
  { name: "AI", port: 3005, path: "/health" },
  { name: "SecureLink", port: 3006, path: "/health" },
  { name: "Scheduler", port: 3007, path: "/health" },
  { name: "Metrics", port: 3008, path: "/health" },
  { name: "Media", port: 3009, path: "/health" },
  { name: "Docs", port: 3010, path: "/health" },
  { name: "Calendar", port: 3011, path: "/health" },
  { name: "Chat", port: 3013, path: "/health" },
]

const REFRESH_INTERVAL_MS = 10_000

// ─── Types ──────────────────────────────────────────────────────────────────

type HealthStatus = "online" | "offline" | "checking"

interface ServiceHealth {
  name: string
  port: number
  status: HealthStatus
  responseTime: number | null
  lastChecked: Date | null
}

// ─── Status metadata ────────────────────────────────────────────────────────

const STATUS_META: Record<HealthStatus, {
  label: string
  icon: typeof CheckCircle
  color: string
  bg: string
  badgeClass: string
}> = {
  online: {
    label: "En ligne",
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  offline: {
    label: "Hors ligne",
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    badgeClass: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  },
  checking: {
    label: "Verification...",
    icon: RefreshCw,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
}

// ─── Health check helper ────────────────────────────────────────────────────

async function checkServiceHealth(service: ServiceDef): Promise<ServiceHealth> {
  const url = `http://localhost:${service.port}${service.path}`
  const start = performance.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { signal: controller.signal, mode: "no-cors" })
    clearTimeout(timeout)
    const elapsed = Math.round(performance.now() - start)
    return {
      name: service.name,
      port: service.port,
      status: "online",
      responseTime: elapsed,
      lastChecked: new Date(),
    }
  } catch {
    const elapsed = Math.round(performance.now() - start)
    return {
      name: service.name,
      port: service.port,
      status: "offline",
      responseTime: elapsed > 4900 ? null : elapsed,
      lastChecked: new Date(),
    }
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StatusPage() {
  usePageTitle('Statut');
  const [services, setServices] = useState<ServiceHealth[]>(
    SERVICES.map((s) => ({
      name: s.name,
      port: s.port,
      status: "checking" as HealthStatus,
      responseTime: null,
      lastChecked: null,
    }))
  )
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkAll = useCallback(async () => {
    setIsRefreshing(true)
    const results = await Promise.all(SERVICES.map(checkServiceHealth))
    setServices(results)
    setLastRefresh(new Date())
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    checkAll()
    intervalRef.current = setInterval(checkAll, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [checkAll])

  const onlineCount = services.filter((s) => s.status === "online").length
  const offlineCount = services.filter((s) => s.status === "offline").length
  const totalCount = services.length

  const overallStatus: HealthStatus =
    offlineCount === 0 && services.every((s) => s.status !== "checking")
      ? "online"
      : offlineCount === totalCount
        ? "offline"
        : services.some((s) => s.status === "checking")
          ? "checking"
          : "offline"

  const overallMeta = STATUS_META[overallStatus]
  const OverallIcon = overallMeta.icon

  const overallLabel =
    overallStatus === "online"
      ? "Tous les services sont en ligne"
      : overallStatus === "checking"
        ? "Verification en cours..."
        : offlineCount === totalCount
          ? "Tous les services sont hors ligne"
          : `${offlineCount} service${offlineCount > 1 ? "s" : ""} hors ligne`

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">SignApps Platform Status</h1>
          </div>

          <div
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full ${overallMeta.bg}`}
          >
            <OverallIcon
              className={`h-5 w-5 ${overallMeta.color} ${
                overallStatus === "checking" ? "animate-spin" : ""
              }`}
            />
            <span className={`font-semibold ${overallMeta.color}`}>{overallLabel}</span>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {format(lastRefresh, "d MMM, HH:mm:ss", { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkAll}
              disabled={isRefreshing}
              className="gap-1.5 h-7 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Rafraichir
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="border-emerald-500/20">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {onlineCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">En ligne</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/20">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {offlineCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Hors ligne</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{totalCount}</span>
              </div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Service list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Services</span>
              <Badge variant="outline" className="text-xs font-normal">
                Actualisation automatique toutes les 10s
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {services.map((service) => {
                const meta = STATUS_META[service.status]
                const Icon = meta.icon
                return (
                  <div
                    key={service.name}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          service.status === "online"
                            ? "bg-emerald-500"
                            : service.status === "offline"
                              ? "bg-red-500"
                              : "bg-muted-foreground animate-pulse"
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-sm">{service.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          :{service.port}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {service.responseTime !== null && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {service.responseTime}ms
                        </span>
                      )}
                      {service.lastChecked && (
                        <span className="text-xs text-muted-foreground hidden sm:inline tabular-nums">
                          {format(service.lastChecked, "HH:mm:ss")}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs border font-medium min-w-[80px] text-center ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Cette page est accessible publiquement &middot; Powered by SignApps Platform
        </p>
      </div>
    </div>
  )
}
