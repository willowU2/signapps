"use client"

// IDEA-269: Document merge fields — insert DB-backed variables into docs

import { useState, useEffect } from "react"
import { Database, Plus, Trash2, Code, RefreshCw, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type FieldSource = "contacts" | "deals" | "company" | "user" | "custom"

interface MergeField {
  id: string
  token: string        // e.g. {{contract.client_name}}
  label: string
  source: FieldSource
  db_field?: string    // e.g. contacts.full_name
  default_value?: string
}

const BUILT_IN_FIELDS: MergeField[] = [
  { id: "cf1", token: "{{contact.name}}", label: "Contact Name", source: "contacts", db_field: "contacts.full_name" },
  { id: "cf2", token: "{{contact.email}}", label: "Contact Email", source: "contacts", db_field: "contacts.email" },
  { id: "cf3", token: "{{contact.address}}", label: "Contact Address", source: "contacts", db_field: "contacts.address" },
  { id: "cf4", token: "{{company.name}}", label: "Company Name", source: "company", db_field: "companies.name" },
  { id: "cf5", token: "{{company.vat}}", label: "VAT Number", source: "company", db_field: "companies.vat_number" },
  { id: "cf6", token: "{{user.name}}", label: "User Full Name", source: "user", db_field: "users.full_name" },
  { id: "cf7", token: "{{user.email}}", label: "User Email", source: "user", db_field: "users.email" },
  { id: "cf8", token: "{{deal.amount}}", label: "Deal Amount", source: "deals", db_field: "deals.amount" },
  { id: "cf9", token: "{{deal.title}}", label: "Deal Title", source: "deals", db_field: "deals.title" },
]

const SOURCE_COLORS: Record<FieldSource, string> = {
  contacts: "bg-blue-100 text-blue-700",
  deals: "bg-green-100 text-green-700",
  company: "bg-purple-100 text-purple-700",
  user: "bg-orange-100 text-orange-700",
  custom: "bg-gray-100 text-gray-700",
}

interface DocMergeFieldsProps {
  onInsert: (token: string) => void
}

export function DocMergeFields({ onInsert }: DocMergeFieldsProps) {
  const [customFields, setCustomFields] = useState<MergeField[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ token: "", label: "", source: "custom" as FieldSource, default_value: "" })
  const [search, setSearch] = useState("")

  const allFields = [...BUILT_IN_FIELDS, ...customFields]
  const filtered = allFields.filter(f =>
    !search ||
    f.label.toLowerCase().includes(search.toLowerCase()) ||
    f.token.includes(search)
  )

  const grouped = (["contacts", "deals", "company", "user", "custom"] as FieldSource[]).map(src => ({
    source: src,
    fields: filtered.filter(f => f.source === src),
  })).filter(g => g.fields.length > 0)

  function addCustomField() {
    if (!form.token.startsWith("{{") || !form.token.endsWith("}}")) {
      toast.error("Token must be like {{field_name}}")
      return
    }
    const field: MergeField = { ...form, id: `custom_${Date.now()}` }
    setCustomFields(prev => [...prev, field])
    setForm({ token: "", label: "", source: "custom", default_value: "" })
    setAddOpen(false)
    toast.success("Custom field added")
  }

  function removeCustom(id: string) {
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  return (
    <Card className="w-72">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4" /> Merge Fields
        </CardTitle>
        <Input
          placeholder="Search fields…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs mt-1"
        />
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-72">
          {grouped.map(group => (
            <Collapsible key={group.source} defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 text-xs font-medium capitalize">
                {group.source} <ChevronRight className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {group.fields.map(field => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/30 cursor-pointer group"
                    onClick={() => { onInsert(field.token); toast.success(`Inserted ${field.token}`) }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{field.label}</p>
                      <code className="text-xs text-muted-foreground font-mono">{field.token}</code>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {field.source === "custom" && (
                        <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); removeCustom(field.id) }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                      <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </ScrollArea>
        <div className="border-t p-3">
          <Collapsible open={addOpen} onOpenChange={setAddOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Custom Field
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              <Input
                placeholder="{{my_field}}"
                value={form.token}
                onChange={e => setForm(p => ({ ...p, token: e.target.value }))}
                className="h-7 text-xs font-mono"
              />
              <Input
                placeholder="Display label"
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                className="h-7 text-xs"
              />
              <Input
                placeholder="Default value (optional)"
                value={form.default_value}
                onChange={e => setForm(p => ({ ...p, default_value: e.target.value }))}
                className="h-7 text-xs"
              />
              <Button size="sm" className="w-full" onClick={addCustomField}>Add</Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  )
}
