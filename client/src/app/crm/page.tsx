"use client"

import { useState, useCallback } from "react"
import { usePageTitle } from "@/hooks/use-page-title"
import { AppLayout } from "@/components/layout/app-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Plus, Kanban, List, BarChart3, Target, Calendar, Upload } from "lucide-react"
import { DealKanban } from "@/components/crm/deal-kanban"
import { DealTable } from "@/components/crm/deal-table"
import { SalesForecast } from "@/components/crm/sales-forecast"
import { QuotaTracker } from "@/components/crm/quota-tracker"
import { ProspectCsvImport } from "@/components/crm/prospect-csv-import"
import { CalendarActivities } from "@/components/crm/calendar-activities"
import { dealsApi, type Deal, type DealStage, STAGE_OPTIONS, STAGE_LABELS } from "@/lib/api/crm"
import { toast } from "sonner"

export default function CRMPage() {
  usePageTitle('CRM')
  const [deals, setDeals] = useState<Deal[]>(() => dealsApi.list())
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<Partial<Deal>>({ stage: "prospect", probability: 20, value: 0 })

  const reload = useCallback(() => setDeals(dealsApi.list()), [])

  const createDeal = () => {
    if (!form.title?.trim() || !form.company?.trim()) return
    dealsApi.create({
      title: form.title.trim(),
      company: form.company.trim(),
      value: form.value ?? 0,
      probability: form.probability ?? 20,
      stage: form.stage ?? "prospect",
      assignedTo: form.assignedTo,
      closeDate: form.closeDate,
      contactEmail: form.contactEmail,
    })
    reload()
    setIsOpen(false)
    setForm({ stage: "prospect", probability: 20, value: 0 })
    toast.success("Opportunité créée.")
  }

  const moveDeal = useCallback((id: string, stage: DealStage) => {
    dealsApi.update(id, { stage })
    reload()
  }, [reload])

  const deleteDeal = useCallback((id: string) => {
    dealsApi.delete(id)
    reload()
  }, [reload])

  const activeDeals = deals.filter(d => d.stage !== "lost")
  const wonDeals = deals.filter(d => d.stage === "won")
  const totalPipeline = activeDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0)
  const wonValue = wonDeals.reduce((s, d) => s + d.value, 0)

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              CRM & Ventes
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Pipeline, opportunités et suivi commercial.</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle opportunité
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Opportunités actives", value: activeDeals.length },
            { label: "Pipeline pondéré", value: fmt(totalPipeline) },
            { label: "Deals gagnés", value: wonDeals.length },
            { label: "Revenus gagnés", value: fmt(wonValue) },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="kanban">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="kanban" className="gap-1.5">
              <Kanban className="h-3.5 w-3.5" /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5">
              <List className="h-3.5 w-3.5" /> Liste
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Prévisions
            </TabsTrigger>
            <TabsTrigger value="quotas" className="gap-1.5">
              <Target className="h-3.5 w-3.5" /> Quotas
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Importer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            <DealKanban deals={deals} onMove={moveDeal} />
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <DealTable deals={deals} onDelete={deleteDeal} />
          </TabsContent>

          <TabsContent value="forecast" className="mt-4">
            <SalesForecast deals={deals} />
          </TabsContent>

          <TabsContent value="quotas" className="mt-4">
            <QuotaTracker />
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <CalendarActivities />
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <ProspectCsvImport onImport={reload} />
          </TabsContent>
        </Tabs>
      </div>

      {/* New Deal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle opportunité</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Titre *</Label>
              <Input
                placeholder="Nom du deal…"
                value={form.title ?? ""}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Société *</Label>
              <Input
                placeholder="Acme Corp"
                value={form.company ?? ""}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Email contact</Label>
              <Input
                type="email"
                placeholder="contact@acme.com"
                value={form.contactEmail ?? ""}
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Valeur (€)</Label>
              <Input
                type="number"
                min={0}
                value={form.value ?? ""}
                onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Probabilité (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.probability ?? 20}
                onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Étape</Label>
              <Select
                value={form.stage ?? "prospect"}
                onValueChange={v => setForm(f => ({ ...f, stage: v as DealStage }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date de clôture</Label>
              <Input
                type="date"
                value={form.closeDate ?? ""}
                onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Assigné à</Label>
              <Input
                placeholder="Jean Dupont"
                value={form.assignedTo ?? ""}
                onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button
              onClick={createDeal}
              disabled={!form.title?.trim() || !form.company?.trim()}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
