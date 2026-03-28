"use client"

// IDEA-281: Privacy policy generator — template-based legal doc generator

import { useState } from "react"
import { FileText, Download, Copy, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

interface PolicyConfig {
  // Company
  company_name: string
  company_address: string
  contact_email: string
  dpo_email?: string
  website_url: string
  jurisdiction: string

  // Data activities
  collects_analytics: boolean
  collects_cookies: boolean
  uses_email_marketing: boolean
  uses_third_party_integrations: boolean
  third_parties: string
  transfers_outside_eu: boolean
  transfer_countries: string

  // Rights
  right_to_erasure: boolean
  right_to_portability: boolean
  right_to_object: boolean

  // Retention
  retention_policy: string
  effective_date: string
}

const JURISDICTIONS = [
  "European Union (GDPR)",
  "United Kingdom (UK GDPR)",
  "France (CNIL)",
  "United States (CCPA)",
  "Canada (PIPEDA)",
  "Generic",
]

const EMPTY: PolicyConfig = {
  company_name: "",
  company_address: "",
  contact_email: "",
  dpo_email: "",
  website_url: "",
  jurisdiction: "European Union (GDPR)",
  collects_analytics: true,
  collects_cookies: true,
  uses_email_marketing: false,
  uses_third_party_integrations: false,
  third_parties: "",
  transfers_outside_eu: false,
  transfer_countries: "",
  right_to_erasure: true,
  right_to_portability: true,
  right_to_object: true,
  retention_policy: "We retain personal data only for as long as necessary to fulfil the purposes outlined in this policy.",
  effective_date: new Date().toISOString().split("T")[0],
}

function generatePolicy(c: PolicyConfig): string {
  const rights = [
    "the right to access your personal data",
    c.right_to_erasure && "the right to erasure ('right to be forgotten')",
    c.right_to_portability && "the right to data portability",
    c.right_to_object && "the right to object to processing",
    "the right to restrict processing",
    "the right to lodge a complaint with a supervisory authority",
  ].filter(Boolean).join("; ")

  return `# Privacy Policy

**${c.company_name}**
Effective date: ${c.effective_date}

---

## 1. Introduction

${c.company_name} ("we", "us", "our") operates the website ${c.website_url}. This Privacy Policy explains how we collect, use, and protect your personal data in accordance with ${c.jurisdiction}.

**Data Controller:** ${c.company_name}, ${c.company_address}
**Contact:** ${c.contact_email}
${c.dpo_email ? `**Data Protection Officer:** ${c.dpo_email}` : ""}

---

## 2. Data We Collect

We collect the following categories of personal data:
- **Contact information:** name, email address, phone number
- **Account data:** username, password (hashed), preferences
${c.collects_analytics ? "- **Usage data:** pages visited, time spent, browser type, IP address (anonymized)" : ""}
${c.collects_cookies ? "- **Cookie data:** session cookies, preference cookies" : ""}

---

## 3. How We Use Your Data

We use your personal data to:
- Provide and improve our services
- Communicate with you about your account
${c.uses_email_marketing ? "- Send marketing communications (with your consent)" : ""}
- Comply with legal obligations
- Detect and prevent fraud

---

## 4. Legal Basis for Processing

We process your data under the following legal bases:
- **Contract:** processing necessary to perform our contract with you
- **Legal obligation:** compliance with applicable laws
- **Legitimate interests:** improving our services and security
${c.uses_email_marketing ? "- **Consent:** marketing communications (you may withdraw at any time)" : ""}

---
${c.uses_third_party_integrations ? `
## 5. Third Parties

We share data with the following third parties:
${c.third_parties || "(list your third parties here)"}

These parties are bound by data processing agreements and may not use your data for their own purposes.

---
` : ""}
## ${c.uses_third_party_integrations ? "6" : "5"}. Data Retention

${c.retention_policy}

---

## ${c.uses_third_party_integrations ? "7" : "6"}. Your Rights

You have the following rights regarding your personal data: ${rights}.

To exercise these rights, contact us at ${c.contact_email}.

---
${c.transfers_outside_eu ? `
## International Transfers

We may transfer your data to: ${c.transfer_countries || "(specify countries)"}. We ensure appropriate safeguards are in place for such transfers.

---
` : ""}
## ${c.uses_third_party_integrations ? "8" : "7"}. Security

We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.

---

## ${c.uses_third_party_integrations ? "9" : "8"}. Changes

We may update this Privacy Policy from time to time. We will notify you of significant changes by email or prominent notice on our website.

---

*Last updated: ${c.effective_date} · ${c.company_name}*`
}

export function PrivacyPolicyGenerator() {
  const [config, setConfig] = useState<PolicyConfig>(EMPTY)
  const [generated, setGenerated] = useState("")
  const [generating, setGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  function update<K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) {
    setConfig(p => ({ ...p, [key]: value }))
  }

  async function generate() {
    if (!config.company_name || !config.contact_email) {
      toast.error("Le nom de l'entreprise et l'email de contact sont requis")
      return
    }
    setGenerating(true)
    // Try API for AI-enhanced version, fall back to template
    try {
      const res = await fetch("/api/compliance/privacy-policy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        const data = await res.json()
        setGenerated(data.content)
      } else {
        setGenerated(generatePolicy(config))
      }
    } catch {
      setGenerated(generatePolicy(config))
    }
    setShowPreview(true)
    setGenerating(false)
    toast.success("Politique de confidentialité générée")
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generated)
    toast.success("Copié dans le presse-papiers")
  }

  async function downloadPdf() {
    try {
      const res = await fetch("/api/compliance/privacy-policy/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: generated, company: config.company_name }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Privacy_Policy_${config.company_name.replace(/\s+/g, "_")}.pdf`
      a.click()
    } catch {
      toast.error("PDF export failed")
    }
  }

  const BOOL_OPTIONS: { key: keyof PolicyConfig; label: string }[] = [
    { key: "collects_analytics", label: "Collects analytics" },
    { key: "collects_cookies", label: "Uses cookies" },
    { key: "uses_email_marketing", label: "Email marketing" },
    { key: "uses_third_party_integrations", label: "Third-party integrations" },
    { key: "transfers_outside_eu", label: "Transfers outside EU" },
    { key: "right_to_erasure", label: "Right to erasure" },
    { key: "right_to_portability", label: "Right to portability" },
    { key: "right_to_object", label: "Right to object" },
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Privacy Policy Generator
        </h2>
        <Badge variant="outline">{config.jurisdiction}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Company name *</Label>
              <Input value={config.company_name} onChange={e => update("company_name", e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Website URL</Label>
              <Input value={config.website_url} onChange={e => update("website_url", e.target.value)} placeholder="https://example.com" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Company address</Label>
              <Input value={config.company_address} onChange={e => update("company_address", e.target.value)} placeholder="123 Main St, City, Country" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact email *</Label>
              <Input value={config.contact_email} onChange={e => update("contact_email", e.target.value)} placeholder="privacy@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">DPO email (optional)</Label>
              <Input value={config.dpo_email ?? ""} onChange={e => update("dpo_email", e.target.value)} placeholder="dpo@example.com" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Jurisdiction</Label>
              <Select value={config.jurisdiction} onValueChange={v => update("jurisdiction", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JURISDICTIONS.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            {BOOL_OPTIONS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <Label className="text-xs">{label}</Label>
                <Switch
                  checked={config[key] as boolean}
                  onCheckedChange={v => update(key, v)}
                />
              </div>
            ))}
          </div>

          {config.uses_third_party_integrations && (
            <div className="space-y-1.5">
              <Label className="text-xs">Third parties list</Label>
              <Input value={config.third_parties} onChange={e => update("third_parties", e.target.value)} placeholder="Google Analytics, Stripe, Mailchimp…" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Effective date</Label>
            <Input type="date" value={config.effective_date} onChange={e => update("effective_date", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={generate} disabled={generating} className="w-full">
        <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
        {generating ? "Generating…" : "Generate Privacy Policy"}
      </Button>

      {showPreview && generated && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">Generated Policy</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
              <Button size="sm" onClick={downloadPdf}>
                <Download className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <pre className="text-xs p-4 whitespace-pre-wrap font-sans">{generated}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
