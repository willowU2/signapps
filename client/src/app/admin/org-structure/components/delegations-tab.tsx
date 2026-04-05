"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCheck, Plus, Ban } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type { OrgDelegation, Person } from "@/types/org";

// =============================================================================
// DelegationsTab (focus mode only)
// =============================================================================

export interface DelegationsTabProps {
  nodeId: string;
  persons: Person[];
}

export function DelegationsTab({ nodeId, persons }: DelegationsTabProps) {
  const [delegations, setDelegations] = useState<OrgDelegation[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [delegateId, setDelegateId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    read: true,
    write: false,
    manage_assignments: false,
    manage_children: false,
    manage_policies: false,
    delegate: false,
  });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadDelegations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.delegations.list();
      const all = res.data ?? [];
      setDelegations(all.filter((d) => d.scope_node_id === nodeId));
    } catch {
      setDelegations([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    loadDelegations();
  }, [loadDelegations]);

  const handleCreate = async () => {
    if (!delegateId) return;
    setCreating(true);
    try {
      await orgApi.delegations.create({
        delegate_type: "person",
        delegate_id: delegateId,
        scope_node_id: nodeId,
        permissions,
        depth: 0,
        expires_at: expiresAt || undefined,
        is_active: true,
      });
      toast.success("Delegation creee");
      setCreateOpen(false);
      setDelegateId("");
      setExpiresAt("");
      setPermissions({
        read: true,
        write: false,
        manage_assignments: false,
        manage_children: false,
        manage_policies: false,
        delegate: false,
      });
      loadDelegations();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await orgApi.delegations.revoke(id);
      toast.success("Delegation revoquee");
      loadDelegations();
    } catch {
      toast.error("Erreur lors de la revocation");
    } finally {
      setRevoking(null);
    }
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement des delegations...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {delegations.length} delegation(s) active(s)
        </p>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle delegation
        </Button>
      </div>

      {delegations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune delegation pour ce noeud</p>
        </div>
      ) : (
        <div className="space-y-2">
          {delegations.map((d) => {
            const permKeys = Object.entries(d.permissions)
              .filter(([, v]) => v)
              .map(([k]) => k);
            const date = d.expires_at ? new Date(d.expires_at) : null;
            return (
              <div
                key={d.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <UserCheck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {d.delegate_id.slice(0, 8)}...
                    <span className="text-xs text-muted-foreground ml-2">
                      ({d.delegate_type})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {permKeys.map((k) => (
                      <Badge
                        key={k}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {k}
                      </Badge>
                    ))}
                  </div>
                  {date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expire: {date.toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive h-7"
                  onClick={() => handleRevoke(d.id)}
                  disabled={revoking === d.id}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" />
                  {revoking === d.id ? "..." : "Revoquer"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create delegation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle delegation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Personne delegataire *</Label>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(permissions).map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                  >
                    <Checkbox
                      checked={permissions[key]}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <span className="text-sm capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delegation-expires">Date d&apos;expiration</Label>
              <Input
                id="delegation-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating || !delegateId}>
              {creating ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
