"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { orgApi } from "@/lib/api/org";
import type {
  OrgNode,
  Assignment,
  Person,
  PermissionProfile,
} from "@/types/org";
import { Save, UserPlus, Shield } from "lucide-react";
import { toast } from "sonner";

interface NodeDetailSheetProps {
  node: OrgNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNodeUpdated?: (node: OrgNode) => void;
}

type AssignmentWithPerson = Assignment & { person?: Person };

const MODULE_LABELS: Record<string, string> = {
  drive: "Drive",
  calendar: "Calendrier",
  mail: "Messagerie",
  chat: "Chat",
  billing: "Facturation",
  admin: "Administration",
  tasks: "Tâches",
  contacts: "Contacts",
};

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  holder: "Titulaire",
  interim: "Intérimaire",
  deputy: "Adjoint",
  intern: "Stagiaire",
  contractor: "Prestataire",
};

export function NodeDetailSheet({
  node,
  open,
  onOpenChange,
  onNodeUpdated,
}: NodeDetailSheetProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [assignments, setAssignments] = useState<AssignmentWithPerson[]>([]);
  const [permissions, setPermissions] = useState<PermissionProfile | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("details");
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    if (node) {
      setName(node.name);
      setCode(node.code ?? "");
      setDescription(node.description ?? "");
    }
  }, [node]);

  const loadAssignments = useCallback(async () => {
    if (!node) return;
    setAssignmentsLoading(true);
    try {
      const res = await orgApi.nodes.assignments(node.id);
      setAssignments((res.data ?? []) as AssignmentWithPerson[]);
    } catch {
      // silent
    } finally {
      setAssignmentsLoading(false);
    }
  }, [node]);

  const loadPermissions = useCallback(async () => {
    if (!node) return;
    try {
      const res = await orgApi.nodes.permissions(node.id);
      setPermissions(res.data ?? null);
    } catch {
      setPermissions(null);
    }
  }, [node]);

  useEffect(() => {
    if (open && node) {
      if (tab === "assignments") loadAssignments();
      if (tab === "permissions") loadPermissions();
    }
  }, [open, node, tab, loadAssignments, loadPermissions]);

  const handleSave = async () => {
    if (!node) return;
    setSaving(true);
    try {
      const res = await orgApi.nodes.update(node.id, {
        name,
        code: code || undefined,
        description: description || undefined,
      });
      toast.success("Noeud mis à jour");
      onNodeUpdated?.(res.data!);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleModule = async (moduleKey: string, value: boolean) => {
    if (!node) return;
    const current = permissions ?? {
      id: "",
      node_id: node.id,
      inherit: true,
      modules: {},
      max_role: "user",
      custom_permissions: {},
    };
    const updated = {
      ...current,
      modules: { ...current.modules, [moduleKey]: value },
    };
    setPermissions(updated);
    try {
      await orgApi.nodes.setPermissions(node.id, updated);
      toast.success("Permissions mises à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour des permissions");
    }
  };

  const handleMaxRoleChange = async (value: string) => {
    if (!node) return;
    const current = permissions ?? {
      id: "",
      node_id: node.id,
      inherit: true,
      modules: {},
      max_role: "user",
      custom_permissions: {},
    };
    const updated = { ...current, max_role: value };
    setPermissions(updated);
    try {
      await orgApi.nodes.setPermissions(node.id, updated);
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (!node) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg">{node.name}</SheetTitle>
          <SheetDescription className="text-xs font-mono text-muted-foreground">
            {node.node_type} {node.code ? `· ${node.code}` : ""}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="details" className="flex-1">
              Détails
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex-1">
              Affectations
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex-1">
              Permissions
            </TabsTrigger>
          </TabsList>

          {/* ── Détails ── */}
          <TabsContent value="details" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="node-name">Nom</Label>
              <Input
                id="node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du noeud"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-code">Code</Label>
              <Input
                id="node-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: DRH, IT, SALES"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-desc">Description</Label>
              <Textarea
                id="node-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle..."
                rows={3}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </div>
          </TabsContent>

          {/* ── Affectations ── */}
          <TabsContent value="assignments" className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {assignments.length} personne(s) affectée(s)
              </p>
              <Button size="sm" variant="outline">
                <UserPlus className="h-4 w-4 mr-1" />
                Affecter
              </Button>
            </div>
            {assignmentsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Chargement...
              </p>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                Aucune affectation pour ce noeud
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {a.person
                          ? `${a.person.first_name[0]}${a.person.last_name[0]}`
                          : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.person
                          ? `${a.person.first_name} ${a.person.last_name}`
                          : a.person_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.start_date).toLocaleDateString("fr-FR")}
                        {a.end_date
                          ? ` → ${new Date(a.end_date).toLocaleDateString("fr-FR")}`
                          : " · En cours"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {ASSIGNMENT_TYPE_LABELS[a.assignment_type] ??
                        a.assignment_type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Permissions ── */}
          <TabsContent value="permissions" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Modules accessibles</p>
            </div>
            <div className="space-y-3">
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-1"
                >
                  <Label
                    htmlFor={`module-${key}`}
                    className="text-sm cursor-pointer"
                  >
                    {label}
                  </Label>
                  <Switch
                    id={`module-${key}`}
                    checked={permissions?.modules?.[key] ?? false}
                    onCheckedChange={(checked) =>
                      handleToggleModule(key, checked)
                    }
                  />
                </div>
              ))}
            </div>
            <div className="pt-2 space-y-2">
              <Label>Rôle maximum</Label>
              <Select
                value={permissions?.max_role ?? "user"}
                onValueChange={handleMaxRoleChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Lecteur</SelectItem>
                  <SelectItem value="user">Utilisateur</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {permissions && (
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  id="inherit-perms"
                  checked={permissions.inherit}
                  onCheckedChange={(checked) =>
                    setPermissions((p) => (p ? { ...p, inherit: checked } : p))
                  }
                />
                <Label
                  htmlFor="inherit-perms"
                  className="text-sm cursor-pointer"
                >
                  Hériter des permissions du noeud parent
                </Label>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
