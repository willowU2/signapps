"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Copy, RefreshCw, Key } from "lucide-react";

interface OAuthClient {
  id: string;
  name: string;
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  scopes: string[];
  enabled: boolean;
  created_at: string;
}

const AVAILABLE_SCOPES = [
  "openid",
  "profile",
  "email",
  "read:docs",
  "write:docs",
  "read:storage",
  "admin",
];

function generateId() {
  return Math.random().toString(36).slice(2, 12);
}

const SAMPLE: OAuthClient[] = [
  {
    id: "1",
    name: "Mobile App",
    client_id: "app_" + generateId(),
    client_secret: "sec_" + generateId(),
    redirect_uris: ["com.signapps.mobile://oauth/callback"],
    scopes: ["openid", "profile", "email"],
    enabled: true,
    created_at: new Date().toISOString(),
  },
];

export function OAuth2AuthServer() {
  const [clients, setClients] = useState<OAuthClient[]>(SAMPLE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUri, setNewUri] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>([
    "openid",
    "profile",
    "email",
  ]);
  const [revealed, setRevealed] = useState<string | null>(null);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const addClient = () => {
    if (!newName.trim()) {
      toast.error("Nom requis");
      return;
    }
    const c: OAuthClient = {
      id: Date.now().toString(),
      name: newName,
      client_id: "app_" + generateId(),
      client_secret: "sec_" + generateId(),
      redirect_uris: newUri ? [newUri] : [],
      scopes: newScopes,
      enabled: true,
      created_at: new Date().toISOString(),
    };
    setClients((cs) => [...cs, c]);
    setDialogOpen(false);
    setNewName("");
    setNewUri("");
    setNewScopes(["openid", "profile", "email"]);
    toast.success("OAuth2 client created");
  };

  const rotateSecret = (id: string) => {
    setClients((cs) =>
      cs.map((c) =>
        c.id === id ? { ...c, client_secret: "sec_" + generateId() } : c,
      ),
    );
    toast.success("Secret rotated");
  };

  const deleteClient = (id: string) => {
    setClients((cs) => cs.filter((c) => c.id !== id));
    toast.success("Client deleted");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" /> OAuth2 Authorization Server
              </CardTitle>
              <CardDescription>
                Issue access tokens to third-party applications
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Client
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-3 mb-4 text-sm space-y-1">
            <p className="font-medium">Authorization Endpoint</p>
            <code className="text-xs">GET /api/v1/oauth2/authorize</code>
            <p className="font-medium mt-2">Token Endpoint</p>
            <code className="text-xs">POST /api/v1/oauth2/token</code>
          </div>

          <div className="space-y-4">
            {clients.map((c) => (
              <div key={c.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant={c.enabled ? "default" : "secondary"}>
                      {c.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => rotateSecret(c.id)}
                      title="Rotate secret"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteClient(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">
                      Client ID
                    </span>
                    <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono">
                      {c.client_id}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => copy(c.client_id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">
                      Client Secret
                    </span>
                    <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono">
                      {revealed === c.id ? c.client_secret : "••••••••••••••••"}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() =>
                        setRevealed((r) => (r === c.id ? null : c.id))
                      }
                    >
                      {revealed === c.id ? "Hide" : "Show"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => copy(c.client_secret)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-24 shrink-0 mt-0.5">
                      Scopes
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {c.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {clients.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">
                No OAuth2 clients yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New OAuth2 Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Application Name</Label>
              <Input
                placeholder="My App"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Redirect URI</Label>
              <Input
                placeholder="https://app.example.com/callback"
                value={newUri}
                onChange={(e) => setNewUri(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() =>
                      setNewScopes((sc) =>
                        sc.includes(s) ? sc.filter((x) => x !== s) : [...sc, s],
                      )
                    }
                    className={`text-xs px-2 py-1 rounded border transition-colors ${newScopes.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={addClient}>Create Client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
