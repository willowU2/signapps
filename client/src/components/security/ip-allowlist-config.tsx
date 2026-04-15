"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Shield, Loader2, Info } from "lucide-react";
import { IDENTITY_URL } from "@/lib/api/core";
import axios from "axios";

interface IpEntry {
  address: string;
  cidr: string;
  label: string | null;
  enabled: boolean;
}

function parseCidr(input: string): { address: string; cidr: string } | null {
  // Accept both "192.168.1.0/24" and "192.168.1.0" (assumes /32)
  const slashIdx = input.indexOf("/");
  if (slashIdx === -1) {
    return { address: input.trim(), cidr: "/32" };
  }
  const address = input.slice(0, slashIdx).trim();
  const prefix = input.slice(slashIdx).trim();
  return { address, cidr: prefix };
}

export function IpAllowlistConfig() {
  const [entries, setEntries] = useState<IpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newInput, setNewInput] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${IDENTITY_URL}/admin/security/ip-allowlist`,
        {
          withCredentials: true,
        },
      );
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      // No config yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAdd = () => {
    if (!newInput.trim()) return;
    const parsed = parseCidr(newInput.trim());
    if (!parsed) {
      toast.error("Adresse IP invalide");
      return;
    }
    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F:]+)$/;
    if (!ipRegex.test(parsed.address)) {
      toast.error("Format d'adresse IP invalide (ex: 192.168.1.0/24)");
      return;
    }
    setEntries((prev) => [
      ...prev,
      {
        address: parsed.address,
        cidr: parsed.cidr,
        label: newLabel.trim() || null,
        enabled: true,
      },
    ]);
    setNewInput("");
    setNewLabel("");
  };

  const handleRemove = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggle = (idx: number, value: boolean) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, enabled: value } : e)),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${IDENTITY_URL}/admin/security/ip-allowlist`, entries, {
        withCredentials: true,
      });
      toast.success("Liste blanche IP sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Liste blanche d&apos;adresses IP
          </CardTitle>
          <CardDescription>
            Restreignez l&apos;accès à votre tenant aux adresses IP ou plages
            CIDR autorisées. Si la liste est vide, toutes les IPs sont
            autorisées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Info banner */}
          <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20 p-3 text-sm text-blue-800 dark:text-blue-200">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Exemples : <code className="font-mono">192.168.1.0/24</code>,{" "}
              <code className="font-mono">10.0.0.1</code>,{" "}
              <code className="font-mono">0.0.0.0/0</code> (tout autoriser)
            </p>
          </div>

          {/* Add new entry */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">Ajouter une plage</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Adresse IP / CIDR</Label>
                <Input
                  placeholder="192.168.0.0/24"
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label (optionnel)</Label>
                <Input
                  placeholder="Bureau principal"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="text-sm"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newInput.trim()}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>

          {/* Entries list */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
              Aucune restriction d&apos;IP — toutes les adresses sont autorisées
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Switch
                      checked={entry.enabled}
                      onCheckedChange={(v) => handleToggle(idx, v)}
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">
                        {entry.address}
                        {entry.cidr}
                      </p>
                      {entry.label && (
                        <p className="text-xs text-muted-foreground">
                          {entry.label}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="secondary"
                      className={`text-xs border-0 ${
                        entry.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {entry.enabled ? "Actif" : "Inactif"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:bg-red-50"
                      onClick={() => handleRemove(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Sauvegarder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
