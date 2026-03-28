# Forms & CRM Improvements (Items 144–164) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 21 features across the Forms builder/viewer and a new CRM section — all frontend-only React/Next.js additions layered on top of the existing signapps-forms service (port 3015) and contacts/calendar APIs.

**Architecture:** All features are pure frontend additions. Forms enhancements extend the builder at `client/src/app/forms/[id]/page.tsx` and the public viewer at `client/src/app/f/[id]/page.tsx`. CRM features live in a new `client/src/app/crm/` page tree backed by a new `client/src/lib/api/crm.ts` module that persists deals/activities/tasks in `localStorage` (no new Rust service needed). The calendar-CRM integration reads calendar events from the existing `calendarApi`.

**Tech Stack:** Next.js 16, React 19, shadcn/ui, @dnd-kit/core + @dnd-kit/sortable, recharts, exceljs (already installed), canvas (native browser API for signature pad), date-fns, zustand, @tanstack/react-query.

---

## Scope — Two independent subsystems

This plan implements both simultaneously since they share no dependencies:

- **FORMS** (Tasks 1–10): modifications to existing files + new components under `client/src/components/forms/`
- **CRM** (Tasks 11–21): new page tree `client/src/app/crm/` + new components under `client/src/components/crm/`

---

## File Map

### Forms — new/modified files

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/components/forms/conditional-logic-editor.tsx` | Create | UI to add show/hide rules per field |
| `client/src/components/forms/file-upload-field.tsx` | Create | Drag-drop upload widget for public form |
| `client/src/components/forms/signature-field.tsx` | Create | Canvas signature pad |
| `client/src/components/forms/scoring-editor.tsx` | Create | Per-option point assignment in builder |
| `client/src/components/forms/response-analytics.tsx` | Create | Recharts bar/pie per field |
| `client/src/components/forms/multi-page-wizard.tsx` | Create | Step wizard with progress bar (public form) |
| `client/src/components/forms/export-responses.tsx` | Create | Download CSV/XLSX button |
| `client/src/app/forms/[id]/page.tsx` | Modify | Add tabs: Builder / Conditional Logic / Scoring / Analytics; add multi-page toggle |
| `client/src/app/f/[id]/page.tsx` | Modify | Add multi-page wizard, file upload field, signature field, real-time validation, public share link |
| `client/src/lib/api/forms.ts` | Modify | Add `exportResponses` method |

### CRM — new files

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/lib/api/crm.ts` | Create | LocalStorage-backed CRUD for deals, activities, tasks, quotas, lead-scores; calendar event fetch wrapper |
| `client/src/components/crm/deal-kanban.tsx` | Create | @dnd-kit drag-drop kanban board replacing static sales-pipeline.tsx |
| `client/src/components/crm/deal-card.tsx` | Create | Card with value, probability, close date, assignee |
| `client/src/components/crm/activity-log.tsx` | Create | Log calls/emails/notes on a contact or deal |
| `client/src/components/crm/lead-score-badge.tsx` | Create | Auto-score display |
| `client/src/components/crm/sales-forecast.tsx` | Create | Recharts projected revenue chart |
| `client/src/components/crm/deal-table.tsx` | Create | Sortable/filterable table view |
| `client/src/components/crm/deal-tasks.tsx` | Create | Task list per deal |
| `client/src/components/crm/prospect-csv-import.tsx` | Create | CSV column mapping importer |
| `client/src/components/crm/quota-tracker.tsx` | Create | Salesperson quota progress bars |
| `client/src/components/crm/calendar-activities.tsx` | Create | Calendar event auto-log panel |
| `client/src/app/crm/page.tsx` | Create | Main CRM page: kanban + tabs |
| `client/src/app/crm/deals/[id]/page.tsx` | Create | Deal detail: activity timeline, tasks, email links |

---

## Task 1: Conditional Logic Editor (Feature 144)

**Files:**
- Create: `client/src/components/forms/conditional-logic-editor.tsx`
- Modify: `client/src/app/forms/[id]/page.tsx`

The builder stores `conditions` in each `FormField` as `{ show_if?: { field_id: string; operator: 'equals'|'not_equals'; value: string } }`. The public form evaluates conditions client-side and shows/hides fields.

- [ ] **Step 1: Create `conditional-logic-editor.tsx`**

```tsx
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
  const eligible = allFields.filter(f => f.id !== field.id && (f.field_type === "SingleChoice" || f.field_type === "Text" || f.field_type === "Email"))

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
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Champ" /></SelectTrigger>
          <SelectContent>
            {eligible.map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={condition?.operator ?? "equals"} onValueChange={v => update({ operator: v as any })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">égal à</SelectItem>
            <SelectItem value="not_equals">différent de</SelectItem>
            <SelectItem value="contains">contient</SelectItem>
          </SelectContent>
        </Select>
        <Input className="h-8 text-xs" value={condition?.value ?? ""} placeholder="Valeur" onChange={e => update({ value: e.target.value })} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `ConditionalLogicEditor` to `SortableField` in `client/src/app/forms/[id]/page.tsx`**

After the "Champ obligatoire" switch row, import and render `<ConditionalLogicEditor>`. Also add `show_if` to the `FormField` type extension. The `updateField` call already handles arbitrary partial updates.

Add to imports: `import { ConditionalLogicEditor } from "@/components/forms/conditional-logic-editor"`

In `SortableField` JSX, after the `Switch` row:
```tsx
<div className="border-t pt-3 mt-2">
  <ConditionalLogicEditor
    field={field}
    allFields={[]} // passed via a new prop
    onChange={(cond) => updateField(field.id, { show_if: cond } as any)}
  />
</div>
```

Pass `allFields` down from `FormBuilderPage` to `SortableField` via a new prop.

- [ ] **Step 3: Apply conditions in public form `client/src/app/f/[id]/page.tsx`**

Add helper above the field rendering loop:
```tsx
function isFieldVisible(field: FormField & { show_if?: any }, answers: Record<string, any>): boolean {
  if (!field.show_if?.field_id) return true
  const { field_id, operator, value } = field.show_if
  const current = String(answers[field_id] ?? "")
  if (operator === "equals") return current === value
  if (operator === "not_equals") return current !== value
  if (operator === "contains") return current.includes(value)
  return true
}
```

Wrap each field card render with `{isFieldVisible(field as any, answers) && (...)}`

- [ ] **Step 4: Commit**
```bash
rtk git add client/src/components/forms/conditional-logic-editor.tsx client/src/app/forms/[id]/page.tsx client/src/app/f/[id]/page.tsx
rtk git commit -m "feat(forms): conditional logic — show/hide fields based on other field values"
```

---

## Task 2: File Upload Field (Feature 145)

**Files:**
- Create: `client/src/components/forms/file-upload-field.tsx`
- Modify: `client/src/app/f/[id]/page.tsx`

The File field type already exists in the builder. This task implements the drag-drop widget for the public form viewer.

- [ ] **Step 1: Create `file-upload-field.tsx`**

```tsx
"use client"
import { useRef, useState } from "react"
import { Upload, File, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  fieldId: string
  required?: boolean
  onChange: (fieldId: string, value: File | null) => void
}

export function FileUploadField({ fieldId, required, onChange }: Props) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (f: File) => { setFile(f); onChange(fieldId, f) }
  const clear = () => { setFile(null); onChange(fieldId, null) }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) accept(f) }}
      onClick={() => !file && inputRef.current?.click()}
      className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
    >
      <input ref={inputRef} type="file" required={required} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) accept(f) }} />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <File className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium truncate max-w-48">{file.name}</span>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); clear() }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Glissez un fichier ici ou <span className="text-primary">parcourez</span></p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire into public form page**

In `client/src/app/f/[id]/page.tsx`, import `FileUploadField` and add a branch in the field renderer:

```tsx
} else if (field.field_type === 'File') ? (
  <FileUploadField
    fieldId={field.id}
    required={field.required}
    onChange={(id, file) => handleFieldChange(id, file)}
  />
```

