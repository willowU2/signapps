"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Mail,
  Globe,
  Server,
  TestTube,
  ShieldCheck,
  Settings2,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  accountApi,
  type MailAccount,
  type CreateAccountRequest,
} from "@/lib/api-mail";
import { mailApi } from "@/lib/api/mail";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EmailAutomationRules } from "@/components/workflow/email-automation-rules";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/hooks/use-auth";

// ─── Provider presets ────────────────────────────────────────────────────────

type ProviderPreset = {
  label: string;
  icon: React.ReactNode;
  provider: string;
  imap_server: string;
  imap_port: number;
  imap_use_tls: boolean;
  smtp_server: string;
  smtp_port: number;
  smtp_use_tls: boolean;
  needsPassword: boolean;
};

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: "Gmail",
    icon: <Mail className="h-5 w-5 text-red-500" />,
    provider: "gmail",
    imap_server: "imap.gmail.com",
    imap_port: 993,
    imap_use_tls: true,
    smtp_server: "smtp.gmail.com",
    smtp_port: 587,
    smtp_use_tls: true,
    needsPassword: true,
  },
  {
    label: "Outlook",
    icon: <Globe className="h-5 w-5 text-blue-500" />,
    provider: "outlook",
    imap_server: "outlook.office365.com",
    imap_port: 993,
    imap_use_tls: true,
    smtp_server: "smtp.office365.com",
    smtp_port: 587,
    smtp_use_tls: true,
    needsPassword: true,
  },
  {
    label: "Personnalise",
    icon: <Server className="h-5 w-5 text-muted-foreground" />,
    provider: "custom",
    imap_server: "",
    imap_port: 993,
    imap_use_tls: true,
    smtp_server: "",
    smtp_port: 587,
    smtp_use_tls: true,
    needsPassword: true,
  },
  {
    label: "Local (Mailpit/Test)",
    icon: <TestTube className="h-5 w-5 text-green-500" />,
    provider: "local",
    imap_server: "localhost",
    imap_port: 1143,
    imap_use_tls: false,
    smtp_server: "localhost",
    smtp_port: 1025,
    smtp_use_tls: false,
    needsPassword: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSignatureHtml(data: SignatureData): string {
  const parts: string[] = [];

  if (data.logo_url) {
    parts.push(
      `<img src="${data.logo_url}" alt="logo" style="max-height:48px;margin-bottom:8px;display:block;" />`,
    );
  }

  parts.push(
    `
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
  `.trim(),
  );

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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
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
        disabled={disabled}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-primary
          disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ─── Add Account Wizard ──────────────────────────────────────────────────────

function AddAccountWizard({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"provider" | "details">("provider");
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [imapServer, setImapServer] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUseTls, setImapUseTls] = useState(true);
  const [smtpServer, setSmtpServer] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUseTls, setSmtpUseTls] = useState(true);
  const [appPassword, setAppPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSelectProvider = (preset: ProviderPreset) => {
    setSelectedPreset(preset);
    setImapServer(preset.imap_server);
    setImapPort(String(preset.imap_port));
    setImapUseTls(preset.imap_use_tls);
    setSmtpServer(preset.smtp_server);
    setSmtpPort(String(preset.smtp_port));
    setSmtpUseTls(preset.smtp_use_tls);
    setStep("details");
  };

  const handleCreate = async () => {
    if (!email.trim()) {
      toast.error("Veuillez saisir une adresse email");
      return;
    }
    if (!selectedPreset) return;

    setCreating(true);
    try {
      const payload: CreateAccountRequest = {
        email_address: email.trim(),
        display_name: displayName.trim() || undefined,
        provider: selectedPreset.provider as MailProvider,
        imap_server: imapServer || undefined,
        imap_port: parseInt(imapPort) || undefined,
        imap_use_tls: imapUseTls,
        smtp_server: smtpServer || undefined,
        smtp_port: parseInt(smtpPort) || undefined,
        smtp_use_tls: smtpUseTls,
        app_password: appPassword.trim() || undefined,
      };
      await accountApi.create(payload);
      toast.success("Compte ajouté avec succès !");
      onCreated();
    } catch (err) {
      console.error("Impossible de créer account:", err);
      toast.error("Impossible de créer le compte");
    } finally {
      setCreating(false);
    }
  };

  if (step === "provider") {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Ajouter un compte</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choisissez votre fournisseur de messagerie.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Annuler
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.provider}
              onClick={() => handleSelectProvider(preset)}
              className="flex items-center gap-3 px-4 py-4 rounded-lg border bg-background hover:bg-accent hover:border-primary/50 transition-all text-left"
            >
              {preset.icon}
              <div>
                <p className="font-medium text-sm">{preset.label}</p>
                <p className="text-xs text-muted-foreground">
                  {preset.provider === "custom"
                    ? "Serveur IMAP/SMTP personnalise"
                    : preset.provider === "local"
                      ? "localhost:1025, sans TLS"
                      : `${preset.imap_server}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const isCustom = selectedPreset?.provider === "custom";

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedPreset?.icon}
          <div>
            <h2 className="text-lg font-semibold">
              {selectedPreset?.label} - Configuration
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Renseignez les informations de votre compte.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep("provider")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Retour
          </button>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Annuler
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Adresse email"
          value={email}
          onChange={setEmail}
          placeholder="vous@exemple.com"
          type="email"
        />
        <Field
          label="Nom d'affichage (optionnel)"
          value={displayName}
          onChange={setDisplayName}
          placeholder="Jean Dupont"
        />

        {selectedPreset?.needsPassword && (
          <div className="sm:col-span-2">
            <Field
              label="Mot de passe d'application"
              value={appPassword}
              onChange={setAppPassword}
              placeholder={
                selectedPreset.provider === "gmail"
                  ? "Mot de passe d'app Google (16 caracteres)"
                  : "Mot de passe"
              }
              type="password"
            />
            {selectedPreset.provider === "gmail" && (
              <p className="text-xs text-muted-foreground mt-1">
                Generez un mot de passe d&apos;application depuis{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  myaccount.google.com/apppasswords
                </a>
              </p>
            )}
          </div>
        )}

        <Field
          label="Serveur IMAP"
          value={imapServer}
          onChange={setImapServer}
          placeholder="imap.exemple.com"
          disabled={!isCustom}
        />
        <Field
          label="Port IMAP"
          value={imapPort}
          onChange={setImapPort}
          placeholder="993"
          disabled={!isCustom}
        />
        <Field
          label="Serveur SMTP"
          value={smtpServer}
          onChange={setSmtpServer}
          placeholder="smtp.exemple.com"
          disabled={!isCustom}
        />
        <Field
          label="Port SMTP"
          value={smtpPort}
          onChange={setSmtpPort}
          placeholder="587"
          disabled={!isCustom}
        />

        {isCustom && (
          <>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="imap-tls"
                checked={imapUseTls}
                onChange={(e) => setImapUseTls(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="imap-tls" className="text-sm">
                IMAP TLS/SSL
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="smtp-tls"
                checked={smtpUseTls}
                onChange={(e) => setSmtpUseTls(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="smtp-tls" className="text-sm">
                SMTP TLS/STARTTLS
              </label>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleCreate}
          disabled={creating || !email.trim()}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground
            text-sm font-medium hover:bg-primary/90 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {creating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Creation...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Ajouter le compte
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Google OAuth Setup Wizard ───────────────────────────────────────────────

function GoogleOAuthSetupWizard({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    accountApi
      .getOAuthConfig("google")
      .then((cfg) => {
        if (cfg.client_id) setClientId(cfg.client_id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Client ID et Client Secret requis");
      return;
    }
    setSaving(true);
    try {
      await accountApi.saveOAuthConfig(
        "google",
        clientId.trim(),
        clientSecret.trim(),
      );
      toast.success("Configuration Google OAuth enregistree");
      onSaved();
      onClose();
    } catch {
      toast.error("Impossible d'enregistrer la configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">
              Configuration Google OAuth
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Entrez vos identifiants Google Cloud Console pour activer OAuth.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Annuler
        </button>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2 text-muted-foreground">
        <p className="font-medium text-foreground">
          Comment obtenir vos identifiants :
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Allez sur{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.cloud.google.com/apis/credentials
            </a>
          </li>
          <li>Creez un projet et activez l&apos;API Gmail</li>
          <li>Creez des identifiants OAuth 2.0 (type: Application Web)</li>
          <li>
            Ajoutez{" "}
            <code className="bg-muted px-1 rounded text-xs">
              http://localhost:3000/mail/callback/google
            </code>{" "}
            comme URI de redirection
          </li>
          <li>Copiez le Client ID et le Client Secret ci-dessous</li>
        </ol>
      </div>

      {loading ? (
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
      ) : (
        <div className="space-y-4">
          <Field
            label="Google Client ID"
            value={clientId}
            onChange={setClientId}
            placeholder="123456789-abc.apps.googleusercontent.com"
          />
          <Field
            label="Google Client Secret"
            value={clientSecret}
            onChange={setClientSecret}
            placeholder="GOCSPX-..."
            type="password"
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground
            text-sm font-medium hover:bg-primary/90 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Enregistrer
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─��─ Microsoft OAuth Setup Wizard ───���────────────────────────────────────────

function MicrosoftOAuthSetupWizard({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    accountApi
      .getOAuthConfig("microsoft")
      .then((cfg) => {
        if (cfg.client_id) setClientId(cfg.client_id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Client ID et Client Secret requis");
      return;
    }
    setSaving(true);
    try {
      await accountApi.saveOAuthConfig(
        "microsoft",
        clientId.trim(),
        clientSecret.trim(),
      );
      toast.success("Configuration Microsoft OAuth enregistree");
      onSaved();
      onClose();
    } catch {
      toast.error("Impossible d'enregistrer la configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">
              Configuration Microsoft OAuth
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Entrez vos identifiants Azure AD pour activer OAuth Microsoft 365.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Annuler
        </button>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2 text-muted-foreground">
        <p className="font-medium text-foreground">
          Comment obtenir vos identifiants :
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Allez sur{" "}
            <a
              href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Azure AD &mdash; Inscriptions d&apos;applications
            </a>
          </li>
          <li>
            Creez une nouvelle inscription (type: Comptes dans un annuaire
            organisationnel et comptes Microsoft personnels)
          </li>
          <li>
            Ajoutez{" "}
            <code className="bg-muted px-1 rounded text-xs">
              http://localhost:3000/mail/callback/microsoft
            </code>{" "}
            comme URI de redirection (Web)
          </li>
          <li>
            Dans &quot;Certificats et secrets&quot;, creez un secret client
          </li>
          <li>
            Ajoutez les permissions API : IMAP.AccessAsUser.All, SMTP.Send
            (Office 365 Exchange Online)
          </li>
          <li>Copiez le Client ID et le Client Secret ci-dessous</li>
        </ol>
      </div>

      {loading ? (
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
      ) : (
        <div className="space-y-4">
          <Field
            label="Microsoft Client ID (Application ID)"
            value={clientId}
            onChange={setClientId}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          <Field
            label="Microsoft Client Secret"
            value={clientSecret}
            onChange={setClientSecret}
            placeholder="~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            type="password"
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground
            text-sm font-medium hover:bg-primary/90 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Enregistrer
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onSupprimé,
  onSynced,
  userId,
}: {
  account: MailAccount;
  onSupprimé: () => void;
  onSynced: () => void;
  userId?: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    imap_ok: boolean;
    smtp_ok: boolean;
    imap_error?: string;
    smtp_error?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await accountApi.sync(account.id);
      toast.success("Synchronisation lancée");
      onSynced();
    } catch {
      toast.error("Échec de la synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await accountApi.test(account.id);
      setTestResult(result);
      if (result.imap_ok && result.smtp_ok) {
        toast.success("Connexion réussie !");
      } else {
        toast.error("Certains tests ont échoué");
      }
    } catch {
      toast.error("Impossible de tester la connexion");
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await accountApi.delete(account.id);
      toast.success("Compte supprimé");
      onSupprimé();
    } catch {
      toast.error("Impossible de supprimer le compte");
    } finally {
      setDeleting(false);
    }
  };

  const handleOAuthConnect = async (provider: "google" | "microsoft") => {
    if (!userId) {
      toast.error("Utilisateur non identifié");
      return;
    }
    setConnectingOAuth(true);
    try {
      const { url } =
        provider === "microsoft"
          ? await accountApi.getMicrosoftOAuthUrl()
          : await accountApi.getGoogleOAuthUrl();
      // Open OAuth popup
      const popup = window.open(
        url,
        `${provider}_oauth`,
        "width=600,height=700,left=200,top=100",
      );
      popupRef.current = popup;

      // Listen for the callback via postMessage
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === "oauth_callback" && event.data?.code) {
          window.removeEventListener("message", handleMessage);
          popupRef.current?.close();
          try {
            if (provider === "microsoft") {
              await accountApi.exchangeMicrosoftOAuthCode(
                event.data.code,
                userId,
              );
              toast.success("Connecte via Microsoft OAuth");
            } else {
              await accountApi.exchangeGoogleOAuthCode(event.data.code, userId);
              toast.success("Connecte via Google OAuth");
            }
            onSynced();
          } catch {
            toast.error("Echec de l'echange OAuth");
          } finally {
            setConnectingOAuth(false);
          }
        }
      };
      window.addEventListener("message", handleMessage);

      // Poll to detect if popup was closed without completing
      const pollTimer = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(pollTimer);
          window.removeEventListener("message", handleMessage);
          setConnectingOAuth(false);
        }
      }, 1000);
    } catch {
      toast.error("Impossible de lancer le flux OAuth");
      setConnectingOAuth(false);
    }
  };

  const isGoogle =
    account.provider === "gmail" || account.provider === "google";
  const isMicrosoft =
    account.provider === "outlook" || account.provider === "microsoft";
  const isGmailOrOutlook = isGoogle || isMicrosoft;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm flex items-center gap-2">
              {account.email_address}
              {account.has_oauth_token && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <ShieldCheck className="h-3 w-3" />
                  {isMicrosoft ? "Microsoft" : "Google"} OAuth
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {account.provider} &middot; {account.status || "active"}
              {account.last_sync_at && (
                <>
                  {" "}
                  &middot; Synchro:{" "}
                  {new Date(account.last_sync_at).toLocaleString()}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            title="Synchroniser"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            title="Tester la connexion"
          >
            <TestTube className={`h-4 w-4 ${testing ? "animate-pulse" : ""}`} />
          </button>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="p-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-50"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Server details */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          IMAP: {account.imap_server || "N/A"}:{account.imap_port || "N/A"}
          {account.imap_use_tls ? " (TLS)" : ""}
        </div>
        <div>
          SMTP: {account.smtp_server || "N/A"}:{account.smtp_port || "N/A"}
          {account.smtp_use_tls ? " (TLS)" : ""}
        </div>
      </div>

      {/* OAuth connect buttons (Gmail/Outlook/Google/Microsoft accounts) */}
      {isGmailOrOutlook && (
        <div className="pt-1">
          {account.has_oauth_token ? (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <ShieldCheck className="h-4 w-4" />
              <span>
                Connecte via {isMicrosoft ? "Microsoft" : "Google"} OAuth
                &mdash; synchronisation IMAP securisee
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {isGoogle && (
                <button
                  onClick={() => handleOAuthConnect("google")}
                  disabled={connectingOAuth}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background
                    hover:bg-accent text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectingOAuth ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  {connectingOAuth
                    ? "Connexion..."
                    : "Se connecter avec Google"}
                </button>
              )}
              {isMicrosoft && (
                <button
                  onClick={() => handleOAuthConnect("microsoft")}
                  disabled={connectingOAuth}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background
                    hover:bg-accent text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connectingOAuth ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 23 23"
                      aria-hidden="true"
                    >
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#00a4ef" d="M1 12h10v10H1z" />
                      <path fill="#7fba00" d="M12 1h10v10H12z" />
                      <path fill="#ffb900" d="M12 12h10v10H12z" />
                    </svg>
                  )}
                  {connectingOAuth
                    ? "Connexion..."
                    : "Se connecter avec Microsoft"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test results */}
      {testResult && (
        <div className="flex items-center gap-4 text-xs pt-1">
          <span className="flex items-center gap-1">
            {testResult.imap_ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            IMAP {testResult.imap_ok ? "OK" : testResult.imap_error || "Echec"}
          </span>
          <span className="flex items-center gap-1">
            {testResult.smtp_ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            SMTP {testResult.smtp_ok ? "OK" : testResult.smtp_error || "Echec"}
          </span>
        </div>
      )}

      {account.last_error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
          {account.last_error}
        </p>
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Supprimer le compte mail"
        description={`Voulez-vous vraiment supprimer le compte "${account.email_address}" ? Cette action est irréversible.`}
        onConfirm={handleDeleteConfirmed}
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
    const signatureHtml =
      mode === "builder" ? buildSignatureHtml(sig) : rawHtml;
    // Plain text fallback
    const signatureText = signatureHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    try {
      await mailApi.updateAccount(account.id, {
        signature_html: signatureHtml,
        signature_text: signatureText,
      });
      toast.success("Signature enregistree");
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
          <Field
            label="Nom complet"
            value={sig.name}
            onChange={setField("name")}
            placeholder="Jean Dupont"
          />
          <Field
            label="Poste / Fonction"
            value={sig.title}
            onChange={setField("title")}
            placeholder="Directeur Technique"
          />
          <Field
            label="Entreprise"
            value={sig.company}
            onChange={setField("company")}
            placeholder="SignApps"
          />
          <Field
            label="Telephone"
            value={sig.phone}
            onChange={setField("phone")}
            placeholder="+33 1 23 45 67 89"
          />
          <Field
            label="E-mail"
            value={sig.email}
            onChange={setField("email")}
            placeholder="jean@exemple.fr"
            type="email"
          />
          <Field
            label="Site web"
            value={sig.website}
            onChange={setField("website")}
            placeholder="https://exemple.fr"
            type="url"
          />
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
              placeholder='<a href="https://linkedin.com/in/...">LinkedIn</a>'
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
          Apercu
        </p>
        <iframe
          srcDoc={preview || "<em style='color:#999'>Apercu vide</em>"}
          sandbox=""
          className="rounded-xl border bg-card w-full min-h-24"
          style={{ height: "120px" }}
          title="Apercu signature"
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
          {saving ? "Enregistrement..." : "Enregistrer la signature"}
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(preview);
            toast.success("HTML copie dans le presse-papier");
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
  usePageTitle("Parametres mail");
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [showOAuthWizard, setShowOAuthWizard] = useState(false);
  const [showMsOAuthWizard, setShowMsOAuthWizard] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await accountApi.list();
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parametres Mail</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerez vos comptes de messagerie et signatures.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOAuthWizard((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-accent transition-colors"
            title="Configurer Google OAuth (Client ID / Secret)"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Google OAuth
          </button>
          <button
            onClick={() => setShowMsOAuthWizard((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-accent transition-colors"
            title="Configurer Microsoft OAuth (Client ID / Secret)"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Microsoft OAuth
          </button>
          <a href="/mail" className="text-sm text-primary hover:underline">
            &larr; Retour au mail
          </a>
        </div>
      </div>

      {/* Google OAuth Setup Wizard */}
      {showOAuthWizard && (
        <GoogleOAuthSetupWizard
          onClose={() => setShowOAuthWizard(false)}
          onSaved={() => {
            setShowOAuthWizard(false);
            loadAccounts();
          }}
        />
      )}

      {/* Microsoft OAuth Setup Wizard */}
      {showMsOAuthWizard && (
        <MicrosoftOAuthSetupWizard
          onClose={() => setShowMsOAuthWizard(false)}
          onSaved={() => {
            setShowMsOAuthWizard(false);
            loadAccounts();
          }}
        />
      )}

      {/* Add Account button / wizard */}
      {showAddWizard ? (
        <AddAccountWizard
          onCreated={() => {
            setShowAddWizard(false);
            loadAccounts();
          }}
          onCancel={() => setShowAddWizard(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddWizard(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed
              border-primary/30 hover:border-primary/60 text-primary hover:bg-primary/5 transition-all text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Ajouter un compte
        </button>
      )}

      {loading ? (
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      ) : accounts.length === 0 && !showAddWizard ? (
        <div className="rounded-xl border p-12 text-center text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucun compte mail configure.</p>
          <p className="text-sm mt-1">
            Cliquez sur &quot;Ajouter un compte&quot; pour commencer.
          </p>
        </div>
      ) : (
        <>
          {/* Account list */}
          {accounts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Comptes configures</h2>
              {accounts.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  onSupprimé={loadAccounts}
                  onSynced={loadAccounts}
                  userId={user?.id}
                />
              ))}
            </div>
          )}

          {/* Account selector for signature */}
          {accounts.length > 1 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t">
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
                  Signature &mdash; {selectedAccount.email_address}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Cette signature sera ajoutee automatiquement a vos messages
                  sortants.
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

      {/* IDEA-127: Email automation rules */}
      <div className="pt-6 border-t mt-6">
        <EmailAutomationRules />
      </div>

      {/* Mail Templates link */}
      <div className="pt-6 border-t mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Modèles d&apos;email</p>
              <p className="text-xs text-muted-foreground">
                Créez et gérez vos modèles réutilisables avec variables
                dynamiques.
              </p>
            </div>
          </div>
          <Link href="/mail/templates">
            <button className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
              Gérer les modèles
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
