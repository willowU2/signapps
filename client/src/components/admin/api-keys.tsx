"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Key,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IDENTITY_URL } from "@/lib/api/core";
import axios from "axios";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used: string | null;
  is_active: boolean;
  created_at: string;
}

interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

const AVAILABLE_SCOPES = [
  "documents.read",
  "documents.write",
  "mail.read",
  "mail.write",
  "calendar.read",
  "calendar.write",
  "storage.read",
  "storage.write",
  "users.read",
  "admin.read",
];

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "documents.read",
  ]);
  const [expiryDays, setExpiryDays] = useState<string>("365");
  const [newKeyResult, setNewKeyResult] = useState<CreateApiKeyResponse | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${IDENTITY_URL}/api-keys`, {
        withCredentials: true,
      });
      setKeys(res.data);
    } catch {
      toast.error("Impossible de charger les clés API");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const createKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Saisissez un nom pour la clé API");
      return;
    }
    setIsCreating(true);
    try {
      const res = await axios.post(
        `${IDENTITY_URL}/api-keys`,
        {
          name: newKeyName.trim(),
          scopes: selectedScopes,
          expires_in_days: expiryDays ? parseInt(expiryDays, 10) : null,
        },
        { withCredentials: true },
      );
      setNewKeyResult(res.data);
      setShowForm(false);
      await fetchKeys();
      toast.success(
        "Clé API créée — copiez-la maintenant, elle ne sera plus affichée",
      );
    } catch {
      toast.error("Impossible de créer la clé API");
    } finally {
      setIsCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    setRevoking((prev) => new Set(prev).add(id));
    try {
      await axios.delete(`${IDENTITY_URL}/api-keys/${id}`, {
        withCredentials: true,
      });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("Clé API révoquée");
    } catch {
      toast.error("Impossible de révoquer la clé");
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const copyKey = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">API Keys</h2>
            <p className="text-sm text-muted-foreground">
              {keys.filter((k) => k.is_active).length} active keys
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchKeys}
            disabled={isLoading}
            className="gap-1"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowForm(true);
              setNewKeyResult(null);
            }}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            New Key
          </Button>
        </div>
      </div>

      {/* New key revealed result */}
      {newKeyResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="font-medium text-green-800">
            Key created — copy it now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-card border border-green-200 px-3 py-2 font-mono text-sm break-all">
              {showKey ? newKeyResult.key : "•".repeat(40)}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyKey(newKeyResult.key, "new")}
            >
              {copiedId === "new" ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNewKeyResult(null)}
            className="text-xs text-muted-foreground"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-foreground">Create New API Key</h3>
          <Input
            placeholder="Key name (e.g. CI/CD pipeline)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Scopes
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedScopes.includes(scope)
                      ? "border-blue-500 bg-blue-100 text-blue-700"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Expires in days
              </label>
              <Input
                type="number"
                min="1"
                max="3650"
                placeholder="365"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={createKey}
              disabled={isCreating}
              className="flex-1 gap-2"
            >
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Key
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-8 text-center text-muted-foreground">
          No API keys yet
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`rounded-lg border p-4 shadow-sm ${key.is_active ? "border-border bg-card" : "border-gray-100 bg-muted opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">
                      {key.name}
                    </span>
                    {!key.is_active && (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    )}
                    {key.expires_at &&
                      new Date(key.expires_at) < new Date() && (
                        <Badge
                          variant="outline"
                          className="text-xs text-orange-600 border-orange-300"
                        >
                          Expired
                        </Badge>
                      )}
                  </div>
                  <code className="mt-1 block font-mono text-xs text-muted-foreground">
                    {key.prefix}…
                  </code>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {key.scopes.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400">
                    <span>Created {formatDate(key.created_at)}</span>
                    <span>Last used {formatDate(key.last_used)}</span>
                    {key.expires_at && (
                      <span>Expires {formatDate(key.expires_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyKey(key.prefix, key.id)}
                    title="Copy prefix"
                  >
                    {copiedId === key.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  {key.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeKey(key.id)}
                      disabled={revoking.has(key.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      {revoking.has(key.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