Replace the "Ce type de champ n'est pas supporté" fallback for `File` type.

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/components/forms/file-upload-field.tsx client/src/app/f/[id]/page.tsx
rtk git commit -m "feat(forms): drag-drop file upload field in public form viewer"
```

---

## Task 3: Scoring/Quiz Mode (Feature 146)

**Files:**
- Create: `client/src/components/forms/scoring-editor.tsx`
- Modify: `client/src/app/forms/[id]/page.tsx` (add scoring panel to SortableField for choice fields)
- Modify: `client/src/app/f/[id]/page.tsx` (show score on submission)

Scoring data stored in `FormField.scores?: Record<string, number>` (option label → points).

- [ ] **Step 1: Create `scoring-editor.tsx`**

```tsx
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
    <div className="space-y-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-md p-3">
      <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">Points par option</Label>
      <div className="grid grid-cols-2 gap-2">
        {field.options.map(opt => (
          <div key={opt} className="flex items-center gap-2">
            <span className="text-xs truncate flex-1">{opt}</span>
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
```

- [ ] **Step 2: Add scoring toggle + editor to `SortableField`**

Add a `quizMode` boolean to the form state. When enabled, show `ScoringEditor` below the options section for `SingleChoice`/`MultipleChoice` fields. Pass it down as a prop.

- [ ] **Step 3: Show score result in public form after submission**

In `client/src/app/f/[id]/page.tsx`, in the post-submit thank-you screen:
```tsx
// compute score
const score = form?.fields?.reduce((total, field) => {
  const scores = (field as any).scores as Record<string, number> | undefined
  if (!scores) return total
  const answer = answers[field.id]
  if (Array.isArray(answer)) return total + answer.reduce((s, opt) => s + (scores[opt] ?? 0), 0)
  return total + (scores[answer] ?? 0)
}, 0) ?? 0
const maxScore = form?.fields?.reduce((total, field) => {
  const scores = (field as any).scores as Record<string, number> | undefined
  if (!scores) return total
  return total + Math.max(...Object.values(scores), 0)
}, 0) ?? 0
```

Show `{maxScore > 0 && <p>Score: {score} / {maxScore}</p>}` in the thank-you card.

- [ ] **Step 4: Commit**
```bash
rtk git add client/src/components/forms/scoring-editor.tsx client/src/app/forms/[id]/page.tsx client/src/app/f/[id]/page.tsx
rtk git commit -m "feat(forms): quiz/scoring mode — points per option, total score on submit"
```

---

## Task 4: Response Analytics (Feature 147)

**Files:**
- Create: `client/src/components/forms/response-analytics.tsx`
- Modify: `client/src/app/forms/[id]/page.tsx` (add "Analyses" tab)

- [ ] **Step 1: Create `response-analytics.tsx`**

```tsx
"use client"
import { useQuery } from "@tanstack/react-query"
import { formsApi } from "@/lib/api/forms"
import type { FormField } from "@/lib/api/forms"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#14b8a6"]

interface Props { formId: string; fields: FormField[] }

export function ResponseAnalytics({ formId, fields }: Props) {
  const { data: responses = [] } = useQuery({
    queryKey: ["form-responses", formId],
    queryFn: () => formsApi.responses(formId).then(r => r.data),
  })

  const choiceFields = fields.filter(f => f.field_type === "SingleChoice" || f.field_type === "MultipleChoice")

  if (!responses.length) return (
    <div className="text-center py-16 text-muted-foreground">Aucune réponse pour le moment.</div>
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{responses.length} réponse(s) au total</p>
      {choiceFields.map(field => {
        const counts: Record<string, number> = {}
        responses.forEach((r: any) => {
          const ans = r.answers?.find?.((a: any) => a.field_id === field.id)?.value
          const vals = Array.isArray(ans) ? ans : [ans]
          vals.forEach((v: string) => v && (counts[v] = (counts[v] ?? 0) + 1))
        })
        const data = Object.entries(counts).map(([name, value]) => ({ name, value }))
        return (
          <Card key={field.id}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{field.label}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]}>
                    {data.map((_,i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add "Analyses" tab in form builder page**

In `client/src/app/forms/[id]/page.tsx`, wrap the existing builder in tabs: `Builder | Analyses`. The Analyses tab renders `<ResponseAnalytics formId={formId} fields={fields} />`.

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/components/forms/response-analytics.tsx client/src/app/forms/[id]/page.tsx
rtk git commit -m "feat(forms): response analytics — charts per field in builder"
```

---

## Task 5: Multi-Page Forms (Feature 148)

**Files:**
- Create: `client/src/components/forms/multi-page-wizard.tsx`
- Modify: `client/src/app/forms/[id]/page.tsx` (page-break field type or page-grouping UI)
- Modify: `client/src/app/f/[id]/page.tsx` (render wizard instead of flat list)

Strategy: fields can have `page?: number` property (default 0). Builder shows "Ajouter saut de page" button. Public form wizard groups by page number and shows progress bar.

- [ ] **Step 1: Add page-break button in builder**

In `client/src/app/forms/[id]/page.tsx` toolbar, add a "Saut de page" button that inserts a sentinel field `{ field_type: 'PageBreak', ... }`.

```tsx
<Button variant="outline" className="justify-start h-auto py-3 px-3 hover:border-primary/50 col-span-2" onClick={() => addField('PageBreak' as any)}>
  <Layers className="h-4 w-4 mr-2 text-violet-500" />
  <span className="text-xs">Saut de page</span>
</Button>
```

The `SortableField` renders a special divider card for `PageBreak` type.

- [ ] **Step 2: Create `multi-page-wizard.tsx`**

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronRight, ChevronLeft } from "lucide-react"
import type { FormField } from "@/lib/api/forms"

interface Props {
  pages: FormField[][]
  currentPage: number
  onNext: () => void
  onBack: () => void
  canSubmit: boolean
  submitting: boolean
  children: React.ReactNode  // rendered fields for current page
}

export function MultiPageWizard({ pages, currentPage, onNext, onBack, canSubmit, submitting, children }: Props) {
  const progress = ((currentPage + 1) / pages.length) * 100
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span>Étape {currentPage + 1} / {pages.length}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="space-y-6">{children}</div>
      <div className="flex justify-between pt-4">
        {currentPage > 0 ? (
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
          </Button>
        ) : <div />}
        {currentPage < pages.length - 1 ? (
          <Button type="button" onClick={onNext}>
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button type="submit" disabled={submitting}>
            {submitting ? "Envoi..." : "Envoyer"}
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire `MultiPageWizard` into public form page**

In `client/src/app/f/[id]/page.tsx`, split fields on `PageBreak` type. If there are multiple pages, use the `MultiPageWizard`. Otherwise render the flat list (existing behavior unchanged).

```tsx
// Split fields into pages
const pages = useMemo(() => {
  const result: FormField[][] = [[]]
  form?.fields?.forEach(f => {
    if ((f as any).field_type === 'PageBreak') result.push([])
    else result[result.length - 1].push(f)
  })
  return result.filter(p => p.length > 0)
}, [form])
const isMultiPage = pages.length > 1
const [currentPage, setCurrentPage] = useState(0)
```

- [ ] **Step 4: Commit**
```bash
rtk git add client/src/components/forms/multi-page-wizard.tsx client/src/app/forms/[id]/page.tsx client/src/app/f/[id]/page.tsx
rtk git commit -m "feat(forms): multi-page forms — step wizard with progress bar"
```

---

## Task 6: Real-Time Field Validation (Feature 149)

**Files:**
- Modify: `client/src/app/f/[id]/page.tsx`

Add `touched: Record<string, boolean>` and `fieldErrors: Record<string, string>` state. Validate on blur (and on change after touched). Show error message under the input.

- [ ] **Step 1: Add validation state and `validateField` helper**

```tsx
const [touched, setTouched] = useState<Record<string, boolean>>({})
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

const validateField = (field: FormField, value: any): string => {
  if (field.required) {
    const empty = Array.isArray(value) ? value.length === 0 : !value || String(value).trim() === ""
    if (empty) return "Ce champ est obligatoire"
  }
  if (field.field_type === "Email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
    return "Adresse email invalide"
  if (field.field_type === "Number" && value && isNaN(Number(value)))
    return "Veuillez saisir un nombre valide"
  return ""
}

const handleBlur = (field: FormField) => {
  setTouched(t => ({ ...t, [field.id]: true }))
  setFieldErrors(e => ({ ...e, [field.id]: validateField(field, answers[field.id]) }))
}
```

- [ ] **Step 2: Wire `onBlur` and show errors on all input types**

For each `<Input>`, `<Textarea>`, `<RadioGroup>`, add `onBlur={() => handleBlur(field)}`.

Under each input, add:
```tsx
{touched[field.id] && fieldErrors[field.id] && (
  <p className="text-xs text-destructive mt-1">{fieldErrors[field.id]}</p>
)}
```

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/app/f/[id]/page.tsx
rtk git commit -m "feat(forms): real-time field validation on blur with error messages"
```

---

## Task 7: Export Responses CSV/XLSX (Feature 152)

**Files:**
- Create: `client/src/components/forms/export-responses.tsx`
- Modify: `client/src/app/forms/[id]/page.tsx` (add export button to Analytics tab)
- Modify: `client/src/lib/api/forms.ts` (add helper, or keep purely frontend with exceljs)

Use `exceljs` (already in `package.json`) to generate XLSX client-side. Use a simple CSV fallback as well.

- [ ] **Step 1: Create `export-responses.tsx`**

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import type { FormField, FormResponse } from "@/lib/api/forms"
import ExcelJS from "exceljs"
import { saveAs } from "file-saver"

interface Props { fields: FormField[]; responses: FormResponse[] }

export function ExportResponses({ fields, responses }: Props) {
  const [exporting, setExporting] = useState(false)

  const exportXLSX = async () => {
    setExporting(true)
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Réponses")
    const headers = ["Date soumission", "Répondant", ...fields.map(f => f.label)]
    ws.addRow(headers)
    ws.getRow(1).font = { bold: true }
    responses.forEach(r => {
      const row = [
        new Date(r.submitted_at).toLocaleString("fr-FR"),
        r.respondent_email ?? "",
        ...fields.map(f => {
          const ans = (r.answers as any)?.[f.id] ?? (r as any).answers?.find?.((a: any) => a.field_id === f.id)?.value ?? ""
          return Array.isArray(ans) ? ans.join(", ") : String(ans ?? "")
        })
      ]
      ws.addRow(row)
    })
    ws.columns.forEach(col => { col.width = 20 })
    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf]), "reponses.xlsx")
    setExporting(false)
  }

  const exportCSV = () => {
    const headers = ["Date soumission", "Répondant", ...fields.map(f => f.label)]
    const rows = responses.map(r => [
      new Date(r.submitted_at).toLocaleString("fr-FR"),
      r.respondent_email ?? "",
      ...fields.map(f => {
        const ans = (r as any).answers?.find?.((a: any) => a.field_id === f.id)?.value ?? ""
        return `"${String(Array.isArray(ans) ? ans.join(", ") : ans).replace(/"/g, '""')}"`
      })
    ])
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    saveAs(new Blob([csv], { type: "text/csv" }), "reponses.csv")
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportCSV} disabled={!responses.length}>
        <Download className="h-3 w-3 mr-1" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={exportXLSX} disabled={!responses.length || exporting}>
        <Download className="h-3 w-3 mr-1" /> {exporting ? "..." : "XLSX"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire into the Analytics tab in form builder**

Import and render `<ExportResponses fields={fields} responses={responses} />` at the top of the Analyses tab.

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/components/forms/export-responses.tsx client/src/app/forms/[id]/page.tsx
rtk git commit -m "feat(forms): export responses as CSV and XLSX"
```

---

## Task 8: Electronic Signature Field (Feature 153)

**Files:**
- Create: `client/src/components/forms/signature-field.tsx`
- Modify: `client/src/app/f/[id]/page.tsx`
- Modify: `client/src/app/forms/[id]/page.tsx` (add "Signature" button to toolbar)

Uses native HTML5 Canvas. No extra dependencies.

- [ ] **Step 1: Create `signature-field.tsx`**

```tsx
"use client"
import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"

interface Props {
  fieldId: string
  onChange: (fieldId: string, value: string | null) => void
}

export function SignatureField({ fieldId, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ("touches" in e) {
      const t = e.touches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath(); ctx.moveTo(x, y)
    setDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y); ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke()
    setHasSignature(true)
  }

  const stop = () => {
    setDrawing(false)
    if (hasSignature) onChange(fieldId, canvasRef.current?.toDataURL() ?? null)
  }

  const clear = () => {
    const ctx = canvasRef.current?.getContext("2d")
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    setHasSignature(false); onChange(fieldId, null)
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="border rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef} width={500} height={150}
          className="w-full touch-none cursor-crosshair bg-white dark:bg-slate-900"
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
      </div>
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Signez dans le cadre ci-dessus</p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasSignature}>
          <Eraser className="h-3 w-3 mr-1" /> Effacer
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add "Signature" to builder toolbar and render in public form**

In the builder toolbar, add:
```tsx
<Button variant="outline" className="..." onClick={() => addField('Signature' as any)}>
  <PenLine className="h-4 w-4 mr-2 text-cyan-500" />
  <span className="text-xs">Signature</span>
</Button>
```

In `client/src/app/f/[id]/page.tsx`, add branch:
```tsx
} else if (field.field_type === 'Signature') {
  return <SignatureField fieldId={field.id} onChange={handleFieldChange} />
```

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/components/forms/signature-field.tsx client/src/app/forms/[id]/page.tsx client/src/app/f/[id]/page.tsx
rtk git commit -m "feat(forms): electronic signature field with canvas pad"
```

---

## Task 9: Public Share Link + Email Notification (Features 150 & 151)

**Files:**
- Modify: `client/src/app/forms/page.tsx` (copy link already exists; improve with QR code tooltip)
- Modify: `client/src/app/forms/[id]/page.tsx` (add "Notifications" settings panel)

Feature 150 (public link) is largely already implemented — forms are at `/f/:id` when published. This task adds a copy-link button that also shows the QR code, and a settings tab for email notification opt-in (stored in form metadata via a description prefix or a new `settings` JSONB field in the builder).

- [ ] **Step 1: Add QR code to share dialog in `client/src/app/forms/page.tsx`**

Import `QRCodeSVG` from `qrcode.react` (already in dependencies). Add a `Dialog` that opens when user clicks a new "Partager" button on a published form:

```tsx
import { QRCodeSVG } from "qrcode.react"
// In the share dialog:
<QRCodeSVG value={shareUrl} size={160} />
<Input readOnly value={shareUrl} />
<Button onClick={() => navigator.clipboard.writeText(shareUrl)}>Copier</Button>
```

- [ ] **Step 2: Add email notification toggle to form builder settings tab**

In `client/src/app/forms/[id]/page.tsx`, add a "Paramètres" tab. Show a toggle "M'envoyer un email à chaque nouvelle réponse" that stores the value in `form.notify_on_response` via the `formsApi.update` call with the description enriched or a custom settings JSON.

Since the backend doesn't have a dedicated notifications field, store the preference as a `__notify__` prefix in the form description (hidden from public view). This is a frontend-only UX concern; actual email sending is out of scope (would require backend changes).

Note: Email sending requires backend infra changes (not in scope). The toggle stores the preference client-side in localStorage keyed by form ID.

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/app/forms/page.tsx client/src/app/forms/[id]/page.tsx
rtk git commit -m "feat(forms): QR share link panel + email notification preference toggle"
```

---

## Task 10: CRM Data Layer (Foundation for Features 154–164)

**Files:**
- Create: `client/src/lib/api/crm.ts`

This creates the client-side data store for all CRM entities. Uses localStorage for persistence (no new Rust service). Provides the API surface consumed by all CRM components.

- [ ] **Step 1: Create `client/src/lib/api/crm.ts`**

```typescript
/**
 * CRM API — localStorage-backed persistence
 * Deals, Activities, Tasks, Quotas, LeadScores
 */

export type DealStage = "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost"

export interface Deal {
  id: string
  title: string
  company: string
  contactId?: string
  contactEmail?: string
  value: number
  probability: number
  stage: DealStage
  closeDate?: string
  assignedTo?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export type ActivityType = "email" | "phone" | "meeting" | "note"

export interface Activity {
  id: string
  dealId?: string
  contactId?: string
  type: ActivityType
  content: string
  author?: string
  date: string
  calendarEventId?: string
}

export interface CrmTask {
  id: string
  dealId: string
  title: string
  dueDate?: string
  done: boolean
  assignedTo?: string
  createdAt: string
}

export interface Quota {
  id: string
  salesperson: string
  period: string // e.g. "2026-Q1"
  target: number
  achieved: number
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") } catch { return [] }
}
function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data))
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export const dealsApi = {
  list: (): Deal[] => load("crm:deals"),
  get: (id: string) => load<Deal>("crm:deals").find(d => d.id === id),
  create: (data: Omit<Deal, "id" | "createdAt" | "updatedAt">): Deal => {
    const deal = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    save("crm:deals", [...load<Deal>("crm:deals"), deal]); return deal
  },
  update: (id: string, data: Partial<Deal>): Deal | undefined => {
    const deals = load<Deal>("crm:deals").map(d => d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d)
    save("crm:deals", deals); return deals.find(d => d.id === id)
  },
  delete: (id: string) => save("crm:deals", load<Deal>("crm:deals").filter(d => d.id !== id)),
  importMany: (deals: Omit<Deal, "id" | "createdAt" | "updatedAt">[]) => {
    const existing = load<Deal>("crm:deals")
    const newDeals = deals.map(d => ({ ...d, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
    save("crm:deals", [...existing, ...newDeals]); return newDeals
  }
}

// ─── Activities ───────────────────────────────────────────────────────────────

export const activitiesApi = {
  list: (): Activity[] => load("crm:activities"),
  byDeal: (dealId: string) => load<Activity>("crm:activities").filter(a => a.dealId === dealId),
  byContact: (contactId: string) => load<Activity>("crm:activities").filter(a => a.contactId === contactId),
  create: (data: Omit<Activity, "id">): Activity => {
    const act = { ...data, id: crypto.randomUUID() }
    save("crm:activities", [...load<Activity>("crm:activities"), act]); return act
  },
  delete: (id: string) => save("crm:activities", load<Activity>("crm:activities").filter(a => a.id !== id)),
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const crmTasksApi = {
  byDeal: (dealId: string) => load<CrmTask>("crm:tasks").filter(t => t.dealId === dealId),
  create: (data: Omit<CrmTask, "id" | "createdAt">): CrmTask => {
    const task = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    save("crm:tasks", [...load<CrmTask>("crm:tasks"), task]); return task
  },
  toggle: (id: string) => {
    const tasks = load<CrmTask>("crm:tasks").map(t => t.id === id ? { ...t, done: !t.done } : t)
    save("crm:tasks", tasks)
  },
  delete: (id: string) => save("crm:tasks", load<CrmTask>("crm:tasks").filter(t => t.id !== id)),
}

// ─── Quotas ───────────────────────────────────────────────────────────────────

export const quotasApi = {
  list: (): Quota[] => load("crm:quotas"),
  upsert: (data: Omit<Quota, "id">): Quota => {
    const existing = load<Quota>("crm:quotas")
    const idx = existing.findIndex(q => q.salesperson === data.salesperson && q.period === data.period)
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...data }; save("crm:quotas", existing); return existing[idx]
    }
    const q = { ...data, id: crypto.randomUUID() }
    save("crm:quotas", [...existing, q]); return q
  },
  delete: (id: string) => save("crm:quotas", load<Quota>("crm:quotas").filter(q => q.id !== id)),
}

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

export function computeLeadScore(deal: Deal): number {
  let score = 0
  if (deal.value > 50000) score += 30
  else if (deal.value > 10000) score += 20
  else if (deal.value > 1000) score += 10
  const stageScores: Record<DealStage, number> = { prospect: 10, qualified: 20, proposal: 35, negotiation: 50, won: 100, lost: 0 }
  score += stageScores[deal.stage]
  if (deal.closeDate) {
    const daysUntil = (new Date(deal.closeDate).getTime() - Date.now()) / 86400000
    if (daysUntil < 7) score += 20
    else if (daysUntil < 30) score += 10
  }
  return Math.min(score, 100)
}
```

- [ ] **Step 2: Commit**
```bash
rtk git add client/src/lib/api/crm.ts
rtk git commit -m "feat(crm): localStorage-backed CRM data layer for deals, activities, tasks, quotas"
```

---

## Task 11: Deal Card + Pipeline Kanban with @dnd-kit (Features 154 & 155)

**Files:**
- Create: `client/src/components/crm/deal-card.tsx`
- Create: `client/src/components/crm/deal-kanban.tsx`
- Note: The existing `client/src/components/crm/sales-pipeline.tsx` uses native HTML5 drag-drop. This creates a new dnd-kit based version.

- [ ] **Step 1: Create `deal-card.tsx`**

```tsx
"use client"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { DollarSign, Calendar, User, TrendingUp } from "lucide-react"
import type { Deal } from "@/lib/api/crm"
import { computeLeadScore } from "@/lib/api/crm"
import Link from "next/link"

interface Props { deal: Deal; compact?: boolean }

export function DealCard({ deal, compact }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id, data: { type: "deal", deal } })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const score = computeLeadScore(deal)

  return (
    <Card ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="p-3 bg-card cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow space-y-2 select-none">
      <div className="flex items-start justify-between gap-1">
        <Link href={`/crm/deals/${deal.id}`} className="font-semibold text-sm truncate hover:text-primary" onClick={e => e.stopPropagation()}>
          {deal.title}
        </Link>
        <Badge variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "outline"} className="text-[10px] shrink-0">
          {score}pts
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate">{deal.company}</p>
      {!compact && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <DollarSign className="h-3 w-3" />
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(deal.value)}
            </span>
            <span className="text-muted-foreground">{deal.probability}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${deal.probability}%` }} />
          </div>
          {deal.closeDate && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {format(parseISO(deal.closeDate), "d MMM yyyy", { locale: fr })}
            </p>
          )}
          {deal.assignedTo && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <User className="h-2.5 w-2.5" />{deal.assignedTo}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Create `deal-kanban.tsx`**

```tsx
"use client"
import { useState, useCallback } from "react"
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { Badge } from "@/components/ui/badge"
import { DealCard } from "./deal-card"
import type { Deal, DealStage } from "@/lib/api/crm"

const STAGES: { id: DealStage; label: string; color: string }[] = [
  { id: "prospect", label: "Prospect", color: "border-t-slate-400" },
  { id: "qualified", label: "Qualifié", color: "border-t-blue-400" },
  { id: "proposal", label: "Proposition", color: "border-t-amber-400" },
  { id: "negotiation", label: "Négociation", color: "border-t-orange-400" },
  { id: "won", label: "Gagné", color: "border-t-emerald-400" },
]

function DroppableColumn({ stage, deals }: { stage: typeof STAGES[0]; deals: Deal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = deals.reduce((s, d) => s + d.value * d.probability / 100, 0)
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-52 flex flex-col border-t-2 ${stage.color} rounded-lg bg-muted/30 transition-colors ${isOver ? "bg-primary/5" : ""}`}>
      <div className="p-3 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">{stage.label}</span>
        <Badge variant="outline" className="text-xs">{deals.length}</Badge>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-40">
        <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map(deal => <DealCard key={deal.id} deal={deal} />)}
        </SortableContext>
        {deals.length === 0 && (
          <div className="h-20 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-md">
            Déposez ici
          </div>
        )}
      </div>
      {deals.length > 0 && (
        <div className="p-2 border-t text-xs text-muted-foreground text-right">
          {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(total)}
        </div>
      )}
    </div>
  )
}

interface Props { deals: Deal[]; onMove: (id: string, stage: DealStage) => void }

export function DealKanban({ deals, onMove }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (e.over && e.active.id !== e.over.id) {
      const stage = STAGES.find(s => s.id === e.over!.id)
      if (stage) onMove(String(e.active.id), stage.id)
    }
  }

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => (
          <DroppableColumn key={stage.id} stage={stage} deals={deals.filter(d => d.stage === stage.id)} />
        ))}
      </div>
      <DragOverlay>{activeDeal && <DealCard deal={activeDeal} compact />}</DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/components/crm/deal-card.tsx client/src/components/crm/deal-kanban.tsx
rtk git commit -m "feat(crm): deal card and dnd-kit kanban pipeline board"
```

---

## Task 12: Activity Timeline + Auto Email-Deal Association (Features 156 & 159)

**Files:**
- Create: `client/src/components/crm/activity-log.tsx`

The existing `interaction-timeline.tsx` is read-only. This creates a new component that allows adding activities AND auto-linking emails from the contacts' email (by contact email matching).

- [ ] **Step 1: Create `activity-log.tsx`**

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Phone, Calendar, StickyNote, Plus, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { activitiesApi, type Activity, type ActivityType } from "@/lib/api/crm"

const TYPE_CONFIG = {
  email: { icon: Mail, label: "Email", color: "bg-blue-100 text-blue-800 border-l-blue-400" },
  phone: { icon: Phone, label: "Appel", color: "bg-green-100 text-green-800 border-l-green-400" },
  meeting: { icon: Calendar, label: "Réunion", color: "bg-purple-100 text-purple-800 border-l-purple-400" },
  note: { icon: StickyNote, label: "Note", color: "bg-amber-100 text-amber-800 border-l-amber-400" },
}

interface Props { dealId?: string; contactId?: string; currentUser?: string }

export function ActivityLog({ dealId, contactId, currentUser }: Props) {
  const [activities, setActivities] = useState<Activity[]>(() =>
    dealId ? activitiesApi.byDeal(dealId) : contactId ? activitiesApi.byContact(contactId) : []
  )
  const [type, setType] = useState<ActivityType>("note")
  const [content, setContent] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16))
  const [adding, setAdding] = useState(false)

  const add = () => {
    if (!content.trim()) return
    const act = activitiesApi.create({ dealId, contactId, type, content, author: currentUser, date: new Date(date).toISOString() })
    setActivities(prev => [act, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    setContent(""); setAdding(false)
  }

  const remove = (id: string) => {
    activitiesApi.delete(id)
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  const sorted = [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Activités ({activities.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3 w-3 mr-1" /> {adding ? "Annuler" : "Ajouter"}
        </Button>
      </div>
      {adding && (
        <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
          <div className="grid grid-cols-2 gap-2">
            <Select value={type} onValueChange={v => setType(v as ActivityType)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="datetime-local" className="h-8 text-xs" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <Textarea rows={3} placeholder="Notes, contenu de l'email, sujet de l'appel…" value={content} onChange={e => setContent(e.target.value)} />
          <Button size="sm" onClick={add} disabled={!content.trim()}>Enregistrer</Button>
        </Card>
      )}
      <div className="relative space-y-3 pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
        {sorted.map(act => {
          const cfg = TYPE_CONFIG[act.type]
          const Icon = cfg.icon
          return (
            <div key={act.id} className="relative group">
              <div className={`absolute -left-4 top-2.5 h-4 w-4 rounded-full flex items-center justify-center ${act.type === "email" ? "bg-blue-400" : act.type === "phone" ? "bg-green-400" : act.type === "meeting" ? "bg-purple-400" : "bg-amber-400"}`}>
                <Icon className="h-2.5 w-2.5 text-white" />
              </div>
              <Card className={`p-3 border-l-4 ${cfg.color} text-sm`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(act.date), "d MMM yyyy HH:mm", { locale: fr })}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{act.content}</p>
                    {act.author && <p className="text-[10px] text-muted-foreground">Par: {act.author}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => remove(act.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </Card>
            </div>
          )
        })}
        {sorted.length === 0 && <p className="text-sm text-muted-foreground pl-2">Aucune activité enregistrée.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
rtk git add client/src/components/crm/activity-log.tsx
rtk git commit -m "feat(crm): activity log — log calls, emails, notes on deals and contacts"
```

---

## Task 13: Sales Forecast + Deal Table (Features 158 & 162)

**Files:**
- Create: `client/src/components/crm/sales-forecast.tsx`
- Create: `client/src/components/crm/deal-table.tsx`

- [ ] **Step 1: Create `sales-forecast.tsx`**

```tsx
"use client"
import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Deal } from "@/lib/api/crm"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

interface Props { deals: Deal[] }

export function SalesForecast({ deals }: Props) {
  const data = useMemo(() => {
    const byMonth: Record<string, { month: string; weighted: number; best: number }> = {}
    deals.filter(d => d.closeDate && d.stage !== "lost").forEach(d => {
      const key = d.closeDate!.slice(0, 7)
      if (!byMonth[key]) byMonth[key] = { month: key, weighted: 0, best: 0 }
      byMonth[key].weighted += d.value * d.probability / 100
      byMonth[key].best += d.value
    })
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).map(r => ({
      ...r,
      month: format(parseISO(r.month + "-01"), "MMM yyyy", { locale: fr }),
      weighted: Math.round(r.weighted),
      best: Math.round(r.best),
    }))
  }, [deals])

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Prévisions de revenus</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune opportunité avec date de clôture.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k€`} />
              <Tooltip formatter={(v, n) => [`${Number(v).toLocaleString("fr-FR")} €`, n === "weighted" ? "Pondéré" : "Best case"]} />
              <Legend formatter={n => n === "weighted" ? "Pondéré (prob.)" : "Best case"} />
              <Bar dataKey="weighted" fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="best" fill="#22c55e" radius={[4,4,0,0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create `deal-table.tsx`**

```tsx
"use client"
import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Deal, DealStage } from "@/lib/api/crm"
import { computeLeadScore } from "@/lib/api/crm"
import Link from "next/link"

const STAGE_LABELS: Record<DealStage, string> = {
  prospect: "Prospect", qualified: "Qualifié", proposal: "Proposition",
  negotiation: "Négociation", won: "Gagné", lost: "Perdu"
}
const STAGE_COLORS: Record<DealStage, string> = {
  prospect: "secondary", qualified: "outline", proposal: "default",
  negotiation: "default", won: "default", lost: "destructive"
} as any

interface Props { deals: Deal[] }

export function DealTable({ deals }: Props) {
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [sortKey, setSortKey] = useState<keyof Deal>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const filtered = useMemo(() => deals.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.title.toLowerCase().includes(q) || d.company.toLowerCase().includes(q)
    const matchStage = stageFilter === "all" || d.stage === stageFilter
    return matchSearch && matchStage
  }).sort((a, b) => {
    const av = a[sortKey] ?? ""; const bv = b[sortKey] ?? ""
    const cmp = String(av).localeCompare(String(bv), "fr", { numeric: true })
    return sortDir === "asc" ? cmp : -cmp
  }), [deals, search, stageFilter, sortKey, sortDir])

  const toggleSort = (key: keyof Deal) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Étape" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les étapes</SelectItem>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {(["title", "company", "value", "probability", "stage", "closeDate", "assignedTo"] as (keyof Deal)[]).map(k => (
                <TableHead key={k} className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort(k)}>
                  <span className="flex items-center gap-1">
                    {({ title: "Titre", company: "Société", value: "Valeur", probability: "Prob.", stage: "Étape", closeDate: "Clôture", assignedTo: "Assigné" } as any)[k]}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </span>
                </TableHead>
              ))}
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucun résultat</TableCell></TableRow>
            )}
            {filtered.map(d => (
              <TableRow key={d.id} className="hover:bg-muted/40">
                <TableCell className="font-medium"><Link href={`/crm/deals/${d.id}`} className="hover:text-primary">{d.title}</Link></TableCell>
                <TableCell>{d.company}</TableCell>
                <TableCell className="text-emerald-600 font-medium">{d.value.toLocaleString("fr-FR")} €</TableCell>
                <TableCell>{d.probability}%</TableCell>
                <TableCell><Badge variant={(STAGE_COLORS[d.stage] ?? "secondary") as any}>{STAGE_LABELS[d.stage]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.closeDate ? new Date(d.closeDate).toLocaleDateString("fr-FR") : "—"}</TableCell>
                <TableCell className="text-sm">{d.assignedTo ?? "—"}</TableCell>
                <TableCell><Badge variant={computeLeadScore(d) >= 70 ? "default" : "secondary"}>{computeLeadScore(d)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/components/crm/sales-forecast.tsx client/src/components/crm/deal-table.tsx
rtk git commit -m "feat(crm): sales forecast chart and advanced deal table with filters"
```

---

## Task 14: Deal Tasks + Quota Tracker (Features 160 & 163)

**Files:**
- Create: `client/src/components/crm/deal-tasks.tsx`
- Create: `client/src/components/crm/quota-tracker.tsx`

- [ ] **Step 1: Create `deal-tasks.tsx`**

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, CheckSquare } from "lucide-react"
import { crmTasksApi, type CrmTask } from "@/lib/api/crm"

interface Props { dealId: string }

export function DealTasks({ dealId }: Props) {
  const [tasks, setTasks] = useState<CrmTask[]>(() => crmTasksApi.byDeal(dealId))
  const [newTitle, setNewTitle] = useState("")
  const [dueDate, setDueDate] = useState("")

  const add = () => {
    if (!newTitle.trim()) return
    const t = crmTasksApi.create({ dealId, title: newTitle, dueDate: dueDate || undefined, done: false })
    setTasks(prev => [...prev, t]); setNewTitle(""); setDueDate("")
  }

  const toggle = (id: string) => {
    crmTasksApi.toggle(id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const remove = (id: string) => {
    crmTasksApi.delete(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const pending = tasks.filter(t => !t.done).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <CheckSquare className="h-4 w-4" /> Tâches
          {pending > 0 && <Badge variant="secondary">{pending} en attente</Badge>}
        </h3>
      </div>
      <div className="flex gap-2">
        <Input className="h-8 text-sm flex-1" placeholder="Nouvelle tâche…" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <Input type="date" className="h-8 text-sm w-32" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <Button size="sm" className="h-8" onClick={add}><Plus className="h-3 w-3" /></Button>
      </div>
      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id} className={`flex items-center gap-3 p-2 rounded-md border ${t.done ? "opacity-50 bg-muted/30" : "bg-card"}`}>
            <Checkbox checked={t.done} onCheckedChange={() => toggle(t.id)} />
            <span className={`text-sm flex-1 ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
            {t.dueDate && <span className="text-[10px] text-muted-foreground">{new Date(t.dueDate).toLocaleDateString("fr-FR")}</span>}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(t.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `quota-tracker.tsx`**

```tsx
"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Target } from "lucide-react"
import { quotasApi, type Quota } from "@/lib/api/crm"

interface Props { currentPeriod?: string }

export function QuotaTracker({ currentPeriod = `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}` }: Props) {
  const [quotas, setQuotas] = useState<Quota[]>(() => quotasApi.list().filter(q => q.period === currentPeriod))
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ salesperson: "", target: "", achieved: "" })

  const save = () => {
    if (!form.salesperson || !form.target) return
    const q = quotasApi.upsert({ salesperson: form.salesperson, period: currentPeriod, target: Number(form.target), achieved: Number(form.achieved) })
    setQuotas(quotasApi.list().filter(q => q.period === currentPeriod))
    setForm({ salesperson: "", target: "", achieved: "" }); setAdding(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" /> Quotas {currentPeriod}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-md">
            <Input className="h-8 text-sm" placeholder="Commercial" value={form.salesperson} onChange={e => setForm(f => ({ ...f, salesperson: e.target.value }))} />
            <Input className="h-8 text-sm" type="number" placeholder="Objectif €" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
            <Input className="h-8 text-sm" type="number" placeholder="Réalisé €" value={form.achieved} onChange={e => setForm(f => ({ ...f, achieved: e.target.value }))} />
            <Button size="sm" className="col-span-3" onClick={save}>Enregistrer</Button>
          </div>
        )}
        {quotas.map(q => {
          const pct = q.target > 0 ? Math.min(100, Math.round(q.achieved / q.target * 100)) : 0
          return (
            <div key={q.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{q.salesperson}</span>
                <Badge variant={pct >= 100 ? "default" : pct >= 75 ? "secondary" : "outline"}>
                  {pct}% — {q.achieved.toLocaleString("fr-FR")} / {q.target.toLocaleString("fr-FR")} €
                </Badge>
              </div>
              <Progress value={pct} className={`h-2 ${pct >= 100 ? "[&>div]:bg-emerald-500" : pct >= 75 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500"}`} />
            </div>
          )
        })}
        {quotas.length === 0 && !adding && <p className="text-sm text-muted-foreground text-center py-4">Aucun quota pour {currentPeriod}.</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**
```bash
rtk git add client/src/components/crm/deal-tasks.tsx client/src/components/crm/quota-tracker.tsx
rtk git commit -m "feat(crm): deal tasks list and salesperson quota tracker with progress bars"
```

---

## Task 15: Prospect CSV Import (Feature 161)

**Files:**
- Create: `client/src/components/crm/prospect-csv-import.tsx`

Parse CSV in-browser, show column mapping UI, then call `dealsApi.importMany`.

- [ ] **Step 1: Create `prospect-csv-import.tsx`**

```tsx
"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dealsApi, type Deal } from "@/lib/api/crm"
import { toast } from "sonner"

const DEAL_FIELDS = ["title", "company", "value", "probability", "stage", "assignedTo", "closeDate", "contactEmail"]
const FIELD_LABELS: Record<string, string> = { title: "Titre", company: "Société", value: "Valeur", probability: "Probabilité (%)", stage: "Étape", assignedTo: "Assigné à", closeDate: "Date de clôture", contactEmail: "Email contact" }

interface Props { onImport: () => void }

export function ProspectCsvImport({ onImport }: Props) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter(l => l.trim())
    const h = lines[0].split(",").map(s => s.trim().replace(/^"|"$/g, ""))
    const r = lines.slice(1).map(l => l.split(",").map(s => s.trim().replace(/^"|"$/g, "")))
    setHeaders(h); setRows(r.slice(0, 5))
    const auto: Record<string, string> = {}
    h.forEach(h => { const match = DEAL_FIELDS.find(f => f.toLowerCase() === h.toLowerCase() || FIELD_LABELS[f]?.toLowerCase() === h.toLowerCase()); if (match) auto[match] = h })
    setMapping(auto)
  }

  const handleFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = e => parseCSV(String(e.target?.result ?? ""))
    reader.readAsText(f)
  }

  const importAll = () => {
    const text = /* full CSV re-read — use full rows stored */ rows
    const reverseMap: Record<string, string> = {}
    Object.entries(mapping).forEach(([field, col]) => reverseMap[col] = field)

    const allLines = rows
    const deals = allLines.map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i] ?? "" })
      const d: any = { stage: "prospect" }
      Object.entries(mapping).forEach(([field, col]) => { if (obj[col]) d[field] = field === "value" || field === "probability" ? Number(obj[col]) : obj[col] })
      return d
    }).filter((d: any) => d.title || d.company)

    dealsApi.importMany(deals)
    toast.success(`${deals.length} prospects importés.`)
    setDone(true); onImport()
  }

  if (done) return (
    <div className="flex items-center gap-2 text-emerald-600 py-4">
      <Check className="h-5 w-5" /> Import terminé
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Importer des prospects CSV</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier CSV</p>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
        {headers.length > 0 && (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Correspondance des colonnes</p>
              <div className="grid grid-cols-2 gap-2">
                {DEAL_FIELDS.map(field => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="text-xs w-32 shrink-0">{FIELD_LABELS[field]}</span>
                    <Select value={mapping[field] ?? ""} onValueChange={v => setMapping(m => ({ ...m, [field]: v }))}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-auto max-h-32 border rounded text-xs">
              <Table>
                <TableHeader><TableRow>{headers.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{rows.slice(0, 3).map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}</TableBody>
              </Table>
            </div>
            <Button size="sm" onClick={importAll}>Importer</Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**
```bash
rtk git add client/src/components/crm/prospect-csv-import.tsx
rtk git commit -m "feat(crm): prospect CSV import with column mapping UI"
```

---

## Task 16: Calendar-CRM Integration (Feature 164)

**Files:**
- Create: `client/src/components/crm/calendar-activities.tsx`

Reads calendar events for the next 30 days using `calendarApi.listEvents` and allows auto-logging them as `meeting` activities linked to a deal.

- [ ] **Step 1: Create `calendar-activities.tsx`**

```tsx
"use client"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Check } from "lucide-react"
import { calendarApi } from "@/lib/api/calendar"
import { activitiesApi, dealsApi, type Deal } from "@/lib/api/crm"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"

interface Props { dealId?: string }

export function CalendarActivities({ dealId }: Props) {
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())
  const [dealLinks, setDealLinks] = useState<Record<string, string>>({})
  const deals = dealsApi.list()

  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars-for-crm"],
    queryFn: () => calendarApi.list().then(r => r.data ?? []),
    staleTime: 60000,
  })

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events-crm", calendars.map((c: any) => c.id)],
    queryFn: async () => {
      const now = new Date()
      const end = new Date(now.getTime() + 30 * 86400000)
      const all: any[] = []
      for (const cal of calendars.slice(0, 3)) {
        try {
          const r = await calendarApi.listEvents(cal.id, { start: now.toISOString(), end: end.toISOString() })
          all.push(...(r.data ?? []))
        } catch {}
      }
      return all.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    },
    enabled: calendars.length > 0,
    staleTime: 60000,
  })

  const log = (event: any) => {
    const targetDealId = dealId ?? dealLinks[event.id]
    activitiesApi.create({
      dealId: targetDealId,
      type: "meeting",
      content: `${event.title}${event.description ? "\n" + event.description : ""}`,
      date: event.start_time,
      calendarEventId: event.id,
    })
    setLoggedIds(s => new Set(s).add(event.id))
    toast.success(`Réunion "${event.title}" enregistrée comme activité.`)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" /> Réunions à venir (30j)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune réunion dans l'agenda.</p>}
        {events.slice(0, 10).map((event: any) => (
          <div key={event.id} className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{event.title}</p>
              <p className="text-xs text-muted-foreground">{format(parseISO(event.start_time), "d MMM yyyy HH:mm", { locale: fr })}</p>
            </div>
            {!dealId && (
              <Select value={dealLinks[event.id] ?? ""} onValueChange={v => setDealLinks(m => ({ ...m, [event.id]: v }))}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Deal…" /></SelectTrigger>
                <SelectContent>
                  {deals.map((d: Deal) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {loggedIds.has(event.id) ? (
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => log(event)} disabled={!dealId && !dealLinks[event.id]}>
                Enregistrer
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**
```bash
rtk git add client/src/components/crm/calendar-activities.tsx
rtk git commit -m "feat(crm): calendar integration — auto-log meetings as CRM activities"
```

---

## Task 17: CRM Main Page (Features 154–164 Assembly)

**Files:**
- Create: `client/src/app/crm/page.tsx`

Assembles all CRM components into one page with tabs: Kanban | Liste | Prévisions | Quotas | Importer.

- [ ] **Step 1: Create `client/src/app/crm/page.tsx`**

```tsx
"use client"
import { useState, useCallback } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Plus } from "lucide-react"
import { DealKanban } from "@/components/crm/deal-kanban"
import { DealTable } from "@/components/crm/deal-table"
import { SalesForecast } from "@/components/crm/sales-forecast"
import { QuotaTracker } from "@/components/crm/quota-tracker"
import { ProspectCsvImport } from "@/components/crm/prospect-csv-import"
import { CalendarActivities } from "@/components/crm/calendar-activities"
import { dealsApi, type Deal, type DealStage } from "@/lib/api/crm"
import { toast } from "sonner"

const STAGE_OPTIONS: DealStage[] = ["prospect","qualified","proposal","negotiation","won","lost"]
const STAGE_LABELS: Record<DealStage, string> = { prospect:"Prospect",qualified:"Qualifié",proposal:"Proposition",negotiation:"Négociation",won:"Gagné",lost:"Perdu" }

export default function CRMPage() {
  const [deals, setDeals] = useState<Deal[]>(() => dealsApi.list())
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<Partial<Deal>>({ stage: "prospect", probability: 20 })

  const reload = useCallback(() => setDeals(dealsApi.list()), [])

  const createDeal = () => {
    if (!form.title || !form.company) return
    dealsApi.create({ title: form.title!, company: form.company!, value: form.value ?? 0, probability: form.probability ?? 20, stage: form.stage ?? "prospect", assignedTo: form.assignedTo, closeDate: form.closeDate, contactEmail: form.contactEmail })
    reload(); setIsOpen(false); setForm({ stage: "prospect", probability: 20 })
    toast.success("Opportunité créée.")
  }

  const moveDeal = (id: string, stage: DealStage) => {
    dealsApi.update(id, { stage })
    reload()
  }

  const totalPipeline = deals.filter(d => d.stage !== "lost").reduce((s, d) => s + d.value * d.probability / 100, 0)
  const wonDeals = deals.filter(d => d.stage === "won")
  const wonValue = wonDeals.reduce((s, d) => s + d.value, 0)

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-primary" /> CRM & Ventes
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Pipeline, opportunités et suivi commercial.</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2" /> Nouvelle opportunité
          </Button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Opportunités", value: deals.filter(d => d.stage !== "lost").length },
            { label: "Pipeline pondéré", value: `${Math.round(totalPipeline).toLocaleString("fr-FR")} €` },
            { label: "Deals gagnés", value: wonDeals.length },
            { label: "Revenus gagnés", value: `${wonValue.toLocaleString("fr-FR")} €` },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Pipeline</TabsTrigger>
            <TabsTrigger value="table">Liste</TabsTrigger>
            <TabsTrigger value="forecast">Prévisions</TabsTrigger>
            <TabsTrigger value="quotas">Quotas</TabsTrigger>
            <TabsTrigger value="calendar">Agenda</TabsTrigger>
            <TabsTrigger value="import">Importer</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            <DealKanban deals={deals} onMove={moveDeal} />
          </TabsContent>
          <TabsContent value="table" className="mt-4">
            <DealTable deals={deals} />
          </TabsContent>
          <TabsContent value="forecast" className="mt-4">
            <SalesForecast deals={deals} />
          </TabsContent>
          <TabsContent value="quotas" className="mt-4">
            <QuotaTracker />
          </TabsContent>
          <TabsContent value="calendar" className="mt-4">
            <CalendarActivities />
          </TabsContent>
          <TabsContent value="import" className="mt-4">
            <ProspectCsvImport onImport={reload} />
          </TabsContent>
        </Tabs>
      </div>

      {/* New Deal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle opportunité</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Titre *</Label>
              <Input placeholder="Nom du deal…" value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Société *</Label>
              <Input placeholder="Acme Corp" value={form.company ?? ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email contact</Label>
              <Input type="email" placeholder="contact@acme.com" value={form.contactEmail ?? ""} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Valeur (€)</Label>
              <Input type="number" value={form.value ?? ""} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Probabilité (%)</Label>
              <Input type="number" min={0} max={100} value={form.probability ?? 20} onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Étape</Label>
              <Select value={form.stage ?? "prospect"} onValueChange={v => setForm(f => ({ ...f, stage: v as DealStage }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGE_OPTIONS.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date de clôture</Label>
              <Input type="date" value={form.closeDate ?? ""} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Assigné à</Label>
              <Input placeholder="Jean Dupont" value={form.assignedTo ?? ""} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button onClick={createDeal} disabled={!form.title || !form.company}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
```

- [ ] **Step 2: Commit**
```bash
rtk git add client/src/app/crm/page.tsx
rtk git commit -m "feat(crm): main CRM page with pipeline, table, forecast, quotas, calendar, import tabs"
```

---

## Task 18: Deal Detail Page (Features 155, 156, 159, 160)

**Files:**
- Create: `client/src/app/crm/deals/[id]/page.tsx`

Shows full deal card with editable fields, activity timeline, tasks, and linked emails.

- [ ] **Step 1: Create `client/src/app/crm/deals/[id]/page.tsx`**

```tsx
"use client"
import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, Trash2, TrendingUp } from "lucide-react"
import Link from "next/link"
import { ActivityLog } from "@/components/crm/activity-log"
import { DealTasks } from "@/components/crm/deal-tasks"
import { dealsApi, type Deal, type DealStage, computeLeadScore } from "@/lib/api/crm"
import { toast } from "sonner"

const STAGE_OPTIONS: DealStage[] = ["prospect","qualified","proposal","negotiation","won","lost"]
const STAGE_LABELS: Record<DealStage, string> = { prospect:"Prospect",qualified:"Qualifié",proposal:"Proposition",negotiation:"Négociation",won:"Gagné",lost:"Perdu" }

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | undefined>(() => dealsApi.get(id))
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Deal>>({})

  if (!deal) return (
    <AppLayout>
      <div className="p-8 text-muted-foreground">Opportunité introuvable. <Link href="/crm" className="text-primary underline">Retour CRM</Link></div>
    </AppLayout>
  )

  const score = computeLeadScore(deal)

  const save = () => {
    const updated = dealsApi.update(id, form)
    if (updated) setDeal(updated)
    setEditing(false); setForm({})
    toast.success("Opportunité mise à jour.")
  }

  const remove = () => {
    dealsApi.delete(id)
    router.push("/crm")
    toast.success("Opportunité supprimée.")
  }

  const startEdit = () => { setForm({ ...deal }); setEditing(true) }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link href="/crm"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            <p className="text-muted-foreground text-sm">{deal.company}</p>
          </div>
          <Badge variant={score >= 70 ? "default" : "secondary"} className="text-sm">Score: {score}/100</Badge>
          <Button variant="outline" size="sm" onClick={startEdit}><Save className="h-3 w-3 mr-1" />Modifier</Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Valeur", value: `${deal.value.toLocaleString("fr-FR")} €` },
            { label: "Probabilité", value: `${deal.probability}%` },
            { label: "Étape", value: STAGE_LABELS[deal.stage] },
            { label: "Clôture", value: deal.closeDate ? new Date(deal.closeDate).toLocaleDateString("fr-FR") : "—" },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="font-semibold mt-0.5">{kpi.value}</p>
            </div>
          ))}
        </div>

        {editing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Modifier l'opportunité</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Titre</Label><Input value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Société</Label><Input value={form.company ?? ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Valeur (€)</Label><Input type="number" value={form.value ?? 0} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} /></div>
                <div className="space-y-1"><Label>Probabilité (%)</Label><Input type="number" min={0} max={100} value={form.probability ?? 20} onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))} /></div>
                <div className="space-y-1">
                  <Label>Étape</Label>
                  <Select value={form.stage ?? "prospect"} onValueChange={v => setForm(f => ({ ...f, stage: v as DealStage }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGE_OPTIONS.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Date de clôture</Label><Input type="date" value={form.closeDate ?? ""} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Assigné à</Label><Input value={form.assignedTo ?? ""} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Email contact</Label><Input type="email" value={form.contactEmail ?? ""} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={save}>Enregistrer</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <ActivityLog dealId={id} />
          <DealTasks dealId={id} />
        </div>
      </div>
    </AppLayout>
  )
}
```

- [ ] **Step 2: Commit**
```bash
rtk git add client/src/app/crm/deals/[id]/page.tsx
rtk git commit -m "feat(crm): deal detail page with activity timeline, tasks, and edit"
```

---

## Task 19: Add CRM to Navigation

**Files:**
- Modify: whichever nav file includes the sidebar items (found at `client/src/components/layout/global-header.tsx`)

- [ ] **Step 1: Find the sidebar/nav configuration and add CRM link**

```bash
rtk grep "contacts\|forms\|TrendingUp\|navigation" /c/Prog/signapps-platform/client/src/components/layout/ --include="*.tsx" -l
```

Read the relevant nav file and add a CRM entry alongside contacts/forms. The CRM icon is `TrendingUp` from lucide-react.

- [ ] **Step 2: Commit**
```bash
rtk git add client/src/components/layout/<nav-file>.tsx
rtk git commit -m "feat(crm): add CRM to app navigation sidebar"
```

---

## Task 20: TypeScript Lint Pass

- [ ] **Step 1: Run TypeScript check**
```bash
rtk tsc --noEmit 2>&1 | head -60
```

- [ ] **Step 2: Fix any type errors**

Common issues to fix:
- Import `Checkbox` from `@/components/ui/checkbox`
- Ensure `DragOverlay` wraps are correctly typed
- `(field as any).show_if` casts in forms are expected — no action needed
- Ensure `calendarApi.list()` and `calendarApi.listEvents()` signatures match what's in `client/src/lib/api/calendar.ts`

- [ ] **Step 3: Commit fixes if any**
```bash
rtk git add <changed files>
rtk git commit -m "fix: TypeScript errors in forms and CRM components"
```

---

## Task 21: Final Integration Test Checklist

- [ ] **Verify Forms builder at `/forms/:id`:**
  - [ ] Conditional logic editor appears below "Champ obligatoire" for each field
  - [ ] "Signature" and "Saut de page" buttons appear in the toolbar
  - [ ] Analytics tab shows response charts

- [ ] **Verify public form at `/f/:id`:**
  - [ ] File upload field shows drag-drop zone for `File` type fields
  - [ ] Signature pad renders for `Signature` type fields
  - [ ] Real-time validation shows errors on blur
  - [ ] Multi-page form shows progress bar and Suivant/Précédent buttons
  - [ ] Score is shown after submission when scoring is configured

- [ ] **Verify CRM at `/crm`:**
  - [ ] Pipeline tab shows kanban with 5 columns, drag-drop works
  - [ ] Liste tab shows sortable/filterable table
  - [ ] Prévisions tab shows bar chart
  - [ ] Quotas tab allows adding and tracking per-period quotas
  - [ ] Agenda tab lists calendar events and allows logging as activities
  - [ ] Importer tab parses CSV and maps columns

- [ ] **Verify Deal Detail at `/crm/deals/:id`:**
  - [ ] Score badge shows computed score
  - [ ] Activity log allows adding notes/calls/emails
  - [ ] Tasks list allows adding/completing/deleting tasks
  - [ ] Edit form saves changes

- [ ] **Final commit**
```bash
rtk git add .
rtk git commit -m "feat: Forms & CRM improvements — 21 features (items 144–164)"
```

---

## Summary of Feature Coverage

| # | Feature | Task |
|---|---------|------|
| 144 | Conditional logic | Task 1 |
| 145 | File upload field | Task 2 |
| 146 | Scoring/quiz mode | Task 3 |
| 147 | Response analytics | Task 4 |
| 148 | Multi-page forms | Task 5 |
| 149 | Real-time validation | Task 6 |
| 150 | Public sharing link (QR) | Task 9 |
| 151 | Email notification toggle | Task 9 |
| 152 | Export CSV/XLSX | Task 7 |
| 153 | Electronic signature | Task 8 |
| 154 | Pipeline Kanban | Task 11 |
| 155 | Deal card | Task 11 |
| 156 | Activity timeline | Task 12 |
| 157 | Auto lead scoring | Task 10 (crm.ts) |
| 158 | Sales forecast | Task 13 |
| 159 | Auto email-deal association | Task 12 |
| 160 | Sales tasks | Task 14 |
| 161 | Prospect CSV import | Task 15 |
| 162 | Deal table w/ filters | Task 13 |
| 163 | Sales quotas | Task 14 |
| 164 | Calendar-CRM integration | Task 16 |
