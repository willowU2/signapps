"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  prefix: string;
  scopes: string[];
  expiryDate: Date | null;
  lastUsed: Date | null;
  isActive: boolean;
}

const STORAGE_KEY = "signapps_api_keys";

function loadKeys(): ApiKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((k: ApiKey) => ({
      ...k,
      expiryDate: k.expiryDate ? new Date(k.expiryDate) : null,
      lastUsed: k.lastUsed ? new Date(k.lastUsed) : null,
    }));
  } catch {
    return [];
  }
}

function saveKeys(keys: ApiKey[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "sk_live_" + Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setApiKeys(loadKeys());
    setIsLoading(false);
  }, []);

  const handleGenerateKey = () => {
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      prefix: generateToken(),
      scopes: ["documents.read", "documents.write"],
      expiryDate: null,
      lastUsed: null,
      isActive: true,
    };
    const updated = [newKey, ...apiKeys];
    setApiKeys(updated);
    saveKeys(updated);
    toast.success("New API key generated");
  };

  const handleCopy = (prefix: string, id: string) => {
    navigator.clipboard.writeText(prefix);
    setCopiedId(id);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) return;
    const updated = apiKeys.filter((k) => k.id !== id);
    setApiKeys(updated);
    saveKeys(updated);
    toast.success("API key revoked");
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getExpiryStatus = (date: Date | null): { text: string; className: string } => {
    if (!date) return { text: "No expiry", className: "text-green-600" };
    const now = new Date();
    const daysUntilExpiry = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return { text: "Expired", className: "text-destructive" };
    if (daysUntilExpiry < 7) return { text: `Expires in ${daysUntilExpiry}d`, className: "text-orange-600" };
    if (daysUntilExpiry < 30) return { text: `Expires in ${daysUntilExpiry}d`, className: "text-yellow-600" };
    return { text: `Expires in ${daysUntilExpiry}d`, className: "text-gray-600" };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">API Keys</h3>
        <Button onClick={handleGenerateKey} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Generate Key
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Loading API keys...</div>
      ) : apiKeys.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          <p>No API keys generated yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => {
            const expiryStatus = getExpiryStatus(key.expiryDate);
            const isRevealed = revealedId === key.id;

            return (
              <div
                key={key.id}
                className={`rounded-lg border p-4 ${
                  key.isActive
                    ? "border-gray-200 bg-white hover:shadow-sm transition-shadow"
                    : "border-gray-100 bg-gray-50 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono font-semibold text-gray-700">
                        {isRevealed ? key.prefix : key.prefix.slice(0, 12) + "..." + key.prefix.slice(-4)}
                      </code>
                      {!key.isActive && (
                        <span className="text-xs px-2 py-1 rounded-md bg-destructive/10 text-destructive font-medium">
                          Revoked
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div>
                        <span className={`font-medium ${expiryStatus.className}`}>
                          {expiryStatus.text}
                        </span>
                      </div>
                      <div>Last used: {formatDate(key.lastUsed)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setRevealedId(isRevealed ? null : key.id)}
                      disabled={!key.isActive}
                    >
                      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleCopy(key.prefix, key.id)}
                      disabled={!key.isActive}
                    >
                      {copiedId === key.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(key.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
