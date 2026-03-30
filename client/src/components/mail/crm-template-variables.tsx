"use client"

// IDEA-267: Email template variables from CRM — merge contact data

import { useState, useEffect, useCallback } from "react"
import { Database, RefreshCw, Copy, Check, ChevronDown, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Available CRM variable tokens
export const CRM_VARIABLES = [
  { token: "{{contact.first_name}}", label: "First Name", example: "John" },
  { token: "{{contact.last_name}}", label: "Last Name", example: "Doe" },
  { token: "{{contact.full_name}}", label: "Full Name", example: "John Doe" },
  { token: "{{contact.email}}", label: "Email", example: "john@example.com" },
  { token: "{{contact.company}}", label: "Company", example: "Acme Corp" },
  { token: "{{contact.job_title}}", label: "Job Title", example: "CEO" },
  { token: "{{contact.phone}}", label: "Phone", example: "+33 6 00 00 00 00" },
  { token: "{{contact.city}}", label: "City", example: "Paris" },
  { token: "{{sender.name}}", label: "My Name", example: "Alice" },
  { token: "{{sender.signature}}", label: "My Signature", example: "Best, Alice" },
  { token: "{{date.today}}", label: "Today's Date", example: "March 28, 2026" },
  { token: "{{date.month}}", label: "Current Month", example: "March" },
]

interface CrmTemplateVariablesProps {
  body: string
  onBodyChange: (body: string) => void
  contactEmail?: string
}

interface ContactPreview {
  first_name?: string
  last_name?: string
  company?: string
  job_title?: string
  phone?: string
  city?: string
}

export function CrmTemplateVariables({ body, onBodyChange, contactEmail }: CrmTemplateVariablesProps) {
  const [contact, setContact] = useState<ContactPreview | null>(null)
  const [loadingContact, setLoadingContact] = useState(false)
  const [preview, setPreview] = useState("")
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (contactEmail) fetchContact(contactEmail)
  }, [contactEmail])

  useEffect(() => {
    setPreview(resolveVariables(body, contact))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, contact])

  async function fetchContact(email: string) {
    setLoadingContact(true)
    try {
      // Import contacts API lazily and filter by email
      const { contactsApi } = await import("@/lib/api/contacts")
      const results = await contactsApi.list()
      const matched = (results.data ?? []).find((c: { email?: string }) => c.email === email)
      if (matched) setContact(matched)
    } catch {
      // silent — preview just shows tokens
    } finally {
      setLoadingContact(false)
    }
  }

  function resolveVariables(text: string, c: ContactPreview | null): string {
    const now = new Date()
    const map: Record<string, string> = {
      "{{contact.first_name}}": c?.first_name ?? "{{first_name}}",
      "{{contact.last_name}}": c?.last_name ?? "{{last_name}}",
      "{{contact.full_name}}": [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "{{full_name}}",
      "{{contact.email}}": contactEmail ?? "{{email}}",
      "{{contact.company}}": c?.company ?? "{{company}}",
      "{{contact.job_title}}": c?.job_title ?? "{{job_title}}",
      "{{contact.phone}}": c?.phone ?? "{{phone}}",
      "{{contact.city}}": c?.city ?? "{{city}}",
      "{{sender.name}}": "{{sender_name}}",
      "{{sender.signature}}": "{{signature}}",
      "{{date.today}}": now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      "{{date.month}}": now.toLocaleDateString("en-US", { month: "long" }),
    }
    return Object.entries(map).reduce((s, [k, v]) => s.replaceAll(k, v), text)
  }

  function insertToken(token: string) {
    onBodyChange(body + token)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 1500)
  }

  const filtered = CRM_VARIABLES.filter(v =>
    !search || v.label.toLowerCase().includes(search.toLowerCase()) || v.token.includes(search)
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" /> CRM Variables
        </Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Insert Variable <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end">
            <div className="px-2 py-1.5">
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <DropdownMenuSeparator />
            <ScrollArea className="h-48">
              {filtered.map(v => (
                <DropdownMenuItem key={v.token} onClick={() => insertToken(v.token)} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">{v.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{v.token}</p>
                  </div>
                  {copiedToken === v.token
                    ? <Check className="h-3 w-3 text-green-500" />
                    : <Copy className="h-3 w-3 text-muted-foreground" />
                  }
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Textarea
        value={body}
        onChange={e => onBodyChange(e.target.value)}
        rows={6}
        placeholder="Type your email… Use Insert Variable to add CRM fields."
        className="font-mono text-sm"
      />

      {preview !== body && (
        <Card className="border-dashed">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3 w-3" />
              Preview {loadingContact && <span>(loading contact…)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-sm whitespace-pre-wrap">{preview}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
