"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Check, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { dealsApi, STAGE_LABELS, type DealStage } from "@/lib/api/crm"
import { toast } from "sonner"

const DEAL_FIELDS = [
  "title", "company", "value", "probability", "stage",
  "assignedTo", "closeDate", "contactEmail"
] as const

type DealFieldKey = typeof DEAL_FIELDS[number]

const FIELD_LABELS: Record<DealFieldKey, string> = {
  title: "Titre du deal",
  company: "Société",
  value: "Valeur (€)",
  probability: "Probabilité (%)",
  stage: "Étape",
  assignedTo: "Assigné à",
  closeDate: "Date de clôture",
  contactEmail: "Email du contact",
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes }
      else if (char === "," && !inQuotes) { result.push(current.trim()); current = "" }
      else { current += char }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1).map(parseRow)
  return { headers, rows }
}

interface Props {
  onImport: () => void
}

export function ProspectCsvImport({ onImport }: Props) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Partial<Record<DealFieldKey, string>>>({})
  const [done, setDone] = useState(false)
  const [fileName, setFileName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const { headers: h, rows: r } = parseCSV(String(e.target?.result ?? ""))
      setHeaders(h)
      setRows(r)
      // Auto-map columns with matching names
      const auto: Partial<Record<DealFieldKey, string>> = {}
      h.forEach(col => {
        const match = DEAL_FIELDS.find(
          f => f.toLowerCase() === col.toLowerCase() ||
               FIELD_LABELS[f].toLowerCase() === col.toLowerCase()
        )
        if (match) auto[match] = col
      })
      setMapping(auto)
    }
    reader.readAsText(file, "UTF-8")
  }

  const importAll = () => {
    const toImport = rows
      .map(row => {
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = row[i] ?? "" })
        const d: Record<string, any> = { stage: "prospect" as DealStage }
        ;(Object.entries(mapping) as [DealFieldKey, string][]).forEach(([field, col]) => {
          if (!obj[col]) return
          if (field === "value" || field === "probability") d[field] = Number(obj[col]) || 0
          else if (field === "stage" && STAGE_LABELS[obj[col] as DealStage]) d[field] = obj[col]
          else d[field] = obj[col]
        })
        return d
      })
      .filter(d => d.title || d.company)

    if (toImport.length === 0) {
      toast.error("Aucun deal valide trouvé (colonne 'title' ou 'company' requise).")
      return
    }

    dealsApi.importMany(toImport as Omit<import('@/lib/api/crm').Deal, 'id' | 'createdAt' | 'updatedAt'>[])
    toast.success(`${toImport.length} deal${toImport.length > 1 ? "s" : ""} importé${toImport.length > 1 ? "s" : ""} avec succès.`)
    setDone(true)
    onImport()
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-emerald-600">
        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="h-6 w-6" />
        </div>
        <p className="font-medium">Import terminé !</p>
        <Button variant="outline" size="sm" onClick={() => { setDone(false); setHeaders([]); setRows([]) }}>
          Importer un autre fichier
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Upload className="h-4 w-4" /> Importer des prospects depuis un CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {fileName ? (
            <div className="flex items-center justify-center gap-2 text-primary">
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">{fileName}</span>
              <Badge variant="secondary">{rows.length} lignes</Badge>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Cliquez ou glissez un fichier <strong>.csv</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Colonnes suggérées: title, company, value, stage, closeDate…
              </p>
            </>
          )}
        </div>

        {headers.length > 0 && (
          <>
            {/* Column mapping */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Correspondance des colonnes
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEAL_FIELDS.map(field => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="text-xs w-32 shrink-0 text-muted-foreground">
                      {FIELD_LABELS[field]}
                    </Label>
                    <Select
                      value={mapping[field] ?? "_none"}
                      onValueChange={v => setMapping(m => ({
                        ...m,
                        [field]: v === "_none" ? undefined : v
                      }))}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="— ignorer —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— ignorer —</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Aperçu (3 premières lignes)
              </Label>
              <div className="overflow-auto max-h-40 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="text-xs py-1">{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Button
              onClick={importAll}
              disabled={Object.keys(mapping).length === 0}
            >
              Importer {rows.length} deal{rows.length > 1 ? "s" : ""}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
