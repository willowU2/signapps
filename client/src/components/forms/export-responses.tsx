"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { FormField, FormResponse } from "@/lib/api/forms"

interface Props {
  fields: FormField[]
  responses: FormResponse[]
}

type AnswerEntry = { field_id: string; value: unknown }

function getAnswerValue(r: FormResponse, fieldId: string): string {
  const answers = r.answers
  if (Array.isArray(answers)) {
    const a = (answers as AnswerEntry[]).find((entry) => entry.field_id === fieldId)?.value
    return Array.isArray(a) ? a.join(", ") : String(a ?? "")
  }
  const v = (answers as Record<string, unknown>)?.[fieldId]
  return Array.isArray(v) ? v.join(", ") : String(v ?? "")
}

export function ExportResponses({ fields, responses }: Props) {
  const [exporting, setExporting] = useState(false)

  const exportCSV = () => {
    const headers = ["Date soumission", "Répondant", ...fields.map(f => `"${f.label.replace(/"/g, '""')}"`)]
    const rows = responses.map(r => [
      `"${new Date(r.submitted_at).toLocaleString("fr-FR")}"`,
      `"${(r.respondent_email ?? "").replace(/"/g, '""')}"`,
      ...fields.map(f => `"${getAnswerValue(r, f.id).replace(/"/g, '""')}"`)
    ])
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "reponses.csv"
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const exportXLSX = async () => {
    setExporting(true)
    try {
      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Réponses")
      const headers = ["Date soumission", "Répondant", ...fields.map(f => f.label)]
      ws.addRow(headers)
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8F8" } }
      responses.forEach(r => {
        ws.addRow([
          new Date(r.submitted_at).toLocaleString("fr-FR"),
          r.respondent_email ?? "",
          ...fields.map(f => getAnswerValue(r, f.id))
        ])
      })
      ws.columns.forEach(col => { col.width = 22 })
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "reponses.xlsx"
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) {
      console.error("XLSX export error:", e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportCSV} disabled={!responses.length}>
        <Download className="h-3 w-3 mr-1" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={exportXLSX} disabled={!responses.length || exporting}>
        <Download className="h-3 w-3 mr-1" /> {exporting ? "..." : "XLSX"}
      </Button>
    </div>
  )
}
