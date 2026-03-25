"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, CheckCircle2, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SignatureData {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  tagline: string;
}

const VARIABLES: { key: keyof SignatureData; label: string; example: string }[] = [
  { key: "name", label: "Full Name", example: "Jane Doe" },
  { key: "title", label: "Job Title", example: "Product Manager" },
  { key: "company", label: "Company", example: "Acme Corp" },
  { key: "phone", label: "Phone", example: "+33 6 12 34 56 78" },
  { key: "email", label: "Email", example: "jane@acme.com" },
  { key: "website", label: "Website", example: "https://acme.com" },
  { key: "linkedin", label: "LinkedIn", example: "linkedin.com/in/janedoe" },
  { key: "tagline", label: "Tagline", example: "Building the future" },
];

const TEMPLATES = [
  {
    id: "minimal",
    label: "Minimal",
    build: (d: SignatureData) => `
<table style="font-family:Arial,sans-serif;font-size:13px;color:#333;border-collapse:collapse;">
  <tr><td style="padding-bottom:4px;">
    <strong style="font-size:15px;color:#111;">${d.name || "Your Name"}</strong>
    ${d.title ? ` &nbsp;·&nbsp; <span style="color:#666;">${d.title}</span>` : ""}
  </td></tr>
  ${d.company ? `<tr><td style="color:#555;font-size:12px;padding-bottom:4px;">${d.company}</td></tr>` : ""}
  <tr><td style="font-size:12px;color:#888;">
    ${[d.phone, d.email, d.website ? `<a href="${d.website}" style="color:#3b82f6;text-decoration:none;">${d.website}</a>` : ""].filter(Boolean).join(" &nbsp;|&nbsp; ")}
  </td></tr>
</table>`.trim(),
  },
  {
    id: "branded",
    label: "Branded",
    build: (d: SignatureData) => `
<table style="font-family:Arial,sans-serif;font-size:13px;color:#333;border-collapse:collapse;max-width:420px;">
  <tr>
    <td style="border-left:4px solid #3b82f6;padding-left:12px;">
      <div style="font-size:16px;font-weight:bold;color:#111;">${d.name || "Your Name"}</div>
      ${d.title ? `<div style="color:#3b82f6;font-size:12px;margin-top:2px;">${d.title}${d.company ? ` @ ${d.company}` : ""}</div>` : ""}
      ${d.tagline ? `<div style="font-size:11px;color:#888;font-style:italic;margin-top:4px;">${d.tagline}</div>` : ""}
      <div style="margin-top:8px;font-size:12px;color:#555;">
        ${d.phone ? `<span>${d.phone}</span>` : ""}
        ${d.email ? `<span>${d.phone ? " &nbsp;|&nbsp; " : ""}<a href="mailto:${d.email}" style="color:#3b82f6;text-decoration:none;">${d.email}</a></span>` : ""}
        ${d.website ? `<span> &nbsp;|&nbsp; <a href="${d.website}" style="color:#3b82f6;text-decoration:none;">${d.website}</a></span>` : ""}
      </div>
      ${d.linkedin ? `<div style="margin-top:4px;font-size:11px;"><a href="https://${d.linkedin.replace(/^https?:\/\//, '')}" style="color:#0a66c2;text-decoration:none;">LinkedIn</a></div>` : ""}
    </td>
  </tr>
</table>`.trim(),
  },
  {
    id: "classic",
    label: "Classic",
    build: (d: SignatureData) => `
<table style="font-family:Georgia,serif;font-size:13px;color:#333;border-collapse:collapse;">
  <tr><td style="padding-bottom:6px;border-bottom:1px solid #ddd;">
    <span style="font-size:16px;font-weight:bold;">${d.name || "Your Name"}</span>
    ${d.title ? `<br/><span style="font-size:12px;color:#666;">${d.title}${d.company ? `, ${d.company}` : ""}</span>` : ""}
  </td></tr>
  <tr><td style="padding-top:6px;font-size:12px;color:#555;line-height:1.6;">
    ${d.phone ? `Tel: ${d.phone}<br/>` : ""}
    ${d.email ? `Email: <a href="mailto:${d.email}" style="color:#333;">${d.email}</a><br/>` : ""}
    ${d.website ? `Web: <a href="${d.website}" style="color:#333;">${d.website}</a>` : ""}
  </td></tr>
</table>`.trim(),
  },
];

export function EmailSignatureEditor() {
  const [data, setData] = useState<SignatureData>({
    name: "", title: "", company: "", phone: "", email: "", website: "", linkedin: "", tagline: "",
  });
  const [templateId, setTemplateId] = useState("branded");
  const [copied, setCopied] = useState(false);

  const update = (key: keyof SignatureData, value: string) =>
    setData((d) => ({ ...d, [key]: value }));

  const selectedTemplate = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  const html = selectedTemplate.build(data);

  const handleCopy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    toast.success("HTML signature copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Tabs defaultValue="edit">
        <TabsList className="mb-4">
          <TabsTrigger value="edit" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4">
          {/* Template selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Template
            </Label>
            <div className="flex gap-2">
              {TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  variant={templateId === t.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTemplateId(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Variables */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variables
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer text-xs font-mono hover:bg-primary/10 transition-colors"
                  title={`Example: ${v.example}`}
                >
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            {VARIABLES.map((v) => (
              <div key={v.key} className="space-y-1">
                <Label htmlFor={`sig-${v.key}`} className="text-xs text-muted-foreground">
                  {v.label}
                </Label>
                <Input
                  id={`sig-${v.key}`}
                  value={data[v.key]}
                  onChange={(e) => update(v.key, e.target.value)}
                  placeholder={v.example}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="bg-white rounded border p-4 min-h-[80px]"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleCopy} className="gap-2">
        {copied ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy HTML
          </>
        )}
      </Button>
    </div>
  );
}
