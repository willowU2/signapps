"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Target, Trash2 } from "lucide-react"
import { quotasApi, type Quota } from "@/lib/api/crm"

function getCurrentPeriod(): string {
  const d = new Date()
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}

interface Props {
  currentPeriod?: string
}

export function QuotaTracker({ currentPeriod = getCurrentPeriod() }: Props) {
  const [quotas, setQuotas] = useState<Quota[]>(() =>
    quotasApi.listByPeriod(currentPeriod)
  )
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ salesperson: "", target: "", achieved: "" })

  const reload = () => setQuotas(quotasApi.listByPeriod(currentPeriod))

  const save = () => {
    if (!form.salesperson.trim() || !form.target) return
    quotasApi.upsert({
      salesperson: form.salesperson.trim(),
      period: currentPeriod,
      target: Number(form.target),
      achieved: Number(form.achieved),
    })
    setForm({ salesperson: "", target: "", achieved: "" })
    setAdding(false)
    reload()
  }

  const remove = (id: string) => {
    quotasApi.delete(id)
    reload()
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Quotas — {currentPeriod}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3 w-3 mr-1" />
          {adding ? "Annuler" : "Ajouter"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {adding && (
          <div className="grid gap-2 p-3 bg-muted/30 rounded-md border">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Commercial</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Jean Dupont"
                  value={form.salesperson}
                  onChange={e => setForm(f => ({ ...f, salesperson: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Objectif (€)</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  placeholder="50000"
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Réalisé (€)</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  placeholder="0"
                  value={form.achieved}
                  onChange={e => setForm(f => ({ ...f, achieved: e.target.value }))}
                />
              </div>
            </div>
            <Button size="sm" onClick={save} disabled={!form.salesperson || !form.target}>
              Enregistrer le quota
            </Button>
          </div>
        )}

        {quotas.map(q => {
          const pct = q.target > 0 ? Math.min(100, Math.round((q.achieved / q.target) * 100)) : 0
          const variant = pct >= 100 ? "default" : pct >= 75 ? "secondary" : "outline"
          const progressColor = pct >= 100
            ? "[&>div]:bg-emerald-500"
            : pct >= 75
              ? "[&>div]:bg-amber-500"
              : "[&>div]:bg-blue-500"

          return (
            <div key={q.id} className="space-y-2 group">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{q.salesperson}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={variant} className="text-xs tabular-nums">
                    {pct}% — {q.achieved.toLocaleString("fr-FR")} / {q.target.toLocaleString("fr-FR")} €
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => remove(q.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <Progress value={pct} className={`h-2 ${progressColor}`} />
            </div>
          )
        })}

        {quotas.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun quota défini pour {currentPeriod}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
