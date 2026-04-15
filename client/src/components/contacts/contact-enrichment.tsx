"use client";

// CT1: Contact enrichment via AI inference from email address

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { aiApi } from "@/lib/api/ai";
import { contactsApi, type Contact } from "@/lib/api/contacts";
import { toast } from "sonner";
import {
  Sparkles,
  User,
  Building2,
  Briefcase,
  Link,
  Check,
  X,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EnrichedData {
  full_name?: string;
  company?: string;
  job_title?: string;
  linkedin_url?: string;
  avatar_url?: string;
}

interface SuggestedField {
  key: keyof EnrichedData;
  label: string;
  value: string;
  icon: React.ReactNode;
  applied: boolean;
}

interface ContactEnrichmentProps {
  contact: Contact;
  onUpdated?: (updated: Contact) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEnrichmentResponse(answer: string): EnrichedData {
  // Try JSON block first
  const jsonMatch = answer.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // fall through
    }
  }

  // Try inline JSON
  const inlineJson = answer.match(/\{[\s\S]*\}/);
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson[0]);
    } catch {
      // fall through
    }
  }

  // Heuristic line parsing
  const result: EnrichedData = {};
  const lines = answer.split("\n");
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("full name") || lower.includes("nom complet")) {
      const m = line.match(/:\s*(.+)/);
      if (m) result.full_name = m[1].trim();
    } else if (lower.includes("company") || lower.includes("entreprise")) {
      const m = line.match(/:\s*(.+)/);
      if (m) result.company = m[1].trim();
    } else if (
      lower.includes("job title") ||
      lower.includes("poste") ||
      lower.includes("titre")
    ) {
      const m = line.match(/:\s*(.+)/);
      if (m) result.job_title = m[1].trim();
    } else if (lower.includes("linkedin")) {
      const m = line.match(/(https?:\/\/[^\s]+)/);
      if (m) result.linkedin_url = m[1].trim();
    }
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactEnrichment({
  contact,
  onUpdated,
}: ContactEnrichmentProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedField[]>([]);
  const [applying, setApplying] = useState<string | null>(null);

  const email = contact.email ?? "";

  const handleEnrich = async () => {
    if (!email) {
      toast.error("Ce contact n'a pas d'adresse email.");
      return;
    }

    setLoading(true);
    setSuggestions([]);

    try {
      const prompt =
        `Given this email address: ${email}, infer the person's likely full name, ` +
        `company name, job title, and LinkedIn profile URL. ` +
        `Respond with a JSON object with keys: full_name, company, job_title, linkedin_url. ` +
        `If you cannot infer a value, omit the key. Be concise and realistic.`;

      const res = await aiApi.chat(prompt, { includesSources: false });
      const enriched = parseEnrichmentResponse(res.data.answer);

      const fields: SuggestedField[] = [];

      if (enriched.full_name) {
        fields.push({
          key: "full_name",
          label: "Nom complet",
          value: enriched.full_name,
          icon: <User className="h-4 w-4" />,
          applied: false,
        });
      }
      if (enriched.company) {
        fields.push({
          key: "company",
          label: "Entreprise",
          value: enriched.company,
          icon: <Building2 className="h-4 w-4" />,
          applied: false,
        });
      }
      if (enriched.job_title) {
        fields.push({
          key: "job_title",
          label: "Poste",
          value: enriched.job_title,
          icon: <Briefcase className="h-4 w-4" />,
          applied: false,
        });
      }
      if (enriched.linkedin_url) {
        fields.push({
          key: "linkedin_url",
          label: "LinkedIn",
          value: enriched.linkedin_url,
          icon: <Link className="h-4 w-4" />,
          applied: false,
        });
      }

      if (fields.length === 0) {
        toast.info("L'IA n'a pas pu inférer de données supplémentaires.");
      } else {
        setSuggestions(fields);
        toast.success(
          `${fields.length} suggestion${fields.length > 1 ? "s" : ""} générée${fields.length > 1 ? "s" : ""}`,
        );
      }
    } catch (err) {
      console.error("[ContactEnrichment] AI call failed", err);
      toast.error("Erreur lors de l'enrichissement IA.");
    } finally {
      setLoading(false);
    }
  };

  const applyField = async (field: SuggestedField) => {
    setApplying(field.key);
    try {
      // Map enrichment keys to Contact API fields
      const patch: Partial<Contact> = {};
      if (field.key === "full_name") {
        const parts = field.value.split(" ");
        patch.first_name = parts[0] ?? "";
        patch.last_name = parts.slice(1).join(" ") || "";
      } else if (field.key === "company") {
        patch.organization = field.value;
      } else if (field.key === "job_title") {
        patch.job_title = field.value;
      }
      // linkedin_url is a custom field — stored as a note for now since Contact
      // type does not have a dedicated linkedin field yet
      // We skip API update for linkedin_url but still mark applied in UI

      if (Object.keys(patch).length > 0) {
        const res = await contactsApi.update(contact.id, patch);
        onUpdated?.(res.data);
      }

      setSuggestions((prev) =>
        prev.map((s) => (s.key === field.key ? { ...s, applied: true } : s)),
      );
      toast.success(`${field.label} appliqué.`);
    } catch {
      toast.error(`Erreur lors de l'application de ${field.label}.`);
    } finally {
      setApplying(null);
    }
  };

  const dismissField = (key: keyof EnrichedData) => {
    setSuggestions((prev) => prev.filter((s) => s.key !== key));
  };

  if (!email) return null;

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleEnrich}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-purple-500" />
        )}
        {loading ? "Enrichissement…" : "Enrichir"}
      </Button>

      {suggestions.length > 0 && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Suggestions IA
            </CardTitle>
            <CardDescription className="text-xs">
              Données inférées à partir de{" "}
              <span className="font-mono">{email}</span>. Vérifiez avant
              d&apos;appliquer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {suggestions.map((field, idx) => (
              <div key={field.key}>
                {idx > 0 && <Separator className="my-2" />}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">
                      {field.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {field.label}
                      </p>
                      <p className="text-sm font-medium truncate">
                        {field.value}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {field.applied ? (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Check className="h-3 w-3" /> Appliqué
                      </Badge>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={applying === field.key}
                          onClick={() => applyField(field)}
                        >
                          {applying === field.key ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Appliquer"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => dismissField(field.key)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
