"use client"

import { useState, useCallback, useEffect } from "react"
import { usePageTitle } from "@/hooks/use-page-title"
import { AppLayout } from "@/components/layout/app-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Plus, Kanban, List, BarChart3, Target, Calendar, Upload, DollarSign, Download } from "lucide-react"
import { DealKanban } from "@/components/crm/deal-kanban"
import { DealTable } from "@/components/crm/deal-table"
import { SalesForecast } from "@/components/crm/sales-forecast"
import { QuotaTracker } from "@/components/crm/quota-tracker"
import { ProspectCsvImport } from "@/components/crm/prospect-csv-import"
import { CalendarActivities } from "@/components/crm/calendar-activities"
import { dealsApi, type Deal, type DealStage, STAGE_OPTIONS, STAGE_LABELS } from "@/lib/api/crm"
import { PipelineInvoiceValue } from "@/components/interop/PipelineInvoiceValue"
import { BillingForecast } from "@/components/interop/BillingForecast"
import { OverdueInvoicesCrmFlag } from "@/components/interop/OverdueInvoicesCrmFlag"
import { DealsExportCsv } from "@/components/interop/DealsExportCsv"
import { toast } from "sonner"

export default function CRMPage() {
  usePageTitle('CRM')
  const [deals, setDeals] = useState<Deal[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<Partial<Deal>>({ stage: "prospect", probability: 20, value: 0 })

  const reload = useCallback(async () => {
    const data = await dealsApi.list()
    setDeals(data)
  }, [])

  useEffect(() => { reload() }, [reload])

  const createDeal = async () => {
    if (!form.title?.trim() || !form.company?.trim()) return
    await dealsApi.create({
      title: form.title.trim(),
      company: form.company.trim(),
      value: form.value ?? 0,
      probability: form.probability ?? 20,
      stage: form.stage ?? "prospect",
      assignedTo: form.assignedTo,
      closeDate: form.closeDate,
      contactEmail: form.contactEmail,
    })
    await reload()
    setIsOpen(false)
    setForm({ stage: "prospect", probability: 20, value: 0 })
    toast.success("Opportunité créée.")
  }

  const moveDeal = useCallback(async (id: string, stage: DealStage) => {
    await dealsApi.update(id, { stage })
    await reload()
  }, [reload])

  const deleteDeal = useCallback(async (id: string) => {
    await dealsApi.delete(id)
    await reload()
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

        {/* Overdue invoices alert — Feature 11 */}
        <OverdueInvoicesCrmFlag compact />

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
            <TabsTrigger value="billing-report" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Facturation
            </TabsTrigger>
            <TabsTrigger value="billing-forecast" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Prév. enrichies
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
            <div className="space-y-3">
              <div className="flex justify-end">
                {/* Feature 29: Export deals with contact info */}
                <DealsExportCsv contacts={[]} compact />
              </div>
              <DealTable deals={deals} onDelete={deleteDeal} />
            </div>
          </TabsContent>

          <TabsContent value="forecast" className="mt-4">
            <SalesForecast deals={deals} />
          </TabsContent>

          {/* Feature 8 + 20: Pipeline invoice value + CRM revenue report */}
          <TabsContent value="billing-report" className="mt-4">
            <PipelineInvoiceValue />
          </TabsContent>

          {/* Feature 25: Billing-enriched forecast */}
          <TabsContent value="billing-forecast" className="mt-4">
            <BillingForecast />
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
              <Label>Titre <span className="text-destructive">*</span></Label>
              <Input
                autoFocus
                placeholder="Nom du deal…"
                value={form.title ?? ""}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Société <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Acme Corp"
                value={form.company ?? ""}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Email contact <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                type="email"
                placeholder="contact@acme.com"
                value={form.contactEmail ?? ""}
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Valeur (€) <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                type="number"
                min={0}
                value={form.value ?? ""}
                onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Probabilité (%) <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
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
              <Label>Date de clôture <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                type="date"
                value={form.closeDate ?? ""}
                onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Assigné à <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
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
