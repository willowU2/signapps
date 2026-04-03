"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePageTitle } from "@/hooks/use-page-title";
import { MAIL_URL } from "@/lib/api/core";
import {
  Mail,
  Server,
  Globe,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserPlus,
} from "lucide-react";
import axios from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StalwartStatus {
  online: boolean;
  api_url: string;
  error: string | null;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
}

interface StalwartDomain {
  name: string;
}

interface StalwartAccount {
  name: string;
  type?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const api = axios.create({ baseURL: MAIL_URL });

// Attach JWT token from localStorage for every request
api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function fetchStatus(): Promise<StalwartStatus> {
  const { data } = await api.get("/api/v1/mail/internal/status");
  return data;
}

async function fetchDomains(): Promise<StalwartDomain[]> {
  const { data } = await api.get("/api/v1/mail/internal/domains");
  return data.domains ?? [];
}

async function fetchAccounts(): Promise<StalwartAccount[]> {
  const { data } = await api.get("/api/v1/mail/internal/accounts");
  return data.accounts ?? [];
}

async function createMailbox(
  email: string,
  name: string,
  password: string,
): Promise<void> {
  await api.post("/api/v1/mail/internal/accounts", { email, name, password });
}

async function deleteMailbox(email: string): Promise<void> {
  await api.delete(
    `/api/v1/mail/internal/accounts/${encodeURIComponent(email)}`,
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MailServerPage() {
  usePageTitle("Serveur Mail");

  const [status, setStatus] = useState<StalwartStatus | null>(null);
  const [domains, setDomains] = useState<StalwartDomain[]>([]);
  const [accounts, setAccounts] = useState<StalwartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create mailbox form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, a] = await Promise.all([
        fetchStatus(),
        fetchDomains().catch(() => []),
        fetchAccounts().catch(() => []),
      ]);
      setStatus(s);
      setDomains(d);
      setAccounts(a);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de chargement";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!newEmail.trim() || !newPassword.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createMailbox(
        newEmail.trim(),
        newName.trim() || newEmail.trim(),
        newPassword,
      );
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      await refresh();
    } catch (e: unknown) {
      const msg =
        axios.isAxiosError(e) && e.response?.data?.error
          ? e.response.data.error
          : e instanceof Error
            ? e.message
            : "Erreur lors de la creation";
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Supprimer la boite mail ${email} ?`)) return;
    try {
      await deleteMailbox(email);
      await refresh();
    } catch {
      // silently refresh
      await refresh();
    }
  };

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Serveur Mail Interne</h1>
              <p className="text-sm text-muted-foreground">
                Gestion du serveur Stalwart Mail Server integre
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Actualiser
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Statut du serveur
            </CardTitle>
            {status ? (
              status.online ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  En ligne
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Hors ligne
                </Badge>
              )
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {status && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">API Management</p>
                  <p className="font-mono text-xs">{status.api_url}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IMAP</p>
                  <p className="font-mono text-xs">
                    {status.imap_host}:{status.imap_port}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">SMTP</p>
                  <p className="font-mono text-xs">
                    {status.smtp_host}:{status.smtp_port}
                  </p>
                </div>
                {status.error && (
                  <div className="col-span-full">
                    <p className="text-destructive text-xs">{status.error}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Domains */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                Domaines
              </CardTitle>
              <Badge variant="outline">{domains.length}</Badge>
            </CardHeader>
            <CardContent>
              {domains.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun domaine configure. Configurez le serveur Stalwart via
                  son interface d&apos;administration.
                </p>
              ) : (
                <ul className="space-y-2">
                  {domains.map((d) => (
                    <li
                      key={d.name}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-mono">{d.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Create Mailbox */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-500" />
                Creer une boite mail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor="new-email"
                  >
                    Adresse email
                  </label>
                  <Input
                    id="new-email"
                    placeholder="alice@signapps.local"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor="new-name"
                  >
                    Nom (optionnel)
                  </label>
                  <Input
                    id="new-name"
                    placeholder="Alice Dupont"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor="new-password"
                  >
                    Mot de passe
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Mot de passe IMAP/SMTP"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                {createError && (
                  <p className="text-xs text-destructive">{createError}</p>
                )}
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={creating || !newEmail.trim() || !newPassword.trim()}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Creer la boite mail
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounts list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              Boites mail
            </CardTitle>
            <Badge variant="outline">{accounts.length}</Badge>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune boite mail sur le serveur interne.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        {a.type && (
                          <p className="text-xs text-muted-foreground">
                            {a.type}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(a.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
