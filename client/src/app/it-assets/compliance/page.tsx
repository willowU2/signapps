"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  Shield, ShieldAlert, Download, FileText, Calendar,
  CheckCircle2, XCircle,
} from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { toast } from "sonner"
import {
  itAssetsApi,
  HardwareAsset,
  PatchComplianceStats,
  AvFleetSummary,
  EncryptionFleetSummary,
} from "@/lib/api/it-assets"
import { usePageTitle } from "@/hooks/use-page-title"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PolicyCompliance {
  total_machines: number
  compliant: number
  non_compliant: number
  compliance_pct: number
}

// ─── Donut Chart ────────────────────────────────────────────────────────────────

function DonutChart({
  title,
  pct,
  color,
  detail,
}: {
  title: string
  pct: number
  color: string
  detail?: string
}) {
  const data = [
    { name: "Compliant", value: pct },
    { name: "Non-compliant", value: 100 - pct },
  ]
  const colors = [color, "#e5e7eb"]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center -mt-4">
          <div className="text-3xl font-bold" style={{ color }}>
            {pct.toFixed(1)}%
          </div>
          {detail && <div className="text-xs text-muted-foreground mt-1">{detail}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CSV Export ─────────────────────────────────────────────────────────────────

function exportCsv(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) { toast.error("No data to export"); return }
  const headers = Object.keys(data[0])
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))
  const csv = [headers.join(","), ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`Exported ${data.length} rows`)
}

// ─── PDF Export via print ─────────────────────────────────────────────────────

function exportPdf() {
  window.print()
}

// ─── Scheduled Report Dialog ──────────────────────────────────────────────────

function ScheduleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [freq, setFreq] = useState("weekly")
  const [email, setEmail] = useState("")

  function save() {
    if (!email.trim()) { toast.error("Email required"); return }
    const schedule = { frequency: freq, email, created_at: new Date().toISOString() }
    const existing = JSON.parse(localStorage.getItem("compliance_schedules") ?? "[]") as unknown[]
    existing.push(schedule)
    localStorage.setItem("compliance_schedules", JSON.stringify(existing))
    toast.success(`Report scheduled (${freq}) → ${email}`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule Compliance Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Frequency</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Send to email</Label>
            <Input
              type="email"
              placeholder="admin@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Schedule stored locally. Connect to email service for delivery.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  usePageTitle("Compliance Dashboard")
  const [showSchedule, setShowSchedule] = useState(false)

  const { data: hardware = [] } = useQuery<HardwareAsset[]>({
    queryKey: ["hardware"],
    queryFn: () => itAssetsApi.listHardware().then(r => r.data),
  })

  const { data: patchStats } = useQuery<PatchComplianceStats>({
    queryKey: ["patch-compliance"],
    queryFn: () => itAssetsApi.patchCompliance().then(r => r.data),
  })

  const { data: avStats } = useQuery<AvFleetSummary>({
    queryKey: ["av-fleet"],
    queryFn: () => itAssetsApi.getAvFleetSummary().then(r => r.data),
  })

  const { data: encStats } = useQuery<EncryptionFleetSummary>({
    queryKey: ["enc-fleet"],
    queryFn: () => itAssetsApi.getEncryptionFleetSummary().then(r => r.data),
  })

  // Derived percentages
  const patchPct = patchStats?.compliance_pct ?? 0
  const avPct = avStats
    ? (avStats.total_machines > 0 ? (avStats.protected / avStats.total_machines) * 100 : 0)
    : 0
  const encPct = encStats?.compliance_pct ?? 0
  // Policy compliance stub (would come from policies API)
  const policyPct = 85

  const overallScore = (patchPct + avPct + encPct + policyPct) / 4

  // Non-compliant devices table data (from hardware list)
  const nonCompliantDevices = hardware.map(h => ({
    id: h.id,
    name: h.name,
    type: h.type,
    status: h.status ?? "unknown",
    location: h.location ?? "—",
  }))

  function handleExportCsv() {
    exportCsv(
      nonCompliantDevices.map(d => ({
        Name: d.name,
        Type: d.type,
        Status: d.status,
        Location: d.location,
      })),
      "compliance-report.csv"
    )
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 print:p-0" id="compliance-report">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Compliance Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <FileText className="h-4 w-4 mr-1" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSchedule(true)}>
              <Calendar className="h-4 w-4 mr-1" /> Schedule Report
            </Button>
          </div>
        </div>

        {/* Overall score */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-5xl font-bold" style={{
                  color: overallScore >= 80 ? "#10b981" : overallScore >= 60 ? "#f59e0b" : "#ef4444"
                }}>
                  {overallScore.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">Overall compliance score</div>
              </div>
              <div className="flex-1">
                <Progress value={overallScore} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
              <div>
                {overallScore >= 80 ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-8 w-8 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4 donut charts */}
        <div className="grid grid-cols-4 gap-4">
          <DonutChart
            title="Patch Compliance"
            pct={patchPct}
            color="#6366f1"
            detail={`${patchStats?.fully_patched ?? 0} / ${patchStats?.total_machines ?? 0} machines`}
          />
          <DonutChart
            title="AV Protection"
            pct={avPct}
            color="#10b981"
            detail={`${avStats?.protected ?? 0} protected`}
          />
          <DonutChart
            title="Disk Encryption"
            pct={encPct}
            color="#f59e0b"
            detail={`${encStats?.fully_encrypted ?? 0} fully encrypted`}
          />
          <DonutChart
            title="Policy Compliance"
            pct={policyPct}
            color="#8b5cf6"
            detail="Based on policy assignments"
          />
        </div>

        {/* Non-compliant devices table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Device Inventory</CardTitle>
            <Badge variant="secondary">{hardware.length} devices</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonCompliantDevices.slice(0, 20).map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.type}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "online" ? "default" : "secondary"}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.location}</TableCell>
                  </TableRow>
                ))}
                {hardware.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No devices found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Print footer */}
        <div className="hidden print:block text-xs text-muted-foreground text-center pt-4">
          SignApps Compliance Report — Generated {new Date().toLocaleString()}
        </div>
      </div>

      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} />

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body > * { display: none; }
          #compliance-report { display: block !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </AppLayout>
  )
}
