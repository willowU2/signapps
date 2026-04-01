"use client"
// Feature 16: CRM deal stage change → notify via email
// Feature 4: CRM deal won → auto-create invoice

import { useState } from "react"
import { Bell, CheckCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { dealsApi, type Deal, type DealStage, STAGE_OPTIONS, STAGE_LABELS } from "@/lib/api/crm"
import { autoCreateInvoiceForWonDeal } from "@/lib/api/interop"
import { toast } from "sonner"

interface Props {
  deal: Deal
  onUpdate?: (updated: Deal) => void
}

function buildStageChangeEmail(deal: Deal, newStage: DealStage): string {
  const subject = `[CRM] Opportunité "${deal.title}" → ${STAGE_LABELS[newStage]}`
  const body = `L'opportunité "${deal.title}" (${deal.company}) est passée au stade : ${STAGE_LABELS[newStage]}.\n\nValeur : ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(deal.value)}\nDate de clôture : ${deal.closeDate ?? "—"}`
  return `mailto:${deal.contactEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function DealStageNotifier({ deal, onUpdate }: Props) {
  const [stage, setStage] = useState<DealStage>(deal.stage)
  const [saving, setSaving] = useState(false)

  const handleStageChange = async (newStage: DealStage) => {
    if (newStage === stage) return
    setSaving(true)
    const updated = await dealsApi.update(deal.id, { stage: newStage })
    if (updated) {
      setStage(newStage)
      onUpdate?.(updated)

      // Feature 4: auto-create invoice on won
      if (newStage === "won") {
        const inv = autoCreateInvoiceForWonDeal(updated)
        if (inv) {
          toast.success(`Deal gagné ! Facture ${inv.number} créée automatiquement.`, {
            duration: 5000,
          })
        } else {
          toast.success("Deal gagné !")
        }
      } else {
        toast.success(`Étape mise à jour : ${STAGE_LABELS[newStage]}`)
      }
    }
    setSaving(false)
  }

  const emailUrl = buildStageChangeEmail({ ...deal, stage }, stage)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Bell className="h-3 w-3" /> Avancement & notifications
      </p>

      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Étape actuelle</Label>
          <Select value={stage} onValueChange={v => handleStageChange(v as DealStage)} disabled={saving}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 mt-4">
          {deal.contactEmail && (
            <Button size="sm" variant="outline" asChild className="h-7 text-xs">
              <a href={emailUrl}>
                <Mail className="h-3 w-3 mr-1" /> Notifier
              </a>
            </Button>
          )}
          {stage === "won" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle className="h-3 w-3" /> Gagné
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
