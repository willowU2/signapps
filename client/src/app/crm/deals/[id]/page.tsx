"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Edit, Trash2, Save, X } from "lucide-react"
import Link from "next/link"
import { ActivityLog } from "@/components/crm/activity-log"
import { DealTasks } from "@/components/crm/deal-tasks"
import { CalendarActivities } from "@/components/crm/calendar-activities"
import {
  dealsApi, type Deal, type DealStage,
  computeLeadScore, STAGE_OPTIONS, STAGE_LABELS,
} from "@/lib/api/crm"
import { DealDetailPanel } from "@/components/interop/DealDetailPanel"
import { toast } from "sonner"

const STAGE_BADGE: Record<DealStage, "default" | "secondary" | "outline" | "destructive"> = {
  prospect: "outline",
  qualified: "secondary",
  proposal: "default",
  negotiation: "default",
  won: "default",
  lost: "destructive",
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [deal, setDeal] = useState<Deal | undefined>(() => dealsApi.get(id))
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Deal>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!deal) {
    return (
      <AppLayout>
        <div className="p-8 text-muted-foreground flex flex-col items-center gap-4">
          <p>Opportunité introuvable.</p>
          <Button variant="outline" asChild>
            <Link href="/crm"><ArrowLeft className="h-4 w-4 mr-2" /> Retour CRM</Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const score = computeLeadScore(deal)
  const scoreVariant = score >= 70 ? "default" : score >= 40 ? "secondary" : "outline"

  const startEdit = () => {
    setForm({ ...deal })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm({})
  }

  const save = () => {
    const updated = dealsApi.update(id, form)
    if (updated) setDeal(updated)
    setEditing(false)
    setForm({})
    toast.success("Opportunité mise à jour.")
  }

  const handleDelete = () => {
    dealsApi.delete(id)
    toast.success("Opportunité supprimée.")
    router.push("/crm")
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

  return (
    <AppLayout>
      <div className="space-y-6 w-full">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/crm"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{deal.title}</h1>
            <p className="text-muted-foreground text-sm">{deal.company}</p>
          </div>
          <Badge variant={STAGE_BADGE[deal.stage]}>{STAGE_LABELS[deal.stage]}</Badge>
          <Badge variant={scoreVariant}>Score: {score}/100</Badge>
          <Button variant="outline" size="sm" onClick={startEdit} disabled={editing}>
            <Edit className="h-3.5 w-3.5 mr-1" /> Modifier
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Valeur", value: fmt(deal.value) },
            { label: "Probabilité", value: `${deal.probability}%` },
            { label: "Assigné à", value: deal.assignedTo ?? "—" },
            { label: "Clôture", value: deal.closeDate ? new Date(deal.closeDate).toLocaleDateString("fr-FR") : "—" },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="font-semibold mt-0.5 truncate">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Edit form */}
        {editing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Modifier l'opportunité</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Titre</Label>
                  <Input
                    value={form.title ?? ""}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Société</Label>
                  <Input
                    value={form.company ?? ""}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valeur (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.value ?? 0}
                    onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Probabilité (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.probability ?? 20}
                    onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Étape</Label>
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
                  <Label className="text-xs">Date de clôture</Label>
                  <Input
                    type="date"
                    value={form.closeDate ?? ""}
                    onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Assigné à</Label>
                  <Input
                    value={form.assignedTo ?? ""}
                    onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email contact</Label>
                  <Input
                    type="email"
                    value={form.contactEmail ?? ""}
                    onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={save}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <ActivityLog dealId={id} />
          <DealTasks dealId={id} />
        </div>

        {/* Calendar integration */}
        <CalendarActivities dealId={id} />

        {/* Features 2, 6, 13, 16, 21, 28: Deal interop panel */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Interopérabilité — Facturation, Documents, Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DealDetailPanel deal={deal} onDealUpdate={setDeal} />
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette opportunité ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement "{deal.title}". Les activités et tâches associées seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
