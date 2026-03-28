"use client"

// IDEA-272: Bulk PDF generation — generate N PDFs from template + data source

import { useState, useRef, useCallback } from "react"
import { Upload, Play, Download, FileText, CheckCircle2, AlertCircle, RefreshCw, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface DocTemplate {
  id: string
  name: string
}

interface BulkRow {
  idx: number
  data: Record<string, string>
  status: "pending" | "processing" | "done" | "error"
  output_url?: string
  error?: string
}

interface BulkJob {
  total: number
  done: number
  errors: number
  running: boolean
  zip_url?: string
}

function parseCsvToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split("\n")
  if (!lines.length) return { headers: [], rows: [] }
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]))
  })
  return { headers, rows }
}

export function BulkPdfGenerator() {
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<BulkRow[]>([])
  const [job, setJob] = useState<BulkJob | null>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  // Load templates on mount
  useState(() => {
    fetch("/api/docs/templates?type=pdf")
      .then(r => r.json())
      .then(d => setTemplates(d.data ?? []))
      .catch(() => {})
  })

  const handleCsvUpload = useCallback(async (file: File) => {
    setCsvFile(file)
    const text = await file.text()
    const { headers: h, rows: r } = parseCsvToRows(text)
    setHeaders(h)
    setRows(r.map((data, idx) => ({ idx, data, status: "pending" })))
    toast.success(`${r.length} rows loaded`)
  }, [])

  async function runBulk() {
    if (!selectedTemplate) { toast.error("Select a template"); return }
    if (!rows.length) { toast.error("Upload CSV data"); return }

    setJob({ total: rows.length, done: 0, errors: 0, running: true })
    const updated = [...rows]

    for (let i = 0; i < rows.length; i++) {
      updated[i] = { ...updated[i], status: "processing" }
      setRows([...updated])

      try {
        const res = await fetch("/api/docs/pdf/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: selectedTemplate, data: rows[i].data }),
        })
        if (!res.ok) throw new Error()
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        updated[i] = { ...updated[i], status: "done", output_url: url }
      } catch {
        updated[i] = { ...updated[i], status: "error", error: "Generation failed" }
      }

      const done = updated.filter(r => r.status === "done").length
      const errors = updated.filter(r => r.status === "error").length
      setRows([...updated])
      setJob(j => j ? { ...j, done, errors } : j)
    }

    // Bundle all into zip
    try {
      const res = await fetch("/api/docs/pdf/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplate, rows: rows.map(r => r.data) }),
      })
      if (res.ok) {
        const blob = await res.blob()
        setJob(j => j ? { ...j, running: false, zip_url: URL.createObjectURL(blob) } : j)
      }
    } catch {}

    setJob(j => j ? { ...j, running: false } : j)
    toast.success(`${updated.filter(r => r.status === "done").length} PDFs generated`)
  }

  const pct = job && job.total > 0 ? Math.round((job.done / job.total) * 100) : 0

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm flex items-center gap-2">
        <Package className="h-4 w-4" /> Bulk PDF Generator
      </h2>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Document template</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Data source (CSV)</Label>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30",
              csvFile && "border-primary/40 bg-primary/5"
            )}
            onClick={() => csvRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvUpload(f) }}
          >
            <input
              ref={csvRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f) }}
            />
            {csvFile ? (
              <p className="text-sm font-medium">{csvFile.name} — {rows.length} rows</p>
            ) : (
              <p className="text-sm text-muted-foreground">Drop CSV or click to upload</p>
            )}
          </div>
        </div>

        {headers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {headers.map(h => <Badge key={h} variant="outline" className="text-xs">{`{{${h}}}`}</Badge>)}
          </div>
        )}
      </div>

      {job && (
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{job.done}/{job.total} generated</span>
              {job.errors > 0 && <span className="text-destructive">{job.errors} errors</span>}
            </div>
            <Progress value={pct} className="h-2" />
            {job.zip_url && (
              <Button size="sm" asChild>
                <a href={job.zip_url} download="bulk_pdfs.zip">
                  <Download className="h-3.5 w-3.5 mr-1" /> Download All (ZIP)
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-48">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                  <span className="text-xs text-muted-foreground">Row {i + 1}</span>
                  <span className="text-xs flex-1 px-2 truncate">
                    {Object.values(row.data).slice(0, 2).join(", ")}
                  </span>
                  {row.status === "pending" && <Badge variant="secondary" className="text-xs">Pending</Badge>}
                  {row.status === "processing" && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {row.status === "done" && row.output_url && (
                    <a href={row.output_url} download={`doc_${i + 1}.pdf`}>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </a>
                  )}
                  {row.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={runBulk}
        disabled={!selectedTemplate || !rows.length || job?.running}
        className="w-full"
      >
        <Play className="h-4 w-4 mr-2" />
        {job?.running ? `Generating ${job.done}/${job.total}…` : `Generate ${rows.length} PDFs`}
      </Button>
    </div>
  )
}
