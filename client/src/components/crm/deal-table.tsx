"use client"
import { useState, useMemo } from "react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, Search } from "lucide-react"
import Link from "next/link"
import type { Deal, DealStage } from "@/lib/api/crm"
import { computeLeadScore, STAGE_LABELS } from "@/lib/api/crm"

const STAGE_BADGE_VARIANTS: Record<DealStage, "default" | "secondary" | "outline" | "destructive"> = {
  prospect: "outline",
  qualified: "secondary",
  proposal: "default",
  negotiation: "default",
  won: "default",
  lost: "destructive",
}

interface Props {
  deals: Deal[]
}

type SortKey = "title" | "company" | "value" | "probability" | "stage" | "closeDate" | "assignedTo" | "createdAt"

const COLUMN_LABELS: Record<SortKey, string> = {
  title: "Titre",
  company: "Société",
  value: "Valeur",
  probability: "Prob.",
  stage: "Étape",
  closeDate: "Clôture",
  assignedTo: "Assigné à",
  createdAt: "Créé le",
}

export function DealTable({ deals }: Props) {
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return deals
      .filter(d => {
        const matchSearch =
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.company.toLowerCase().includes(q) ||
          (d.assignedTo?.toLowerCase().includes(q) ?? false)
        const matchStage = stageFilter === "all" || d.stage === stageFilter
        return matchSearch && matchStage
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? ""
        const bv = b[sortKey] ?? ""
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "fr", { numeric: true })
        return sortDir === "asc" ? cmp : -cmp
      })
  }, [deals, search, stageFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const sortIcon = (key: SortKey) =>
    sortKey === key
      ? sortDir === "asc" ? " ↑" : " ↓"
      : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Rechercher un deal…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Toutes les étapes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les étapes</SelectItem>
            {(Object.entries(STAGE_LABELS) as [DealStage, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {(["title", "company", "value", "probability", "stage", "closeDate", "assignedTo"] as SortKey[]).map(k => (
                <TableHead
                  key={k}
                  className="cursor-pointer whitespace-nowrap select-none hover:bg-muted/50 transition-colors"
                  onClick={() => toggleSort(k)}
                >
                  <span className="flex items-center gap-1">
                    {COLUMN_LABELS[k]}
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                    {sortIcon(k) && <span className="text-primary font-bold">{sortIcon(k)}</span>}
                  </span>
                </TableHead>
              ))}
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  Aucun résultat
                </TableCell>
              </TableRow>
            )}
            {filtered.map(d => (
              <TableRow key={d.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-medium">
                  <Link href={`/crm/deals/${d.id}`} className="hover:text-primary transition-colors">
                    {d.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.company}</TableCell>
                <TableCell className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(d.value)}
                </TableCell>
                <TableCell className="tabular-nums">{d.probability}%</TableCell>
                <TableCell>
                  <Badge variant={STAGE_BADGE_VARIANTS[d.stage]}>
                    {STAGE_LABELS[d.stage]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.closeDate ? new Date(d.closeDate).toLocaleDateString("fr-FR") : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.assignedTo ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={computeLeadScore(d) >= 70 ? "default" : computeLeadScore(d) >= 40 ? "secondary" : "outline"}
                    className="tabular-nums"
                  >
                    {computeLeadScore(d)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} deal{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}
