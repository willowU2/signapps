"use client"

import { useState, useEffect } from "react"
import { Mail, ExternalLink, Loader2, Inbox } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { searchApi, mailApi, type Email } from "@/lib/api-mail"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import Link from "next/link"

interface ContactEmailPanelProps {
  contactEmail: string
  contactName: string
  onClose: () => void
}

export function ContactEmailPanel({ contactEmail, contactName, onClose }: ContactEmailPanelProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchEmails() {
      setLoading(true)
      setError(false)
      try {
        // Try search API first (from:contact@email.com or to:contact@email.com)
        let results: Email[] = []
        try {
          results = await searchApi.search({ q: `from:${contactEmail}`, limit: 5 })
        } catch {
          // Fallback: list all and filter client-side
          try {
            const all = await mailApi.list({ limit: 50 })
            results = all
              .filter(e =>
                e.sender?.toLowerCase().includes(contactEmail.toLowerCase()) ||
                e.recipient?.toLowerCase().includes(contactEmail.toLowerCase())
              )
              .slice(0, 5)
          } catch {
            // No mail service available - use seed data
            results = SEED_EMAILS.filter(e =>
              e.sender?.toLowerCase().includes(contactEmail.toLowerCase()) ||
              e.recipient?.toLowerCase().includes(contactEmail.toLowerCase())
            )
          }
        }

        if (!cancelled) {
          setEmails(results)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    if (contactEmail) {
      fetchEmails()
    }

    return () => { cancelled = true }
  }, [contactEmail])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Derniers emails</h4>
          <span className="text-xs text-muted-foreground">({contactName})</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Fermer
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-2">
              <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Service de messagerie indisponible
        </div>
      ) : emails.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-muted-foreground">
          <Inbox className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Aucun email trouv&eacute; pour {contactEmail}</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1.5">
            {emails.map((email) => (
              <Link
                key={email.id}
                href={`/mail?id=${email.id}`}
                className="block p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-primary/20 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${email.is_read === false ? 'bg-primary' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate flex-1">
                        {email.subject || "(Sans objet)"}
                      </span>
                      {email.has_attachments && <span className="text-xs shrink-0">📎</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {email.sender === contactEmail ? `De: ${contactEmail}` : `A: ${email.recipient}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {email.received_at
                          ? formatDistanceToNow(new Date(email.received_at), { addSuffix: true, locale: fr })
                          : email.created_at
                            ? formatDistanceToNow(new Date(email.created_at), { addSuffix: true, locale: fr })
                            : ""
                        }
                      </span>
                    </div>
                    {email.snippet && (
                      <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
                        {email.snippet}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="pt-1">
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs"
          asChild
        >
          <Link href={`/mail?search=${encodeURIComponent(contactEmail)}`}>
            Voir tous les emails de {contactName}
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Seed emails for demo when mail service is unavailable
const SEED_EMAILS: Email[] = [
  {
    id: "seed-1",
    account_id: "demo",
    sender: "alice@example.com",
    sender_name: "Alice Martin",
    recipient: "me@company.com",
    subject: "Proposition commerciale Q2",
    snippet: "Bonjour, veuillez trouver ci-joint notre proposition...",
    is_read: true,
    received_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    has_attachments: true,
  },
  {
    id: "seed-2",
    account_id: "demo",
    sender: "bob@example.com",
    sender_name: "Bob Dupont",
    recipient: "me@company.com",
    subject: "Re: Reunion partenariat",
    snippet: "Parfait, je confirme ma presence pour jeudi.",
    is_read: false,
    received_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "seed-3",
    account_id: "demo",
    sender: "carol@example.com",
    sender_name: "Carol Blanc",
    recipient: "me@company.com",
    subject: "Demande d'information",
    snippet: "Pourriez-vous m'envoyer les details du projet ?",
    is_read: true,
    received_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
]
