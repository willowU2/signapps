"use client"

import { useState, useRef, useCallback } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { QrCode, Search, CheckCircle, XCircle, Loader2, Package } from "lucide-react"
import { itAssetsApi, HardwareAsset } from "@/lib/api/it-assets"

export default function QRScanPage() {
  const [manualInput, setManualInput] = useState("")
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<HardwareAsset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [auditLog, setAuditLog] = useState<Array<{ id: string; name: string; time: string; found: boolean }>>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const lookupAsset = useCallback(async (raw: string) => {
    setError(null)
    setResult(null)
    setScanning(true)

    // Parse QR value — may be JSON or plain ID
    let assetId = raw.trim()
    try {
      const parsed = JSON.parse(raw)
      if (parsed.id) assetId = parsed.id
    } catch {
      // raw is already an ID
    }

    try {
      const res = await itAssetsApi.getHardware(assetId)
      const asset = res.data
      setResult(asset)
      setAuditLog(log => [
        { id: asset.id, name: asset.name, time: new Date().toLocaleTimeString(), found: true },
        ...log.slice(0, 19),
      ])
    } catch {
      setError(`Asset not found for: ${assetId}`)
      setAuditLog(log => [
        { id: assetId, name: "Unknown", time: new Date().toLocaleTimeString(), found: false },
        ...log.slice(0, 19),
      ])
    } finally {
      setScanning(false)
    }
  }, [])

  const handleManualSearch = () => {
    if (!manualInput.trim()) return
    lookupAsset(manualInput)
    setManualInput("")
  }

  const STATUS_COLOR: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600",
    maintenance: "bg-orange-500/10 text-orange-600",
    retired: "bg-muted text-muted-foreground",
    stock: "bg-blue-500/10 text-blue-600",
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />
            QR Inventory Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Scan or enter asset ID to audit inventory</p>
        </div>

        {/* Manual input (simulates scan — in production you'd integrate a camera QR library) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scan / Search Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Paste QR value or enter asset ID…"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleManualSearch()}
                className="font-mono"
              />
              <Button onClick={handleManualSearch} disabled={scanning || !manualInput.trim()}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              In production, connect a USB barcode scanner or camera QR reader. The input auto-submits on Enter.
            </p>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{result.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[result.status ?? ""] ?? "bg-muted text-muted-foreground"}`}>
                      {result.status ?? "unknown"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {[
                      ["Type", result.type],
                      ["Manufacturer", result.manufacturer],
                      ["Model", result.model],
                      ["Serial", result.serial_number],
                      ["Location", result.location],
                      ["Assigned", result.assigned_user_id ?? "Unassigned"],
                    ].map(([label, value]) => value && (
                      <div key={label}>
                        <span className="text-muted-foreground text-xs">{label}: </span>
                        <span className="text-xs font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audit log */}
        {auditLog.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Audit Log — {auditLog.length} scanned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {auditLog.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0 border-border/50">
                    <div className="flex items-center gap-2">
                      {entry.found
                        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        : <XCircle className="h-3.5 w-3.5 text-destructive" />
                      }
                      <span className={entry.found ? "font-medium" : "text-muted-foreground"}>{entry.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{entry.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
