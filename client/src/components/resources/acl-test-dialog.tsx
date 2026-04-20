"use client";

/**
 * SO9 — Dialog de test ACL.
 *
 * Affiche le résultat d'un `POST /org/acl/test` : effet (allow/deny),
 * source consolidée et l'arbre des règles qui matchent (ACL + héritage).
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { orgApi } from "@/lib/api/org";
import type { TestAclResponse, AclAction } from "@/types/org";
import { ShieldCheck, ShieldX } from "lucide-react";

const ACTIONS: AclAction[] = [
  "read",
  "update",
  "assign",
  "unassign",
  "transition",
  "renew",
  "delete",
];

interface AclTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId?: string;
  resourceType?: string;
}

export function AclTestDialog({
  open,
  onOpenChange,
  resourceId,
  resourceType = "resource",
}: AclTestDialogProps) {
  const [personId, setPersonId] = useState("");
  const [action, setAction] = useState<AclAction>("read");
  const [roles, setRoles] = useState("");
  const [groupIds, setGroupIds] = useState("");
  const [result, setResult] = useState<TestAclResponse | null>(null);
  const [testing, setTesting] = useState(false);

  const run = async () => {
    if (!personId.trim()) {
      toast.error("UUID person requis");
      return;
    }
    try {
      setTesting(true);
      const res = await orgApi.acl.test({
        subject_type: "person",
        subject_id: personId.trim(),
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        roles: roles.trim()
          ? roles
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        group_ids: groupIds.trim()
          ? groupIds
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      });
      setResult(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Test échoué");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tester les permissions</DialogTitle>
          <DialogDescription>
            Résout la décision ACL pour un utilisateur donné en combinant ACL
            explicites + héritage via assignments.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>UUID person</Label>
            <Input
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Action</Label>
              <Select
                value={action}
                onValueChange={(v) => setAction(v as AclAction)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resource type</Label>
              <Input value={resourceType} disabled />
            </div>
          </div>
          <div>
            <Label>Rôles (séparés par virgule)</Label>
            <Input
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              placeholder="vehicle_manager, badge_manager"
            />
          </div>
          <div>
            <Label>Group IDs (UUIDs séparés par virgule)</Label>
            <Input
              value={groupIds}
              onChange={(e) => setGroupIds(e.target.value)}
              placeholder="uuid1, uuid2"
            />
          </div>
          <Button onClick={run} disabled={testing} className="w-full">
            {testing ? "Test…" : "Évaluer"}
          </Button>

          {result && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                {result.effect === "allow" ? (
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                ) : (
                  <ShieldX className="h-5 w-5 text-red-600" />
                )}
                <span className="font-semibold capitalize">
                  {result.effect}
                </span>
                <Badge variant="outline" className="ml-auto">
                  source: {result.source}
                </Badge>
              </div>

              {result.matched_acls.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    ACL matchées
                  </div>
                  <ul className="space-y-1 text-sm">
                    {result.matched_acls.map((m, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge
                          variant={
                            m.effect === "allow" ? "default" : "destructive"
                          }
                          className="shrink-0"
                        >
                          {m.effect}
                        </Badge>
                        <span className="text-muted-foreground">
                          {m.subject_type ?? m.source} — {m.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.inherited_reasons.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    Héritage via assignments
                  </div>
                  <ul className="space-y-1 text-sm">
                    {result.inherited_reasons.map((m, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge
                          variant={
                            m.effect === "allow" ? "default" : "destructive"
                          }
                          className="shrink-0"
                        >
                          {m.role}
                        </Badge>
                        <span className="text-muted-foreground">
                          {m.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.matched_acls.length === 0 &&
                result.inherited_reasons.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucune règle n'a matché — fallback implicit deny.
                  </p>
                )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
