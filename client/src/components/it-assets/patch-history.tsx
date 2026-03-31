"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, XCircle, Clock, Filter, ShieldCheck, ShieldAlert, Shield, Info } from "lucide-react"
import { itAssetsApi, Patch } from "@/lib/api/it-assets"

// ─── Types ────────────────────────────────────────────────────────────────────

type SeverityFilter = "all" | "critical" | "important" | "moderate" | "low" | "unknown"
type StatusFilter   = "all" | "installed" | "deployed" | "failed" | "pending" | "rejected"

// ─── Severity helpers ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity?: Patch["severity"] }) {
  const map: Record<NonNullable<Patch["severity"]>, { label: string; className: string; icon: React.ReactNode }> = {
    critical:  { label: "Critical",  className: "bg-red-100 text-red-800 border-red-200",         icon: <ShieldAlert className="h-3 w-3" /> },
    important: { label: "Important", className: "bg-orange-100 text-orange-800 border-orange-200", icon: <Shield      className="h-3 w-3" /> },
    moderate:  { label: "Moderate",  className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Shield      className="h-3 w-3" /> },
    low:       { label: "Low",       className: "bg-blue-100 text-blue-800 border-blue-200",       icon: <Info        className="h-3 w-3" /> },
    unknown:   { label: "Unknown",   className: "bg-gray-100 text-gray-600 border-gray-200",       icon: <Info        className="h-3 w-3" /> },
  }
  const cfg = severity ? map[severity] : map.unknown
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function StatusIcon({ status }: { status: Patch["status"] }) {
  if (status === "installed" || status === "deployed") return <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
  if (status === "rejected")                           return <XCircle      className="h-4 w-4 text-destructive flex-shrink-0" />
  return <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
}

function statusLabel(status: Patch["status"]): string {
  const map: Record<Patch["status"], string> = {
    installed: "Installed",
    deployed:  "Deployed",
    pending:   "Pending",
    approved:  "Approved",
    rejected:  "Rejected",
  }
  return map[status] ?? status
}

function patchDate(patch: Patch): string {
  const d = patch.installed_at ?? patch.deployed_at ?? patch.approved_at ?? patch.detected_at
  return new Date(d).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
}

// ─── Timeline Item ────────────────────────────────────────────────────────────

function TimelineItem({ patch, isLast }: { patch: Patch; isLast: boolean }) {
  const appliedBy = patch.status === "installed" ? "Agent (auto)" : patch.status === "deployed" ? "Admin" : undefined
  return (
    <div className="flex gap-3">
      {/* Stem */}
      <div className="flex flex-col items-center">
        <StatusIcon status={patch.status} />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className={`pb-4 flex-1 ${isLast ? "" : ""}`}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-medium leading-tight">{patch.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {patch.kb_number && (
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {patch.kb_number}
                </span>
              )}
              <SeverityBadge severity={patch.severity} />
              <Badge variant={patch.status === "installed" || patch.status === "deployed" ? "default" : patch.status === "rejected" ? "destructive" : "secondary"} className="text-xs">
                {statusLabel(patch.status)}
              </Badge>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground flex-shrink-0">
            <p>{patchDate(patch)}</p>
            {appliedBy && <p className="mt-0.5">{appliedBy}</p>}
          </div>
        </div>
        {patch.category && (
          <p className="text-xs text-muted-foreground mt-1">{patch.category}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PatchHistoryProps {
  hardwareId: string
}

export function PatchHistory({ hardwareId }: PatchHistoryProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all")
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>("all")

  const { data: allPatches = [], isLoading } = useQuery<Patch[]>({
    queryKey: ["patches-all"],
    queryFn: () => itAssetsApi.listPatches().then(r => r.data),
  })

  // Filter to this device, then apply user filters
  const devicePatches = allPatches.filter(p => p.hardware_id === hardwareId)

  const filtered = devicePatches.filter(p => {
    if (severityFilter !== "all" && p.severity !== severityFilter) return false
    if (statusFilter   !== "all") {
      if (statusFilter === "failed") return p.status === "rejected"
      if (p.status !== statusFilter) return false
    }
    return true
  })

  // Sort newest first
  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.installed_at ?? a.deployed_at ?? a.detected_at).getTime()
    const db = new Date(b.installed_at ?? b.deployed_at ?? b.detected_at).getTime()
    return db - da
  })

  const stats = {
    total:     devicePatches.length,
    installed: devicePatches.filter(p => p.status === "installed" || p.status === "deployed").length,
    failed:    devicePatches.filter(p => p.status === "rejected").length,
    pending:   devicePatches.filter(p => p.status === "pending" || p.status === "approved").length,
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Patch History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as SeverityFilter)}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="deployed">Deployed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed/Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex gap-3 mt-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{stats.total} total</span>
          <span className="text-xs text-emerald-600 font-medium">{stats.installed} applied</span>
          <span className="text-xs text-destructive font-medium">{stats.failed} failed</span>
          <span className="text-xs text-yellow-600 font-medium">{stats.pending} pending</span>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading patches…</p>
        ) : sorted.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <ShieldCheck className="h-8 w-8 mx-auto opacity-20 mb-2" />
            {devicePatches.length === 0 ? "No patch history for this device." : "No patches match the current filters."}
          </div>
        ) : (
          <div className="pt-1">
            {sorted.map((patch, i) => (
              <TimelineItem key={patch.id} patch={patch} isLast={i === sorted.length - 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
