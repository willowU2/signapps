'use client'

/**
 * FI3 — Budget tracking
 *
 * Budget allocation per department/project, progress bars, monthly chart (recharts),
 * and alerts when approaching or exceeding the limit.
 */

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, TrendingUp, Plus, Wallet } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetLine {
  id: string
  department: string
  project: string
  allocated: number
  spent: number
  monthlyData: { month: string; budget: number; actual: number }[]
}

// ─── Sample seed data (replace with API call when available) ──────────────────

const SEED_BUDGETS: BudgetLine[] = [
  {
    id: 'b1',
    department: 'Marketing',
    project: 'Campagne Q2',
    allocated: 15000,
    spent: 12800,
    monthlyData: [
      { month: 'Jan', budget: 2500, actual: 2100 },
      { month: 'Fév', budget: 2500, actual: 2300 },
      { month: 'Mar', budget: 2500, actual: 2800 },
      { month: 'Avr', budget: 2500, actual: 2600 },
      { month: 'Mai', budget: 2500, actual: 3000 },
    ],
  },
  {
    id: 'b2',
    department: 'R&D',
    project: 'SignApps v2',
    allocated: 40000,
    spent: 28500,
    monthlyData: [
      { month: 'Jan', budget: 8000, actual: 5500 },
      { month: 'Fév', budget: 8000, actual: 6200 },
      { month: 'Mar', budget: 8000, actual: 7100 },
      { month: 'Avr', budget: 8000, actual: 4800 },
      { month: 'Mai', budget: 8000, actual: 4900 },
    ],
  },
  {
    id: 'b3',
    department: 'RH',
    project: 'Formation',
    allocated: 8000,
    spent: 8200,
    monthlyData: [
      { month: 'Jan', budget: 1600, actual: 1400 },
      { month: 'Fév', budget: 1600, actual: 1700 },
      { month: 'Mar', budget: 1600, actual: 1900 },
      { month: 'Avr', budget: 1600, actual: 1800 },
      { month: 'Mai', budget: 1600, actual: 1400 },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPctColor(pct: number): string {
  if (pct > 100) return 'bg-red-500'
  if (pct >= 80) return 'bg-yellow-400'
  return 'bg-green-500'
}

function getPctBadge(pct: number): React.ReactNode {
  if (pct > 100) return <Badge variant="destructive">Dépassé</Badge>
  if (pct >= 80) return <Badge className="bg-yellow-100 text-yellow-700">Proche limite</Badge>
  return <Badge className="bg-green-100 text-green-700">Dans le budget</Badge>
}

// ─── Budget line card ─────────────────────────────────────────────────────────

function BudgetCard({ line, onEdit }: { line: BudgetLine; onEdit: (line: BudgetLine) => void }) {
  const pct = Math.round((line.spent / line.allocated) * 100)
  const remaining = line.allocated - line.spent

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{line.department}</CardTitle>
            <p className="text-sm text-muted-foreground">{line.project}</p>
          </div>
          <div className="flex items-center gap-2">
            {getPctBadge(pct)}
            <Button variant="ghost" size="sm" onClick={() => onEdit(line)}>
              Modifier
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{line.spent.toLocaleString('fr')} €</span>
            <span className="text-muted-foreground">/ {line.allocated.toLocaleString('fr')} €</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getPctColor(pct)}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>{pct}% utilisé</span>
            <span>
              {remaining >= 0
                ? `${remaining.toLocaleString('fr')} € restants`
                : `${Math.abs(remaining).toLocaleString('fr')} € de dépassement`}
            </span>
          </div>
        </div>

        {/* Alert */}
        {pct >= 80 && (
          <div
            className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
              pct > 100
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {pct > 100
              ? `Budget dépassé de ${(pct - 100).toFixed(0)}%`
              : `${(100 - pct).toFixed(0)}% du budget restant — limite approchante`}
          </div>
        )}

        {/* Monthly chart */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Mensuel (budget vs réel)
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={line.monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v) => `${Number(v).toLocaleString('fr')} €`}
                contentStyle={{ fontSize: 11, borderRadius: 6 }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="budget" name="Budget" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" name="Réel" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Edit dialog ──────────────────────────────────────────────────────────────

function EditDialog({
  line,
  onClose,
  onSave,
}: {
  line: BudgetLine | null
  onClose: () => void
  onSave: (updated: BudgetLine) => void
}) {
  const [allocated, setAllocated] = useState(line?.allocated.toString() ?? '')
  const [spent, setSpent] = useState(line?.spent.toString() ?? '')

  if (!line) return null

  const handleSave = () => {
    const a = parseFloat(allocated)
    const s = parseFloat(spent)
    if (isNaN(a) || isNaN(s) || a <= 0) {
      toast.error('Valeurs invalides')
      return
    }
    onSave({ ...line, allocated: a, spent: s })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Modifier — {line.department} / {line.project}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Budget alloué (€)</Label>
            <Input
              type="number"
              min="0"
              step="100"
              value={allocated}
              onChange={(e) => setAllocated(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Dépenses actuelles (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={spent}
              onChange={(e) => setSpent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BudgetTracker() {
  const [budgets, setBudgets] = useState<BudgetLine[]>(SEED_BUDGETS)
  const [editTarget, setEditTarget] = useState<BudgetLine | null>(null)

  const summary = useMemo(() => {
    const totalAllocated = budgets.reduce((s, b) => s + b.allocated, 0)
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
    const overBudget = budgets.filter((b) => b.spent > b.allocated).length
    return { totalAllocated, totalSpent, overBudget }
  }, [budgets])

  const handleSave = (updated: BudgetLine) => {
    setBudgets((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    toast.success('Budget mis à jour')
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Budget total</p>
            <p className="text-2xl font-bold">{summary.totalAllocated.toLocaleString('fr')} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Dépensé</p>
            <p className="text-2xl font-bold">{summary.totalSpent.toLocaleString('fr')} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Dépassements</p>
            <p className={`text-2xl font-bold ${summary.overBudget > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {summary.overBudget}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget lines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {budgets.map((b) => (
          <BudgetCard key={b.id} line={b} onEdit={setEditTarget} />
        ))}
      </div>

      <EditDialog line={editTarget} onClose={() => setEditTarget(null)} onSave={handleSave} />
    </div>
  )
}
