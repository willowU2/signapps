"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { mailApi, type MailAccount } from "@/lib/api/mail";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSignatureHtml(data: SignatureData): string {
  const parts: string[] = [];

  if (data.logo_url) {
    parts.push(
      `<img src="${data.logo_url}" alt="logo" style="max-height:48px;margin-bottom:8px;display:block;" />`
    );
  }

  parts.push(`
    <table style="font-family:Arial,sans-serif;font-size:13px;color:#333;border-collapse:collapse;">
      <tr>
        <td style="padding-bottom:8px;border-bottom:2px solid #3b82f6;padding-right:16px;">
          <strong style="font-size:15px;display:block;">${data.name || "Votre nom"}</strong>
          ${
            data.title || data.company
              ? `<span style="color:#666;">${[data.title, data.company]
                  .filter(Boolean)
                  .join(" | ")}</span>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;font-size:12px;color:#666;">
          ${[data.phone, data.email, data.website].filter(Boolean).join(" &nbsp;|&nbsp; ")}
        </td>
      </tr>
      ${
        data.extra_html
          ? `<tr><td style="padding-top:8px;">${data.extra_html}</td></tr>`
          : ""
      }
    </table>
  `).trim();

  return parts.join("\n");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignatureData {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
  extra_html: string;
}

const EMPTY_SIG: SignatureData = {
  name: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
  logo_url: "",
  extra_html: "",
};

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

// ─── Signature Builder ────────────────────────────────────────────────────────

function SignatureBuilder({
  account,
  onSaved,
}: {
  account: MailAccount;
  onSaved: () => void;
}) {
  const [sig, setSig] = useState<SignatureData>(EMPTY_SIG);
  const [rawHtml, setRawHtml] = useState(account.signature_html ?? "");
  const [mode, setMode] = useState<"builder" | "raw">("builder");
  const [saving, setSaving] = useState(false);

  const preview = mode === "builder" ? buildSignatureHtml(sig) : rawHtml;

  const setField = (key: keyof SignatureData) => (v: string) =>
    setSig((prev) => ({ ...prev, [key]: v }));

  const handleSave = useCallback(async () => {
    setSaving(true);
    const signatureHtml = mode === "builder" ? buildSignatureHtml(sig) : rawHtml;
    // Plain text fallback
    const signatureText = signatureHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    try {
      await mailApi.updateAccount(account.id, {
        signature_html: signatureHtml,
        signature_text: signatureText,
      });
      toast.success("Signature enregistrée");
      onSaved();
    } catch {
      toast.error("Impossible d'enregistrer la signature");
    } finally {
      setSaving(false);
    }
  }, [mode, sig, rawHtml, account.id, onSaved]);

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("builder")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "builder"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          Constructeur
        </button>
        <button
          onClick={() => setMode("raw")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "raw"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          HTML direct
        </button>
      </div>

      {mode === "builder" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nom complet" value={sig.name} onChange={setField("name")} placeholder="Jean Dupont" />
          <Field label="Poste / Fonction" value={sig.title} onChange={setField("title")} placeholder="Directeur Technique" />
          <Field label="Entreprise" value={sig.company} onChange={setField("company")} placeholder="SignApps" />
          <Field label="Téléphone" value={sig.phone} onChange={setField("phone")} placeholder="+33 1 23 45 67 89" />
          <Field label="E-mail" value={sig.email} onChange={setField("email")} placeholder="jean@exemple.fr" type="email" />
          <Field label="Site web" value={sig.website} onChange={setField("website")} placeholder="https://exemple.fr" type="url" />
          <div className="sm:col-span-2">
            <Field
              label="URL du logo (optionnel)"
              value={sig.logo_url}
              onChange={setField("logo_url")}
              placeholder="https://exemple.fr/logo.png"
              type="url"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              HTML additionnel (optionnel)
            </label>
            <textarea
              value={sig.extra_html}
              onChange={(e) => setField("extra_html")(e.target.value)}
              rows={3}
              placeholder='<a href="https://linkedin.com/in/…">LinkedIn</a>'
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono
                focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            HTML de la signature
          </label>
          <textarea
            value={rawHtml}
            onChange={(e) => setRawHtml(e.target.value)}
            rows={10}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono
              focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
        </div>
      )}

      {/* Live preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Aperçu
        </p>
        <div
          className="rounded-xl border bg-white dark:bg-zinc-900 p-6 min-h-24 overflow-auto"
          dangerouslySetInnerHTML={{ __html: preview || "<em style='color:#999'>Aperçu vide</em>" }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground
            text-sm font-medium hover:bg-primary/90 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Enregistrement…" : "Enregistrer la signature"}
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(preview);
            toast.success("HTML copié dans le presse-papier");
          }}
          className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
        >
          Copier HTML
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MailSettingsPage() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mailApi.listAccounts();
      const list = res.data;
      setAccounts(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selectedId);

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Paramètres Mail</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez vos signatures email par compte.
            </p>
          </div>
          <a href="/mail" className="text-sm text-primary hover:underline">
            ← Retour au mail
          </a>
        </div>

        {loading ? (
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border p-12 text-center text-muted-foreground">
            <p className="font-medium">Aucun compte mail configuré.</p>
            <p className="text-sm mt-1">
              Ajoutez un compte depuis les paramètres de compte.
            </p>
          </div>
        ) : (
          <>
            {/* Account selector */}
            {accounts.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      a.id === selectedId
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    }`}
                  >
                    {a.email_address}
                  </button>
                ))}
              </div>
            )}

            {/* Signature builder */}
            {selectedAccount && (
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Signature — {selectedAccount.email_address}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cette signature sera ajoutée automatiquement à vos messages sortants.
                  </p>
                </div>
                <SignatureBuilder
                  key={selectedAccount.id}
                  account={selectedAccount}
                  onSaved={loadAccounts}
                />
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
