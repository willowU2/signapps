"use client";

/**
 * SO9 — Liste des ACLs explicites sur une ressource avec actions
 * "ajouter / supprimer / tester".
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orgApi } from "@/lib/api/org";
import type { Acl, AclEffect, AclSubjectType } from "@/types/org";
import { ShieldPlus, Trash2, FlaskConical } from "lucide-react";
import { AclTestDialog } from "./acl-test-dialog";

const SUBJECT_LABELS: Record<AclSubjectType, string> = {
  person: "Personne",
  group: "Groupe",
  role: "Rôle global",
  everyone: "Tout le monde",
  auth_user: "Authentifiés",
};

const ACTION_OPTIONS = [
  "read",
  "update",
  "assign",
  "unassign",
  "transition",
  "renew",
  "delete",
  "*",
];

interface AclTableProps {
  resourceId: string;
  resourceType?: string;
}

export function AclTable({
  resourceId,
  resourceType = "resource",
}: AclTableProps) {
  const [rows, setRows] = useState<Acl[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  // Add form state
  const [subjectType, setSubjectType] = useState<AclSubjectType>("person");
  const [subjectId, setSubjectId] = useState("");
  const [subjectRef, setSubjectRef] = useState("");
  const [action, setAction] = useState("read");
  const [effect, setEffect] = useState<AclEffect>("allow");
  const [reason, setReason] = useState("");

  const reload = async () => {
    try {
      setLoading(true);
      const res = await orgApi.acl.list({
        resource_type: resourceType,
        resource_id: resourceId,
      });
      // Also include wildcard rules applicable to this type.
      const wildcards = await orgApi.acl.list({
        resource_type: resourceType,
      });
      const combined = new Map<string, Acl>();
      for (const a of res.data) combined.set(a.id, a);
      for (const a of wildcards.data)
        if (a.resource_id === null || !a.resource_id) combined.set(a.id, a);
      setRows(Array.from(combined.values()));
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, resourceType]);

  const submit = async () => {
    const payload: Parameters<typeof orgApi.acl.create>[0] = {
      subject_type: subjectType,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      effect,
      reason: reason.trim() || undefined,
    };
    if (subjectType === "person" || subjectType === "group") {
      if (!subjectId.trim()) {
        toast.error("UUID du sujet requis");
        return;
      }
      payload.subject_id = subjectId.trim();
    }
    if (subjectType === "role") {
      if (!subjectRef.trim()) {
        toast.error("Nom de rôle requis");
        return;
      }
      payload.subject_ref = subjectRef.trim();
    }
    try {
      await orgApi.acl.create(payload);
      toast.success("Règle ajoutée");
      setAddOpen(false);
      setSubjectId("");
      setSubjectRef("");
      setReason("");
      reload();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail ?? "Création refusée");
    }
  };

  const removeOne = async (id: string) => {
    try {
      await orgApi.acl.delete(id);
      toast.success("Règle supprimée");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Suppression échouée");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Permissions explicites</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTestOpen(true)}>
            <FlaskConical className="mr-1 h-4 w-4" /> Tester
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <ShieldPlus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sujet</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Effet</TableHead>
              <TableHead>Portée</TableHead>
              <TableHead>Raison</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-6"
                >
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-6"
                >
                  Aucune règle explicite
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {SUBJECT_LABELS[r.subject_type]}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.subject_id?.slice(0, 8) ?? r.subject_ref ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {r.action}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={r.effect === "allow" ? "default" : "destructive"}
                  >
                    {r.effect}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.resource_id ? "Cette ressource" : "Toutes (wildcard)"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                  {r.reason ?? "—"}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeOne(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle règle ACL</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type de sujet</Label>
              <Select
                value={subjectType}
                onValueChange={(v) => setSubjectType(v as AclSubjectType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBJECT_LABELS) as AclSubjectType[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {SUBJECT_LABELS[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            {(subjectType === "person" || subjectType === "group") && (
              <div>
                <Label>UUID du sujet</Label>
                <Input
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  placeholder="00000000-…"
                />
              </div>
            )}
            {subjectType === "role" && (
              <div>
                <Label>Nom de rôle</Label>
                <Input
                  value={subjectRef}
                  onChange={(e) => setSubjectRef(e.target.value)}
                  placeholder="vehicle_manager"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Action</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Effet</Label>
                <Select
                  value={effect}
                  onValueChange={(v) => setEffect(v as AclEffect)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Raison</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Documentation de la règle"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AclTestDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        resourceId={resourceId}
        resourceType={resourceType}
      />
    </div>
  );
}
