"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingDown, DollarSign } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface Props {
  assetName: string
  purchaseDate?: string
}

function calcDepreciation(cost: number, salvage: number, life: number, purchaseYear: number) {
  const annual = (cost - salvage) / life
  return Array.from({ length: life + 1 }, (_, i) => ({
    year: purchaseYear + i,
    bookValue: Math.max(salvage, cost - annual * i),
    depreciation: i === 0 ? 0 : annual,
  }))
}

export function AssetDepreciation({ assetName, purchaseDate }: Props) {
  const defaultYear = purchaseDate ? new Date(purchaseDate).getFullYear() : new Date().getFullYear()
  const [cost, setCost] = useState("1000")
  const [salvage, setSalvage] = useState("100")
  const [life, setLife] = useState("5")

  const data = useMemo(() => {
    const c = parseFloat(cost) || 0
    const s = parseFloat(salvage) || 0
    const l = parseInt(life) || 1
    if (c <= 0 || l <= 0 || s >= c) return []
    return calcDepreciation(c, s, l, defaultYear)
  }, [cost, salvage, life, defaultYear])

  const currentYear = new Date().getFullYear()
  const currentEntry = data.find(d => d.year === currentYear)
  const totalDepreciated = data.length > 0 ? (parseFloat(cost) || 0) - (currentEntry?.bookValue ?? (parseFloat(cost) || 0)) : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-purple-500" />
          Asset Depreciation — Straight-Line
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Purchase Cost (€)</Label>
            <Input type="number" min="0" value={cost} onChange={e => setCost(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Salvage Value (€)</Label>
            <Input type="number" min="0" value={salvage} onChange={e => setSalvage(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Useful Life (years)</Label>
            <Input type="number" min="1" max="30" value={life} onChange={e => setLife(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        {data.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Current Book Value", value: `€${currentEntry?.bookValue.toFixed(0) ?? "—"}`, color: "text-blue-600" },
                { label: "Total Depreciated", value: `€${totalDepreciated.toFixed(0)}`, color: "text-orange-600" },
                { label: "Annual Depreciation", value: `€${data[1]?.depreciation.toFixed(0) ?? "—"}`, color: "text-purple-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                  <Tooltip formatter={(v) => [`€${Number(v).toFixed(0)}`, "Book Value"]} />
                  <Line type="monotone" dataKey="bookValue" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
