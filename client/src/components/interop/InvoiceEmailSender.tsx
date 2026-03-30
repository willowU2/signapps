"use client"
// Feature 22: Billing → email invoice to contact
// Feature 9: Contact → one-click "Send email"
// Idea 46: Replace mailto: with real compose dialog + invoice attachment

import { useState } from "react"
import { Mail, Send, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localInvoicesApi, type LocalInvoice } from "@/lib/api/interop"
import { mailApi } from "@/lib/api-mail"
import { toast } from "sonner"

interface Props {
  invoice?: LocalInvoice
  contactEmail?: string
  contactName?: string
  mode?: "invoice" | "quick"
  accountId?: string
}

function buildInvoiceSubject(invoice: LocalInvoice): string {
  const fmtAmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(invoice.amount)
  return `Facture ${invoice.number} — ${fmtAmt}`
}

function buildInvoiceBody(invoice: LocalInvoice): string {
  const fmtAmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(invoice.amount)
  return `Bonjour,\n\nVeuillez trouver ci-joint la facture ${invoice.number} d'un montant de ${fmtAmt}.\n\nDate d'échéance : ${new Date(invoice.dueDate).toLocaleDateString("fr-FR")}\n\nMerci de votre confiance.\n\nCordialement`
}

export function InvoiceEmailSender({ invoice, contactEmail, contactName, mode = "invoice", accountId }: Props) {
  const [email, setEmail] = useState(contactEmail ?? invoice?.contactEmail ?? "")
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  // Idea 46: Send via mailApi instead of mailto
  const handleSend = async () => {
    if (!email.trim()) {
      toast.error("Adresse email requise.")
      return
    }

    if (invoice) {
      setSending(true)
      try {
        const effectiveAccountId = accountId || 'default'
        await mailApi.send({
          account_id: effectiveAccountId,
          recipient: email.trim(),
          subject: buildInvoiceSubject(invoice),
          body_text: buildInvoiceBody(invoice),
          // Attach invoice PDF via download endpoint reference in metadata
          metadata: JSON.stringify({
            invoice_id: invoice.id,
            invoice_number: invoice.number,
            attachment_url: `/api/billing/invoices/${invoice.id}/pdf`,
          }),
        })
        localInvoicesApi.update(invoice.id, { status: "sent", contactEmail: email })
        setSent(true)
        toast.success(`Facture ${invoice.number} envoyée à ${email}.`)
      } catch {
        toast.error("Impossible d'envoyer la facture par email.")
      } finally {
        setSending(false)
      }
    } else {
      // Quick email (Feature 9)
      setSending(true)
      try {
        await mailApi.send({
          account_id: accountId || 'default',
          recipient: email.trim(),
          subject: 'Message de SignApps',
          body_text: '',
        })
        toast.success("Email envoyé.")
        setSent(true)
      } catch {
        // fallback to mailto
        window.open(`mailto:${email}`, "_blank")
      } finally {
        setSending(false)
      }
    }
  }

  if (mode === "quick") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={handleSend}
        disabled={!email.trim() || sending}
      >
        <Mail className="h-3 w-3 mr-1" />
        {contactName ? `Écrire à ${contactName.split(" ")[0]}` : "Envoyer email"}
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
          disabled={!email.trim() || sending}
        >
          {sent
            ? <><CheckCircle className="h-3 w-3 mr-1" /> Envoyé</>
            : sending
            ? <>Envoi…</>
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
