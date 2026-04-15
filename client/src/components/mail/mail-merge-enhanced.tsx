"use client";

// IDEA-040: Enhanced mail merge — better variable mapping UI from Sheets data
// Idea 47: Import from Contacts

import { useState, useCallback } from "react";
import {
  Upload,
  Play,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { contactsApi } from "@/lib/api/contacts";
import { mailApi } from "@/lib/api-mail";

interface CsvRow {
  [key: string]: string;
}

interface VariableMapping {
  templateVar: string;
  csvColumn: string;
}

interface MergePreview {
  recipient: string;
  subject: string;
  bodyPreview: string;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split("\n");
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

function detectTemplateVars(text: string): string[] {
  const vars = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) vars.add(m[1]);
  return [...vars];
}

function applyMapping(
  template: string,
  row: CsvRow,
  mappings: VariableMapping[],
): string {
  let result = template;
  for (const m of mappings) {
    const val = row[m.csvColumn] ?? "";
    result = result.replaceAll(`{{${m.templateVar}}}`, val);
  }
  return result;
}

interface EnhancedMailMergeProps {
  onSendAll?: (
    emails: Array<{ to: string; subject: string; body: string }>,
  ) => Promise<void>;
  accountId?: string;
}

export function EnhancedMailMerge({
  onSendAll,
  accountId,
}: EnhancedMailMergeProps) {
  const [csvText, setCsvText] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [subject, setSubject] = useState("Hello {{first_name}}!");
  const [body, setBody] = useState(
    "Dear {{first_name}} {{last_name}},\n\nYour account at {{company}} is ready.\n\nBest regards",
  );
  const [mappings, setMappings] = useState<VariableMapping[]>([]);
  const [recipientColumn, setRecipientColumn] = useState("");
  const [previews, setPreviews] = useState<MergePreview[]>([]);
  const [sending, setSending] = useState(false);

  const handleCsvLoad = useCallback(() => {
    if (!csvText.trim()) {
      toast.error("Paste CSV data first");
      return;
    }
    const { headers, rows } = parseCsv(csvText);
    if (!headers.length) {
      toast.error("Impossible d'analyser le CSV");
      return;
    }
    setCsvHeaders(headers);
    setCsvRows(rows);

    // Auto-map template vars to CSV columns by name similarity
    const vars = detectTemplateVars(subject + " " + body);
    const autoMappings: VariableMapping[] = vars.map((v) => {
      const match = headers.find(
        (h) =>
          h.toLowerCase() === v.toLowerCase() ||
          h.toLowerCase().replace(/[_\s]/g, "") ===
            v.toLowerCase().replace(/[_\s]/g, ""),
      );
      return { templateVar: v, csvColumn: match || "" };
    });
    setMappings(autoMappings);

    // Auto-detect recipient column
    const emailCol = headers.find(
      (h) => h.toLowerCase().includes("email") || h.toLowerCase() === "to",
    );
    if (emailCol) setRecipientColumn(emailCol);

    toast.success(`Loaded ${rows.length} rows with ${headers.length} columns`);
  }, [csvText, subject, body]);

  const updateMapping = (templateVar: string, csvColumn: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.templateVar === templateVar ? { ...m, csvColumn } : m,
      ),
    );
  };

  const generatePreview = useCallback(() => {
    if (!csvRows.length) {
      toast.error("Load CSV data first");
      return;
    }
    const previewRows = csvRows.slice(0, 3);
    const generated = previewRows.map((row) => ({
      recipient: row[recipientColumn] || "(no email)",
      subject: applyMapping(subject, row, mappings),
      bodyPreview: applyMapping(body, row, mappings).slice(0, 120) + "…",
    }));
    setPreviews(generated);
  }, [csvRows, subject, body, mappings, recipientColumn]);

  const handleSend = async () => {
    if (!recipientColumn) {
      toast.error("Sélectionnez la colonne d'email du destinataire");
      return;
    }
    setSending(true);
    try {
      const emails = csvRows
        .map((row) => ({
          to: row[recipientColumn],
          subject: applyMapping(subject, row, mappings),
          body: applyMapping(body, row, mappings),
        }))
        .filter((e) => e.to);
      if (onSendAll) {
        await onSendAll(emails);
      } else {
        // Idea 47: Use mailApi.send() directly when no external handler is provided
        const aid = accountId || "default";
        let sent = 0;
        for (const em of emails) {
          try {
            await mailApi.send({
              account_id: aid,
              recipient: em.to,
              subject: em.subject,
              body_text: em.body,
            });
            sent++;
          } catch {
            /* continue to next */
          }
        }
        toast.success(`${sent} email(s) envoyé(s) sur ${emails.length}.`);
        return;
      }
      toast.success(`Sent ${emails.length} emails`);
    } catch {
      toast.error("Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  // Idea 47: Import from Contacts API
  const [importingContacts, setImportingContacts] = useState(false);
  const handleImportContacts = useCallback(async () => {
    setImportingContacts(true);
    try {
      const res = await contactsApi.list();
      const contacts = Array.isArray(res.data) ? res.data : [];
      if (!Array.isArray(contacts) || contacts.length === 0) {
        toast.info("Aucun contact trouvé.");
        return;
      }
      // Build CSV-like structure: first_name, last_name, email, company
      const headers = ["first_name", "last_name", "email", "company"];
      const rows: CsvRow[] = contacts
        .filter((c: any) => c.email)
        .map((c: any) => ({
          first_name: c.first_name || "",
          last_name: c.last_name || "",
          email: c.email || "",
          company: c.organization || c.company || "",
        }));
      if (rows.length === 0) {
        toast.info("Aucun contact avec email trouvé.");
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      // Auto-map variables
      const vars = detectTemplateVars(subject + " " + body);
      const autoMappings: VariableMapping[] = vars.map((v) => {
        const match = headers.find(
          (h) =>
            h.toLowerCase() === v.toLowerCase() ||
            h.toLowerCase().replace(/[_\s]/g, "") ===
              v.toLowerCase().replace(/[_\s]/g, ""),
        );
        return { templateVar: v, csvColumn: match || "" };
      });
      setMappings(autoMappings);
      setRecipientColumn("email");
      toast.success(`${rows.length} contact(s) importé(s).`);
    } catch {
      toast.error("Impossible d'importer les contacts.");
    } finally {
      setImportingContacts(false);
    }
  }, [subject, body]);

  const templateVars = detectTemplateVars(subject + " " + body);
  const unmapped = mappings.filter((m) => !m.csvColumn);

  return (
    <div className="space-y-6">
      {/* Step 1: CSV Data */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
            1
          </span>
          Paste CSV data (first row = headers)
        </Label>
        <Textarea
          rows={5}
          className="font-mono text-xs"
          placeholder={
            "first_name,last_name,email,company\nAlice,Smith,alice@example.com,Acme"
          }
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCsvLoad}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Parse CSV (
            {csvRows.length > 0 ? `${csvRows.length} rows loaded` : "no data"})
          </Button>
          {/* Idea 47: Import from Contacts */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleImportContacts}
            disabled={importingContacts}
            className="gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          >
            <Users className="h-3.5 w-3.5" />
            {importingContacts ? "Import…" : "Importer depuis Contacts"}
          </Button>
        </div>
      </div>

      {/* Step 2: Template */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
            2
          </span>
          Email template (use {"{{variable}}"} placeholders)
        </Label>
        <Input
          placeholder="Subject: Hello {{first_name}}!"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Dear {{first_name}},..."
        />
        <div className="flex flex-wrap gap-1">
          {templateVars.map((v) => (
            <Badge key={v} variant="secondary" className="text-xs font-mono">
              {"{{"}
              {v}
              {"}}"}
            </Badge>
          ))}
          {!templateVars.length && (
            <span className="text-xs text-muted-foreground">
              No variables detected
            </span>
          )}
        </div>
      </div>

      {/* Step 3: Variable mapping */}
      {csvHeaders.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
              3
            </span>
            Map variables to columns
            {unmapped.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unmapped.length} unmapped
              </Badge>
            )}
          </Label>

          {/* Recipient column */}
          <div className="flex items-center gap-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50">
            <span className="text-xs font-semibold text-amber-700">
              Recipient email:
            </span>
            <Select value={recipientColumn} onValueChange={setRecipientColumn}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Select email column" />
              </SelectTrigger>
              <SelectContent>
                {csvHeaders.map((h) => (
                  <SelectItem key={h} value={h} className="text-xs">
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variable mappings */}
          <div className="space-y-1.5">
            {mappings.map((m) => (
              <div key={m.templateVar} className="flex items-center gap-2">
                <code
                  className={cn(
                    "text-xs font-mono px-2 py-1 rounded w-32 shrink-0",
                    m.csvColumn
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200",
                  )}
                >
                  {"{{"}
                  {m.templateVar}
                  {"}}"}
                </code>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Select
                  value={m.csvColumn}
                  onValueChange={(v) => updateMapping(m.templateVar, v)}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value=""
                      className="text-xs text-muted-foreground"
                    >
                      (none)
                    </SelectItem>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {m.csvColumn ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Preview & Send */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={generatePreview}
            disabled={!csvRows.length}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Preview ({Math.min(3, csvRows.length)} samples)
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !csvRows.length || !recipientColumn}
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {sending ? "Sending…" : `Send to ${csvRows.length} recipients`}
          </Button>
        </div>

        {previews.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              Preview (first 3 rows)
            </Label>
            {previews.map((p, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border bg-muted/30 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    To:
                  </span>
                  <span className="text-xs font-medium">{p.recipient}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Subject:
                  </span>
                  <span className="text-xs">{p.subject}</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.bodyPreview}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
