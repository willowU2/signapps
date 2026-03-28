"use client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FormField } from "@/lib/api/forms"

interface Props {
  field: FormField
  onChange: (scores: Record<string, number>) => void
}

export function ScoringEditor({ field, onChange }: Props) {
  if (!field.options?.length) return null
  const scores = (field as any).scores as Record<string, number> ?? {}

  return (
    <div className="space-y-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 mt-3">
      <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">Points par option (Quiz)</Label>
      <div className="grid grid-cols-2 gap-2">
        {field.options.map(opt => (
          <div key={opt} className="flex items-center gap-2">
            <span className="text-xs truncate flex-1 text-muted-foreground" title={opt}>{opt}</span>
            <Input
              type="number"
              className="h-7 w-16 text-xs"
              value={scores[opt] ?? 0}
              onChange={e => onChange({ ...scores, [opt]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
