"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Key, Plus, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { socialApi } from "@/lib/api/social";
import type { ApiKeyInfo } from "@/lib/api/social";

// --- Constants ---

const SCOPES = [
  {
    value: "read",
    label: "Read",
    description: "Read posts, accounts, analytics",
  },
  {
    value: "write",
    label: "Write",
    description: "Create and update posts, manage accounts",
  },
  {
    value: "delete",
    label: "Delete",
    description: "Delete posts and other resources",
  },
];

// --- Create Key Dialog ---

function CreateKeyDialog({
  open,
  onClose,
  onCreate,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    scopes: string[];
    expiresAt?: string;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setScopes(["read"]);
      setExpiresAt("");
    }
  }, [open]);

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = () => {
    if (!name.trim() || scopes.length === 0) return;
    onCreate({
      name: name.trim(),
      scopes,
      expiresAt: expiresAt || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              placeholder="My Integration"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="space-y-2">
              {SCOPES.map((scope) => (
                <button
                  key={scope.value}
                  type="button"
                  onClick={() => toggleScope(scope.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    scopes.includes(scope.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium">{scope.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {scope.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Expiry Date (optional)</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank for no expiry
            </p>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={!name.trim() || scopes.length === 0 || saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Key
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Key Reveal Dialog ---

function KeyRevealDialog({
  open,
  onClose,
  fullKey,
}: {
  open: boolean;
  onClose: () => void;
  fullKey: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullKey);
    setCopied(true);
    toast.success("Clé API copiée dans le presse-papiers");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Save this key now
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This is the only time the full key will be shown. Store it
                  securely.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-lg border bg-muted/50 p-3 font-mono text-sm break-all pr-12">
              {fullKey}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button className="w-full" onClick={onClose}>
            I have saved the key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await socialApi.apiKeys.list();
      setApiKeys(res.data);
    } catch {
      toast.error("Impossible de charger les clés API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreate = async (data: {
    name: string;
    scopes: string[];
    expiresAt?: string;
  }) => {
    try {
      setSaving(true);
      const res = await socialApi.apiKeys.create(data);
      const rawKey = res.data.key;
      toast.success("API key created");
      setIsCreateOpen(false);
      setRevealedKey(rawKey);
      await fetchApiKeys();
    } catch {
      toast.error("Impossible de créer la clé API");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      await socialApi.apiKeys.revoke(revokeId);
      toast.success("Clé API révoquée");
      setRevokeId(null);
      await fetchApiKeys();
    } catch {
      toast.error("Impossible de révoquer API key");
    }
  };

  const scopeColor = (scope: string) => {
    switch (scope) {
      case "read":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      case "write":
        return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
      case "delete":
        return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
      default:
        return "";
    }
  };

  const activeKeys = apiKeys.filter((k) => !k.revoked);
  const revokedKeys = apiKeys.filter((k) => k.revoked);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">API Keys</h2>
            <p className="text-sm text-muted-foreground">
              Manage API keys for programmatic access to SignSocial
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create API Key
          </Button>
        </div>

        {apiKeys.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-12 text-center">
            <Key className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium">No API keys</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create an API key to integrate with external tools
            </p>
            <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="py-4 px-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg shrink-0">
                      <Key className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{key.name}</span>
                        <Badge variant="default">Active</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {key.prefix}...
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${scopeColor(scope)}`}
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {key.lastUsedAt && (
                          <span>
                            Last used{" "}
                            {formatDistanceToNow(new Date(key.lastUsedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                        {key.expiresAt && (
                          <span>
                            Expires{" "}
                            {format(new Date(key.expiresAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => setRevokeId(key.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {revokedKeys.length > 0 && (
              <>
                <Separator />
                <p className="text-sm font-medium text-muted-foreground">
                  Revoked Keys
                </p>
                {revokedKeys.map((key) => (
                  <Card key={key.id} className="opacity-60">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-lg shrink-0">
                          <Key className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium line-through">
                              {key.name}
                            </span>
                            <Badge variant="secondary">Revoked</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {key.prefix}...
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        <CreateKeyDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreate}
          saving={saving}
        />

        {revealedKey && (
          <KeyRevealDialog
            open={!!revealedKey}
            onClose={() => setRevealedKey(null)}
            fullKey={revealedKey}
          />
        )}

        <AlertDialog
          open={!!revokeId}
          onOpenChange={(o) => !o && setRevokeId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately invalidate this API key. Any integrations
                using it will stop working. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevoke}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Révoquer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
