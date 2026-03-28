"use client"

// IDEA-270: Auto-fill document from form data — form submission → generated doc

import { useState, useEffect } from "react"
import { FileText, Zap, CheckCircle2, AlertCircle, Download, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface FormTemplate {
  id: string
  name: string
  form_id: string
  form_name: string
  doc_template_id: string
  doc_template_name: string
  field_mappings: FieldMapping[]
  active: boolean
  generated_count: number
  last_generated_at?: string
}

interface FieldMapping {
  form_field: string
  doc_token: string
}

interface GenerationResult {
  id: string
  form_submission_id: string
  doc_id: string
  doc_title: string
  status: "pending" | "processing" | "done" | "error"
  error?: string
  created_at: string
}

export function FormToDocMapper() {
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [results, setResults] = useState<GenerationResult[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [tmpls, gens] = await Promise.all([
        fetch("/api/docs/form-templates").then(r => r.json()),
        fetch("/api/docs/form-generations?limit=10").then(r => r.json()),
      ])
      setTemplates(tmpls.data ?? [])
      setResults(gens.data ?? [])
    } catch {
      toast.error("Failed to load form-to-doc configurations")
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      await fetch(`/api/docs/form-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, active } : t))
      toast.success(active ? "Automation enabled" : "Automation disabled")
    } catch {
      toast.error("Impossible de mettre à jour")
    }
  }

  async function triggerManual(templateId: string) {
    setGenerating(templateId)
    try {
      const res = await fetch(`/api/docs/form-templates/${templateId}/generate`, { method: "POST" })
      const data = await res.json()
      setResults(prev => [data, ...prev])
      toast.success("Document généré")
    } catch {
      toast.error("Generation failed")
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" /> Form → Document Automation
        </h2>
        <Badge variant="secondary">{templates.filter(t => t.active).length} active</Badge>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="space-y-2">
        {templates.map(t => (
          <Card key={t.id}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Form: <span className="font-medium">{t.form_name}</span> → Doc: <span className="font-medium">{t.doc_template_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.field_mappings.length} field mappings · {t.generated_count} docs generated
                  </p>
                  {t.last_generated_at && (
                    <p className="text-xs text-muted-foreground">
                      Last: {format(new Date(t.last_generated_at), "MMM d, HH:mm")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={t.active} onCheckedChange={v => toggleActive(t.id, v)} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generating === t.id}
                    onClick={() => triggerManual(t.id)}
                  >
                    {generating === t.id ? "…" : "Run"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && templates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No form-to-document automations configured yet.
          </p>
        )}
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-xs text-muted-foreground">Recent Generations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-52">
              {results.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{r.doc_title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, HH:mm")}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {r.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {r.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {r.status === "processing" && <Progress value={50} className="h-1 w-12" />}
                    {r.status === "done" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                        <a href={`/api/docs/${r.doc_id}/download`} download>
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
