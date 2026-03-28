"use client"

// IDEA-271: PDF form filling — fill PDF form fields programmatically

import { useState, useCallback, useRef } from "react"
import { Upload, FileText, Play, Download, RefreshCw, AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PdfField {
  name: string
  type: "text" | "checkbox" | "radio" | "dropdown" | "signature"
  value: string
  required: boolean
  options?: string[]   // for dropdown/radio
}

interface FillJob {
  id: string
  filename: string
  status: "pending" | "processing" | "done" | "error"
  progress: number
  output_url?: string
  error?: string
}

export function PdfFormFiller() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [fields, setFields] = useState<PdfField[]>([])
  const [detecting, setDetecting] = useState(false)
  const [job, setJob] = useState<FillJob | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    setPdfFile(file)
    setFields([])
    setDetecting(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/docs/pdf/detect-fields", { method: "POST", body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFields(data.fields ?? [])
      toast.success(`${data.fields?.length ?? 0} fields detected`)
    } catch {
      toast.error("Détection des champs échouée — vous pouvez les ajouter manuellement")
    } finally {
      setDetecting(false)
    }
  }, [])

  function addField() {
    setFields(prev => [...prev, { name: "", type: "text", value: "", required: false }])
  }

  function updateField(idx: number, patch: Partial<PdfField>) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  function removeField(idx: number) {
    setFields(prev => prev.filter((_, i) => i !== idx))
  }

  async function fillPdf() {
    if (!pdfFile) { toast.error("Téléversez un PDF d'abord"); return }
    const emptyRequired = fields.filter(f => f.required && !f.value)
    if (emptyRequired.length) {
      toast.error(`${emptyRequired.length} required field(s) missing`)
      return
    }

    const jobId = `job_${Date.now()}`
    setJob({ id: jobId, filename: pdfFile.name, status: "processing", progress: 0 })

    try {
      const formData = new FormData()
      formData.append("file", pdfFile)
      formData.append("fields", JSON.stringify(fields))

      // Simulate progress while uploading
      const progressInterval = setInterval(() => {
        setJob(j => j ? { ...j, progress: Math.min(j.progress + 10, 80) } : j)
      }, 300)

      const res = await fetch("/api/docs/pdf/fill", { method: "POST", body: formData })
      clearInterval(progressInterval)

      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setJob(j => j ? { ...j, status: "done", progress: 100, output_url: url } : j)
      toast.success("PDF filled successfully")
    } catch {
      setJob(j => j ? { ...j, status: "error", progress: 0, error: "Fill failed" } : j)
      toast.error("PDF fill failed")
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors",
          pdfFile && "border-primary/50 bg-primary/5"
        )}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f?.type === "application/pdf") handleUpload(f)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
        />
        {pdfFile ? (
          <div className="flex items-center justify-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{pdfFile.name}</span>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Drop a PDF form or click to upload</p>
          </>
        )}
      </div>

      {detecting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Detecting form fields…
        </div>
      )}

      {fields.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">Form Fields ({fields.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={addField}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-60">
              {fields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                    <Input
                      value={field.name}
                      onChange={e => updateField(idx, { name: e.target.value })}
                      placeholder="Field name"
                      className="h-7 text-xs"
                    />
                    <Input
                      value={field.value}
                      onChange={e => updateField(idx, { value: e.target.value })}
                      placeholder="Value"
                      className="h-7 text-xs"
                    />
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">{field.type}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => removeField(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {job && (
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{job.filename}</span>
              {job.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {job.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
            </div>
            {job.status === "processing" && <Progress value={job.progress} className="h-1.5" />}
            {job.output_url && (
              <Button size="sm" asChild>
                <a href={job.output_url} download={`filled_${job.filename}`}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download Filled PDF
                </a>
              </Button>
            )}
            {job.error && <p className="text-xs text-destructive">{job.error}</p>}
          </CardContent>
        </Card>
      )}

      <Button
        onClick={fillPdf}
        disabled={!pdfFile || fields.length === 0 || detecting}
        className="w-full"
      >
        <Play className="h-4 w-4 mr-2" /> Fill PDF
      </Button>
    </div>
  )
}
