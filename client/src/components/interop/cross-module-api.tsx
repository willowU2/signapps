"use client";

// Idea 50: Cross-module API — unified REST API for external integrations

import { useState, useEffect, useCallback } from "react";
import {
  Code2,
  Copy,
  ExternalLink,
  Key,
  Plus,
  Trash2,
  RefreshCw,
  Shield,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const identityClient = () => getClient(ServiceName.IDENTITY);

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  scopes: string[];
  created_at: string;
  last_used?: string;
  expires_at?: string;
}

const AVAILABLE_SCOPES = [
  { id: "read:docs", label: "Lire documents" },
  { id: "write:docs", label: "Écrire documents" },
  { id: "read:contacts", label: "Lire contacts" },
  { id: "write:contacts", label: "Écrire contacts" },
  { id: "read:tasks", label: "Lire tâches" },
  { id: "write:tasks", label: "Écrire tâches" },
  { id: "read:calendar", label: "Lire calendrier" },
  { id: "write:calendar", label: "Écrire calendrier" },
  { id: "read:mail", label: "Lire emails" },
  { id: "send:mail", label: "Envoyer emails" },
  { id: "read:drive", label: "Lire Drive" },
  { id: "write:drive", label: "Écrire Drive" },
  { id: "read:activities", label: "Lire activités" },
  { id: "admin", label: "Administration complète" },
];

/** Idea 50 – Unified API key management */
export function CrossModuleApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([
    "read:docs",
    "read:contacts",
  ]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await identityClient().get<ApiKey[]>("/api-keys");
      setKeys(data);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const create = async () => {
    if (!name.trim() || !scopes.length) return;
    setCreating(true);
    try {
      const { data } = await identityClient().post<ApiKey & { key: string }>(
        "/api-keys",
        {
          name: name.trim(),
          scopes,
        },
      );
      setNewKey((data as ApiKey & { key: string }).key);
      setKeys((prev) => [...prev, data]);
      toast.success(
        "Clé API créée — copiez-la maintenant, elle ne sera plus affichée",
      );
    } catch {
      // Local demo
      const demoKey = `sa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const local: ApiKey = {
        id: `local-${Date.now()}`,
        name: name.trim(),
        key_preview: demoKey.slice(0, 12) + "…",
        scopes,
        created_at: new Date().toISOString(),
      };
      setKeys((prev) => [...prev, local]);
      setNewKey(demoKey);
      toast.info("Clé créée en mode démo");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    try {
      await identityClient().delete(`/api-keys/${id}`);
    } catch {
      /* optimistic */
    }
    toast.success("Clé API révoquée");
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => toast.success("Clé copiée"));
  };

  if (loading) return <div className="animate-pulse h-24 rounded bg-muted" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Code2 className="w-4 h-4" />
          API unifiée — Clés d'accès
        </div>
        <Button
          size="sm"
          onClick={() => {
            setOpen(true);
            setName("");
            setScopes(["read:docs", "read:contacts"]);
            setNewKey(null);
          }}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Créer une clé
        </Button>
      </div>

      {/* API base URL info */}
      <Card className="border-dashed">
        <CardContent className="p-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">URL de l'API unifiée</p>
            <code className="text-[10px] text-muted-foreground break-all">
              {typeof window !== "undefined"
                ? window.location.origin
                : "https://your-instance"}
              /api/v1
            </code>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
            <a href="/api" target="_blank">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {keys.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            Aucune clé API configurée
          </p>
        )}
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-3 p-2.5 rounded-lg border"
          >
            <Key className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-medium">{k.name}</p>
                {k.scopes.slice(0, 3).map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="text-[9px] h-3.5 px-1"
                  >
                    {s}
                  </Badge>
                ))}
                {k.scopes.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{k.scopes.length - 3}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {k.key_preview} · Créée{" "}
                {new Date(k.created_at).toLocaleDateString("fr-FR")}
                {k.last_used &&
                  ` · Utilisée ${new Date(k.last_used).toLocaleDateString("fr-FR")}`}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => revoke(k.id)}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Nouvelle clé API
            </DialogTitle>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-3 py-2">
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200">
                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Copiez cette clé maintenant
                </p>
                <code className="text-xs break-all">{newKey}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyKey(newKey)}
                  className="mt-2 h-7 gap-1 text-xs w-full"
                >
                  <Copy className="w-3 h-3" />
                  Copier
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cette clé ne sera plus affichée après fermeture.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Nom de la clé</Label>
                <Input
                  placeholder="Mon intégration"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Permissions (scopes)</Label>
                <ScrollArea className="h-44 border rounded-md p-2">
                  <div className="space-y-1.5">
                    {AVAILABLE_SCOPES.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`scope-${s.id}`}
                          checked={scopes.includes(s.id)}
                          onCheckedChange={() => toggleScope(s.id)}
                        />
                        <Label
                          htmlFor={`scope-${s.id}`}
                          className="text-xs cursor-pointer"
                        >
                          {s.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-7 text-xs"
            >
              {newKey ? "Fermer" : "Annuler"}
            </Button>
            {!newKey && (
              <Button
                onClick={create}
                disabled={creating || !name.trim() || !scopes.length}
                className="h-7 gap-1 text-xs"
              >
                <Key className="w-3 h-3" />
                Créer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
