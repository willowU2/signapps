"use client"

// IDEA-277: DPIA template generator — Data Protection Impact Assessment wizard

import { useState } from "react"
import { Shield, ChevronRight, ChevronLeft, CheckCircle2, Download, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface DpiaData {
  // Step 1 — Project overview
  project_name: string
  project_description: string
  data_controller: string
  dpo_name: string
  assessment_date: string

  // Step 2 — Processing description
  processing_purpose: string
  legal_basis: string
  data_categories: string[]
  data_subjects: string[]
  retention_period: string
  third_party_transfers: boolean
  transfer_countries: string

  // Step 3 — Risk assessment
  necessity_proportionality: string
  security_measures: string
  risk_level: "low" | "medium" | "high"
  risks_identified: string

  // Step 4 — Mitigation
  mitigation_measures: string
  residual_risk: "acceptable" | "unacceptable"
  dpo_advice: string

  // Step 5 — Decision
  proceed: boolean
  conditions: string
  review_date: string
}

const DATA_CATEGORIES = [
  "Name & contact details", "Financial data", "Health data",
  "Biometric data", "Location data", "Behavioral data",
  "Ethnic/racial origin", "Political opinions", "Religious beliefs",
  "Criminal records", "Children's data",
]

const DATA_SUBJECTS = [
  "Employees", "Customers", "Patients", "Children",
  "Vulnerable individuals", "Public", "Business contacts",
]

const LEGAL_BASES = [
  "Consent (Art. 6(1)(a))",
  "Contract (Art. 6(1)(b))",
  "Legal obligation (Art. 6(1)(c))",
  "Vital interests (Art. 6(1)(d))",
  "Public task (Art. 6(1)(e))",
  "Legitimate interests (Art. 6(1)(f))",
]

const TOTAL_STEPS = 5

const STEP_LABELS = ["Overview", "Processing", "Risk Assessment", "Mitigation", "Decision"]

const EMPTY: DpiaData = {
  project_name: "", project_description: "", data_controller: "", dpo_name: "",
  assessment_date: new Date().toISOString().split("T")[0],
  processing_purpose: "", legal_basis: "", data_categories: [], data_subjects: [],
  retention_period: "", third_party_transfers: false, transfer_countries: "",
  necessity_proportionality: "", security_measures: "", risk_level: "low", risks_identified: "",
  mitigation_measures: "", residual_risk: "acceptable", dpo_advice: "",
  proceed: true, conditions: "", review_date: "",
}

export function DpiaGenerator() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<DpiaData>(EMPTY)
  const [generating, setGenerating] = useState(false)

  function update<K extends keyof DpiaData>(key: K, value: DpiaData[K]) {
    setData(p => ({ ...p, [key]: value }))
  }

  function toggleArray(key: "data_categories" | "data_subjects", value: string) {
    setData(p => {
      const arr = p[key]
      return { ...p, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  async function generateReport() {
    setGenerating(true)
    try {
      const res = await fetch("/api/compliance/dpia/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `DPIA_${data.project_name.replace(/\s+/g, "_")}.pdf`
      a.click()
      toast.success("DPIA report generated")
    } catch {
      toast.error("Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-blue-500" />
        <h2 className="font-semibold">DPIA Wizard</h2>
        <Badge variant="outline" className="ml-auto">{step + 1}/{TOTAL_STEPS}</Badge>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors truncate",
                i === step && "bg-primary text-primary-foreground",
                i < step && "text-muted-foreground hover:bg-muted cursor-pointer",
                i > step && "text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              {i < step && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
              {label}
            </button>
            {i < TOTAL_STEPS - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
          </div>
        ))}
      </div>
      <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="h-1" />

      {/* Steps */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project / Processing name</Label>
              <Input value={data.project_name} onChange={e => update("project_name", e.target.value)} placeholder="e.g. Customer Analytics Platform" />
            </div>
            <div className="space-y-1.5">
              <Label>Data Controller</Label>
              <Input value={data.data_controller} onChange={e => update("data_controller", e.target.value)} placeholder="Organization name" />
            </div>
            <div className="space-y-1.5">
              <Label>DPO Name</Label>
              <Input value={data.dpo_name} onChange={e => update("dpo_name", e.target.value)} placeholder="Data Protection Officer" />
            </div>
            <div className="space-y-1.5">
              <Label>Assessment date</Label>
              <Input type="date" value={data.assessment_date} onChange={e => update("assessment_date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Project description</Label>
            <Textarea value={data.project_description} onChange={e => update("project_description", e.target.value)} rows={3} placeholder="Describe the project and its data processing activities…" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Processing purpose</Label>
            <Textarea value={data.processing_purpose} onChange={e => update("processing_purpose", e.target.value)} rows={2} placeholder="Why is the data being processed?" />
          </div>
          <div className="space-y-1.5">
            <Label>Legal basis</Label>
            <RadioGroup value={data.legal_basis} onValueChange={v => update("legal_basis", v)} className="grid grid-cols-2 gap-2">
              {LEGAL_BASES.map(basis => (
                <div key={basis} className="flex items-center space-x-2">
                  <RadioGroupItem value={basis} id={basis} />
                  <label htmlFor={basis} className="text-xs cursor-pointer">{basis}</label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Data categories processed</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {DATA_CATEGORIES.map(cat => (
                <div key={cat} className="flex items-center gap-2">
                  <Checkbox
                    id={`dc-${cat}`}
                    checked={data.data_categories.includes(cat)}
                    onCheckedChange={() => toggleArray("data_categories", cat)}
                  />
                  <label htmlFor={`dc-${cat}`} className="text-xs cursor-pointer">{cat}</label>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Retention period</Label>
              <Input value={data.retention_period} onChange={e => update("retention_period", e.target.value)} placeholder="e.g. 3 years" />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Necessity & proportionality assessment</Label>
            <Textarea value={data.necessity_proportionality} onChange={e => update("necessity_proportionality", e.target.value)} rows={3} placeholder="Is the processing necessary? Is it proportionate to the purpose?" />
          </div>
          <div className="space-y-1.5">
            <Label>Security measures in place</Label>
            <Textarea value={data.security_measures} onChange={e => update("security_measures", e.target.value)} rows={2} placeholder="Encryption, access controls, pseudonymization…" />
          </div>
          <div className="space-y-1.5">
            <Label>Overall risk level</Label>
            <RadioGroup value={data.risk_level} onValueChange={v => update("risk_level", v as DpiaData["risk_level"])} className="flex gap-4">
              {["low", "medium", "high"].map(level => (
                <div key={level} className="flex items-center gap-2">
                  <RadioGroupItem value={level} id={`risk-${level}`} />
                  <label htmlFor={`risk-${level}`} className="text-sm capitalize cursor-pointer">{level}</label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label>Risks identified</Label>
            <Textarea value={data.risks_identified} onChange={e => update("risks_identified", e.target.value)} rows={2} placeholder="List specific risks to data subjects…" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mitigation measures</Label>
            <Textarea value={data.mitigation_measures} onChange={e => update("mitigation_measures", e.target.value)} rows={4} placeholder="How will the identified risks be mitigated?" />
          </div>
          <div className="space-y-1.5">
            <Label>Residual risk after mitigation</Label>
            <RadioGroup value={data.residual_risk} onValueChange={v => update("residual_risk", v as DpiaData["residual_risk"])} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="acceptable" id="res-acc" />
                <label htmlFor="res-acc" className="text-sm cursor-pointer">Acceptable</label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="unacceptable" id="res-unac" />
                <label htmlFor="res-unac" className="text-sm cursor-pointer text-destructive">Unacceptable</label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label>DPO advice / recommendations</Label>
            <Textarea value={data.dpo_advice} onChange={e => update("dpo_advice", e.target.value)} rows={2} />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          {data.residual_risk === "unacceptable" && (
            <div className="flex items-center gap-2 rounded-md border border-destructive p-3 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">Residual risk is unacceptable. Consult supervisory authority before proceeding.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Decision</Label>
            <RadioGroup value={data.proceed ? "yes" : "no"} onValueChange={v => update("proceed", v === "yes")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="proc-yes" />
                <label htmlFor="proc-yes" className="text-sm cursor-pointer text-green-600">Proceed</label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="proc-no" />
                <label htmlFor="proc-no" className="text-sm cursor-pointer text-destructive">Do not proceed</label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label>Conditions / remarks</Label>
            <Textarea value={data.conditions} onChange={e => update("conditions", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Review date</Label>
            <Input type="date" value={data.review_date} onChange={e => update("review_date", e.target.value)} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < TOTAL_STEPS - 1 ? (
          <Button onClick={() => setStep(s => s + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={generateReport} disabled={generating}>
            <Download className="h-4 w-4 mr-1" />
            {generating ? "Generating…" : "Generate DPIA Report"}
          </Button>
        )}
      </div>
    </div>
  )
}
