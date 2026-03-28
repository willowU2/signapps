"use client"

// IDEA-262: Unified inbox multi-account — single view across all accounts

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Inbox, AtSign, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { mailApi, accountApi, type Email, type MailAccount } from "@/lib/api-mail"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"

interface UnifiedEmail extends Email {
  account_email: string
  account_color: string
  // Convenience aliases mapped from Email fields
  date?: string
  read?: boolean
  preview?: string
}

const ACCOUNT_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500",
  "bg-orange-500", "bg-pink-500", "bg-teal-500",
]

export function UnifiedInbox() {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [activeAccountIds, setActiveAccountIds] = useState<Set<string>>(new Set())
  const [emails, setEmails] = useState<UnifiedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedEmail, setSelectedEmail] = useState<UnifiedEmail | null>(null)

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    try {
      const accs = await accountApi.list()
      setAccounts(accs)
      setActiveAccountIds(new Set(accs.map((a: MailAccount) => a.id)))
      await loadEmails(accs.map((a: MailAccount) => a.id), accs)
    } catch {
      toast.error("Failed to load accounts")
    } finally {
      setLoading(false)
    }
  }

  async function loadEmails(accountIds: string[], accs: MailAccount[]) {
    try {
      const results = await Promise.all(
        accountIds.map(async (id, idx) => {
          const raw = await mailApi.list({ folder_type: "inbox", limit: 20, account_id: id })
          const acc = accs.find(a => a.id === id)
          return raw.map((e: Email) => ({
            ...e,
            account_email: acc?.email_address ?? id,
            account_color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length],
            date: e.received_at ?? e.created_at,
            read: e.is_read,
            preview: e.snippet ?? e.body_text?.slice(0, 80),
          }))
        })
      )
      const all = results.flat().sort(
        (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
      )
      setEmails(all)
    } catch {
      toast.error("Failed to load emails")
    }
  }

  const toggleAccount = useCallback(async (id: string, checked: boolean) => {
    const next = new Set(activeAccountIds)
    checked ? next.add(id) : next.delete(id)
    setActiveAccountIds(next)
    if (checked) await loadEmails([...next], accounts)
    else setEmails(prev => prev.filter(e => e.account_id !== id))
  }, [activeAccountIds, accounts])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const visibleEmails = emails.filter(e => activeAccountIds.has(e.account_id))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Unified Inbox</span>
          {visibleEmails.filter(e => !e.read).length > 0 && (
            <Badge variant="secondary">{visibleEmails.filter(e => !e.read).length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <AtSign className="h-3.5 w-3.5 mr-1" />
                Accounts <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show accounts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accounts.map((acc, idx) => (
                <DropdownMenuCheckboxItem
                  key={acc.id}
                  checked={activeAccountIds.has(acc.id)}
                  onCheckedChange={c => toggleAccount(acc.id, c)}
                >
                  <span className={cn("inline-block w-2 h-2 rounded-full mr-2", ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length])} />
                  {acc.email_address}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="icon" variant="ghost" onClick={() => loadEmails([...activeAccountIds], accounts)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
        {!loading && visibleEmails.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">All caught up!</p>
        )}
        {visibleEmails.map(email => (
          <div
            key={`${email.account_id}-${email.id}`}
            className={cn(
              "flex items-start gap-3 px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
              !email.read && "bg-blue-50/50 dark:bg-blue-950/20",
              selectedEmail?.id === email.id && "bg-muted"
            )}
            onClick={() => setSelectedEmail(email)}
          >
            <Checkbox
              checked={selectedIds.has(email.id)}
              onCheckedChange={() => toggleSelect(email.id)}
              onClick={e => e.stopPropagation()}
            />
            <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", email.account_color)} title={email.account_email} />
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="text-xs">
                {(email.sender_name ?? email.sender).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm truncate", !email.read && "font-semibold")}>
                  {email.sender_name ?? email.sender}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {email.date ? formatDistanceToNow(new Date(email.date), { addSuffix: true }) : ""}
                </span>
              </div>
              <p className={cn("text-sm truncate", !email.read && "font-medium")}>
                {email.subject ?? "(no subject)"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{email.preview ?? ""}</p>
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  )
}
