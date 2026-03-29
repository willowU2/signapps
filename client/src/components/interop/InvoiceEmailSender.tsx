"use client"
// Feature 22: Billing → email invoice to contact
// Feature 9: Contact → one-click "Send email"

import { useState } from "react"
import { Mail, Send, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localInvoicesApi, type LocalInvoice } from "@/lib/api/interop"
import { toast } from "sonner"
import Link from "next/link"

interface Props {
  invoice?: LocalInvoice
  contactEmail?: string
  contactName?: string
  mode?: "invoice" | "quick"
}

function buildInvoiceEmail(invoice: LocalInvoice, to: string): string {
  const fmtAmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(invoice.amount)
  const subject = `Facture ${invoice.number} — ${fmtAmt}`
  const body = `Bonjour,\n\nVeuillez trouver ci-joint la facture ${invoice.number} d'un montant de ${fmtAmt}.\n\nDate d'échéance : ${new Date(invoice.dueDate).toLocaleDateString("fr-FR")}\n\nMerci de votre confiance.\n\nCordialement`
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function InvoiceEmailSender({ invoice, contactEmail, contactName, mode = "invoice" }: Props) {
  const [email, setEmail] = useState(contactEmail ?? invoice?.contactEmail ?? "")
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    if (!email.trim()) {
      toast.error("Adresse email requise.")
      return
    }

    if (invoice) {
      // Mark invoice as sent
      localInvoicesApi.update(invoice.id, { status: "sent", contactEmail: email })
      const url = buildInvoiceEmail(invoice, email)
      window.open(url, "_blank")
      setSent(true)
      toast.success(`Facture ${invoice.number} marquée comme envoyée.`)
    } else {
      // Quick email (Feature 9)
      const subject = `Message de SignApps`
      const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`
      window.open(url, "_blank")
      toast.success("Client mail ouvert.")
    }
  }

  if (mode === "quick") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        asChild
      >
        <a href={`mailto:${email}`}>
          <Mail className="h-3 w-3 mr-1" />
          {contactName ? `Écrire à ${contactName.split(" ")[0]}` : "Envoyer email"}
        </a>
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Mail className="h-3 w-3" /> Envoyer par email
      </p>

      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Destinataire</Label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="client@example.com"
            className="h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          className="h-8"
          onClick={handleSend}
          disabled={!email.trim()}
        >
          {sent
            ? <><CheckCircle className="h-3 w-3 mr-1" /> Envoyé</>
            : <><Send className="h-3 w-3 mr-1" /> Envoyer</>
          }
        </Button>
      </div>

      {invoice && (
        <div className="text-xs text-muted-foreground">
          Facture : <strong>{invoice.number}</strong> · {
            new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(invoice.amount)
          }
        </div>
      )}
    </div>
  )
}
