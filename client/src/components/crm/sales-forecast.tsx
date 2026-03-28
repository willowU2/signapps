"use client"
import { useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Deal } from "@/lib/api/crm"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

interface Props {
  deals: Deal[]
}

export function SalesForecast({ deals }: Props) {
  const data = useMemo(() => {
    const byMonth: Record<string, { month: string; weighted: number; bestCase: number; count: number }> = {}

    deals
      .filter(d => d.closeDate && d.stage !== "lost")
      .forEach(d => {
        const key = d.closeDate!.slice(0, 7)
        if (!byMonth[key]) byMonth[key] = { month: key, weighted: 0, bestCase: 0, count: 0 }
        byMonth[key].weighted += (d.value * d.probability) / 100
        byMonth[key].bestCase += d.value
        byMonth[key].count += 1
      })

    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({
        month: format(parseISO(r.month + "-01"), "MMM yyyy", { locale: fr }),
        weighted: Math.round(r.weighted),
        bestCase: Math.round(r.bestCase),
        count: r.count,
      }))
  }, [deals])

  const totalWeighted = data.reduce((s, d) => s + d.weighted, 0)
  const totalBestCase = data.reduce((s, d) => s + d.bestCase, 0)

  const formatEur = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Revenu pondéré total</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(totalWeighted)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Best case total</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(totalBestCase)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prévisions par mois</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Aucune opportunité avec une date de clôture. Ajoutez des dates pour voir les prévisions.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatEur}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value),
                    name === "weighted" ? "Pondéré" : "Best case"
                  ]}
                />
                <Legend
                  formatter={name => name === "weighted" ? "Pondéré (prob.)" : "Best case"}
                />
                <Bar dataKey="weighted" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bestCase" fill="#22c55e" radius={[4, 4, 0, 0]} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
