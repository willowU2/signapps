"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import type { FormField } from "@/lib/api/forms"

interface Condition {
  field_id: string
  operator: "equals" | "not_equals" | "contains"
  value: string
}

interface Props {
  field: FormField
  allFields: FormField[]
  onChange: (condition: Condition | undefined) => void
}

export function ConditionalLogicEditor({ field, allFields, onChange }: Props) {
  const condition = (field as any).show_if as Condition | undefined
  const eligible = allFields.filter(
    f => f.id !== field.id && (f.field_type === "SingleChoice" || f.field_type === "Text" || f.field_type === "Email")
  )

  const update = (patch: Partial<Condition>) => {
    const base: Condition = condition ?? { field_id: "", operator: "equals", value: "" }
    onChange({ ...base, ...patch })
  }

  if (eligible.length === 0)
    return <p className="text-xs text-muted-foreground">Aucun champ éligible pour une condition.</p>

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Afficher ce champ si…</Label>
        {condition && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onChange(undefined)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Select value={condition?.field_id ?? ""} onValueChange={v => update({ field_id: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Champ" />
          </SelectTrigger>
          <SelectContent>
            {eligible.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={condition?.operator ?? "equals"} onValueChange={v => update({ operator: v as Condition["operator"] })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">égal à</SelectItem>
            <SelectItem value="not_equals">différent de</SelectItem>
            <SelectItem value="contains">contient</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-8 text-xs"
          value={condition?.value ?? ""}
          placeholder="Valeur"
          onChange={e => update({ value: e.target.value })}
        />
      </div>
    </div>
  )
}
