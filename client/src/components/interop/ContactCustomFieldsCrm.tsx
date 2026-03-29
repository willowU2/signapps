"use client"
// Feature 21: Contact custom fields → available in CRM deal form

import { useState, useEffect } from "react"
import { Settings2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface CustomFieldDef {
  id: string
  label: string
  type: "text" | "number" | "date" | "select"
  options?: string[]
  required?: boolean
}

interface CustomFieldValue {
  fieldId: string
  value: string
}

function loadContactCustomFields(): CustomFieldDef[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem("contacts:custom_fields") ?? "[]") as CustomFieldDef[]
  } catch { return [] }
}

function loadContactFieldValues(contactId: string): CustomFieldValue[] {
  if (typeof window === "undefined") return []
  try {
    const all = JSON.parse(localStorage.getItem("contacts:custom_field_values") ?? "[]") as (CustomFieldValue & { contactId: string })[]
    return all.filter(v => v.contactId === contactId)
  } catch { return [] }
}

interface Props {
  contactId?: string
  dealId?: string
  onCopyToDeal?: (fields: CustomFieldValue[]) => void
}

export function ContactCustomFieldsCrm({ contactId, dealId, onCopyToDeal }: Props) {
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [values, setValues] = useState<CustomFieldValue[]>([])
  const [crmValues, setCrmValues] = useState<Record<string, string>>({})

  useEffect(() => {
    const defs = loadContactCustomFields()
    setFields(defs)
    if (contactId) {
      setValues(loadContactFieldValues(contactId))
    }
    if (dealId) {
      try {
        const stored = JSON.parse(localStorage.getItem(`crm:deal_custom_fields:${dealId}`) ?? "{}") as Record<string, string>
        setCrmValues(stored)
      } catch { /* noop */ }
    }
  }, [contactId, dealId])

  const handleCrmValueChange = (fieldId: string, value: string) => {
    const next = { ...crmValues, [fieldId]: value }
    setCrmValues(next)
    if (dealId) {
      localStorage.setItem(`crm:deal_custom_fields:${dealId}`, JSON.stringify(next))
    }
  }

  const handleCopyFromContact = () => {
    if (!contactId) return
    const copied: CustomFieldValue[] = values
    const next: Record<string, string> = { ...crmValues }
    copied.forEach(v => { next[v.fieldId] = v.value })
    setCrmValues(next)
    if (dealId) {
      localStorage.setItem(`crm:deal_custom_fields:${dealId}`, JSON.stringify(next))
    }
    onCopyToDeal?.(copied)
    toast.success(`${copied.length} champ(s) copié(s) du contact.`)
  }

  if (fields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Aucun champ personnalisé défini.{" "}
        <a href="/contacts" className="text-primary hover:underline">Configurer dans Contacts.</a>
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Settings2 className="h-3 w-3" /> Champs personnalisés ({fields.length})
        </p>
        {contactId && values.length > 0 && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCopyFromContact}>
            <Copy className="h-3 w-3 mr-1" /> Copier du contact
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {fields.map(field => {
          const contactVal = values.find(v => v.fieldId === field.id)?.value ?? ""
          const crmVal = crmValues[field.id] ?? ""
          return (
            <div key={field.id} className="space-y-1">
              <Label className="text-xs">
                {field.label}
                {contactVal && crmVal !== contactVal && (
                  <span className="ml-1 text-amber-500 text-xs">(contact: {contactVal})</span>
                )}
              </Label>
              <Input
                value={crmVal}
                onChange={e => handleCrmValueChange(field.id, e.target.value)}
                placeholder={contactVal || `Valeur ${field.label.toLowerCase()}`}
                className="h-7 text-xs"
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
