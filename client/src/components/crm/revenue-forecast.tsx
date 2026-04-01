"use client"
import { useMemo, useState, useEffect } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { dealsApi, type Deal, type DealStage } from "@/lib/api/crm"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

// Stage probabilities per spec
const STAGE_PROBABILITY: Record<DealStage, number> = {
  prospect: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
}

interface MonthPoint {
  month: string
  forecast: number
  actual: number
  count: number
}

export function RevenueForecast() {
  const [deals, setDeals] = useState<Deal[]>([])
  useEffect(() => { dealsApi.list().then(setDeals) }, [])

  const data = useMemo<MonthPoint[]>(() => {
    const byMonth: Record<string, MonthPoint> = {}

    deals
      .filter(d => d.closeDate && d.stage !== "lost")
      .forEach(d => {
        const key = d.closeDate!.slice(0, 7)
        if (!byMonth[key]) {
          byMonth[key] = { month: key, forecast: 0, actual: 0, count: 0 }
        }
        const prob = STAGE_PROBABILITY[d.stage] / 100
        byMonth[key].forecast += d.value * prob
        if (d.stage === "won") byMonth[key].actual += d.value
        byMonth[key].count += 1
      })

    return Object.values(byMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({
        ...r,
        month: format(parseISO(r.month + "-01"), "MMM yyyy", { locale: fr }),
        forecast: Math.round(r.forecast),
        actual: Math.round(r.actual),
      }))
  }, [deals])

  const totalForecast = data.reduce((s, d) => s + d.forecast, 0)
  const totalActual = data.reduce((s, d) => s + d.actual, 0)

  const formatEur = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`

  const fmtFull = (v: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v)

  return (
    <div className="space-y-4">
      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Revenus prévisionnels</p>
            <p className="text-2xl font-bold text-primary mt-1">{fmtFull(totalForecast)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pondéré par probabilité de stade</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Revenus réalisés</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtFull(totalActual)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Deals gagnés uniquement</p>
          </CardContent>
        </Card>
      </div>

      {/* Line chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prévisions vs Réalisé par mois</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Aucune opportunité avec une date de clôture. Ajoutez des dates pour voir les prévisions.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatEur} />
                <Tooltip
                  formatter={(value, name) => [
                    fmtFull(Number(value)),
                    name === "forecast" ? "Prévisionnel" : "Réalisé",
                  ]}
                />
                <Legend formatter={name => (name === "forecast" ? "Prévisionnel" : "Réalisé")} />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
