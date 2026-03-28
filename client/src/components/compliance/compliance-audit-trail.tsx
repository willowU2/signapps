"use client"

// IDEA-283: Compliance audit trail — immutable log of compliance actions

import { useState, useEffect, useCallback } from "react"
import { Shield, RefreshCw, Download, Search, Filter, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { format } from "date-fns"

type AuditCategory =
  | "consent"
  | "dsar"
  | "retention"
  | "data_breach"
  | "dpia"
  | "policy"
  | "access_control"
  | "data_export"

interface AuditEntry {
  id: string
  timestamp: string
  category: AuditCategory
  action: string
  actor_email: string
  actor_name: string
  subject?: string
  details: Record<string, string>
  ip_address?: string
  hash: string      // SHA-256 integrity hash
  prev_hash: string // chain integrity
}

const CATEGORY_CONFIG: Record<AuditCategory, { label: string; color: string }> = {
  consent: { label: "Consent", color: "bg-blue-500" },
  dsar: { label: "DSAR", color: "bg-purple-500" },
  retention: { label: "Retention", color: "bg-orange-500" },
  data_breach: { label: "Data Breach", color: "bg-red-600" },
  dpia: { label: "DPIA", color: "bg-indigo-500" },
  policy: { label: "Policy", color: "bg-teal-500" },
  access_control: { label: "Access Control", color: "bg-yellow-500" },
  data_export: { label: "Data Export", color: "bg-green-500" },
}

export function ComplianceAuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<AuditCategory | "all">("all")
  const [verifying, setVerifying] = useState(false)
  const [integrityOk, setIntegrityOk] = useState<boolean | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (search) params.set("search", search)
      if (category !== "all") params.set("category", category)
      const res = await fetch(`/api/compliance/audit-trail?${params}`)
      const data = await res.json()
      setEntries(data.data ?? [])
      setTotalPages(Math.ceil((data.total ?? 0) / 50))
    } catch {
      toast.error("Failed to load audit trail")
    } finally {
      setLoading(false)
    }
  }, [search, category, page])

  useEffect(() => { load() }, [load])

  async function verifyIntegrity() {
    setVerifying(true)
    try {
      const res = await fetch("/api/compliance/audit-trail/verify", { method: "POST" })
      const data = await res.json()
      setIntegrityOk(data.valid)
      if (data.valid) toast.success("Audit trail integrity verified")
      else toast.error(`Integrity check failed at entry ${data.failed_at}`)
    } catch {
      toast.error("Verification failed")
    } finally {
      setVerifying(false)
    }
  }

  async function exportAuditLog() {
    try {
      const params = new URLSearchParams()
      if (category !== "all") params.set("category", category)
      const res = await fetch(`/api/compliance/audit-trail/export?${params}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit_trail_${format(new Date(), "yyyy-MM-dd")}.csv`
      a.click()
      toast.success("Audit log exported")
    } catch {
      toast.error("Export failed")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <h2 className="font-semibold text-sm">Compliance Audit Trail</h2>
          <div className="flex items-center gap-1 ml-1">
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Immutable</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={verifyIntegrity}
            disabled={verifying}
            className={cn(
              integrityOk === true && "border-green-500 text-green-600",
              integrityOk === false && "border-destructive text-destructive"
            )}
          >
            <Shield className="h-3.5 w-3.5 mr-1" />
            {verifying ? "Verifying…" : integrityOk === true ? "Verified" : "Verify Integrity"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportAuditLog}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
          <Button size="icon" variant="ghost" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search actions, actors…"
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={category} onValueChange={v => setCategory(v as AuditCategory | "all")}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(CATEGORY_CONFIG) as AuditCategory[]).map(c => (
              <SelectItem key={c} value={c}>{CATEGORY_CONFIG[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[420px]">
            {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
            {!loading && entries.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No audit entries</p>
            )}
            {entries.map((entry, idx) => (
              <div key={entry.id} className="px-4 py-3 border-b last:border-0 hover:bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={cn("h-2 w-2 rounded-full flex-shrink-0 mt-1.5", CATEGORY_CONFIG[entry.category].color)} />
                    <Badge variant="outline" className="text-xs">{CATEGORY_CONFIG[entry.category].label}</Badge>
                    <span className="text-sm">{entry.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {format(new Date(entry.timestamp), "MMM d, HH:mm:ss")}
                  </span>
                </div>
                <div className="mt-1 pl-4 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{entry.actor_name} · {entry.actor_email}</span>
                  {entry.subject && <span className="text-xs text-muted-foreground">re: {entry.subject}</span>}
                  {entry.ip_address && <span className="text-xs text-muted-foreground font-mono">{entry.ip_address}</span>}
                </div>
                {Object.keys(entry.details).length > 0 && (
                  <div className="mt-1 pl-4 flex flex-wrap gap-2">
                    {Object.entries(entry.details).map(([k, v]) => (
                      <span key={k} className="text-xs text-muted-foreground"><span className="font-medium">{k}:</span> {v}</span>
                    ))}
                  </div>
                )}
                <div className="mt-1 pl-4">
                  <code className="text-xs text-muted-foreground/60 font-mono">{entry.hash.slice(0, 16)}…</code>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <span className="text-xs text-muted-foreground">Page {page}/{totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      )}
    </div>
  )
}
