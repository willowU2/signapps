"use client";

/**
 * SO8 — Fiche détail ressource.
 *
 * Hero: kind + nom + statut + QR. Onglets: Détails / Attribution / Historique.
 * Actions rapides: Transition de statut, Archive, Rotate QR, Print QR (A4).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { orgApi } from "@/lib/api/org";
import type { Resource, ResourceStatus, ResourceStatusLog } from "@/types/org";
import {
  ArrowLeft,
  Printer,
  RotateCcw,
  Trash2,
  QrCode,
  History,
  ArrowRightLeft,
  Users,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import { AssignDialog } from "@/components/resources/assign-dialog";
import { AclTable } from "@/components/resources/acl-table";
import type { ResourceAssignment, ResourceRenewal } from "@/types/org";

const STATUS_LABELS: Record<ResourceStatus, string> = {
  ordered: "Commandée",
  active: "En service",
  loaned: "Prêtée",
  in_maintenance: "En maintenance",
  returned: "Rendue",
  retired: "Retirée",
};

const VALID_NEXT: Record<ResourceStatus, ResourceStatus[]> = {
  ordered: ["active", "retired"],
  active: ["loaned", "in_maintenance", "returned", "retired"],
  loaned: ["active", "returned", "retired"],
  in_maintenance: ["active", "retired"],
  returned: ["active", "retired"],
  retired: [],
};

export default function ResourceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  usePageTitle("Ressource");

  const [resource, setResource] = useState<Resource | null>(null);
  const [history, setHistory] = useState<ResourceStatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [target, setTarget] = useState<ResourceStatus>("active");
  const [reason, setReason] = useState("");

  // SO9
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([]);
  const [renewals, setRenewals] = useState<ResourceRenewal[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, hRes] = await Promise.all([
        orgApi.resources.get(id),
        orgApi.resources.history(id),
      ]);
      setResource(rRes.data);
      setHistory(hRes.data ?? []);
      // SO9 — parallel fetch, tolerate failure (if SO9 not deployed).
      try {
        const [aRes, reRes] = await Promise.all([
          orgApi.resources.assignments.list(id),
          orgApi.resources.renewals.list(id),
        ]);
        setAssignments(aRes.data.assignments ?? []);
        setRenewals(reRes.data ?? []);
      } catch (inner) {
        console.warn("SO9 fetch failed (optional)", inner);
        setAssignments([]);
        setRenewals([]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Ressource introuvable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const allowedTargets = useMemo(
    () => (resource ? VALID_NEXT[resource.status] : []),
    [resource],
  );

  const handleTransition = async () => {
    if (!resource) return;
    try {
      const res = await orgApi.resources.transition(resource.id, {
        to: target,
        reason: reason || undefined,
      });
      toast.success(`Statut → ${STATUS_LABELS[target]}`);
      setResource(res.data);
      setTransitionOpen(false);
      setReason("");
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Transition refusée");
    }
  };

  const handleRotate = async () => {
    if (!resource) return;
    try {
      const res = await orgApi.resources.rotateQr(resource.id);
      setResource(res.data);
      toast.success("QR token régénéré");
    } catch (e) {
      console.error(e);
      toast.error("Échec de la rotation");
    }
  };

  const handleArchive = async () => {
    if (!resource) return;
    if (!confirm("Archiver cette ressource ?")) return;
    try {
      await orgApi.resources.archive(resource.id);
      toast.success("Ressource archivée");
      router.push("/admin/resources");
    } catch (e) {
      console.error(e);
      toast.error("Archivage refusé");
    }
  };

  /**
   * Open a printable window with a 3x3 grid of QR codes for this resource.
   * Uses DOM API (no document.write) so we stay CSP-safe.
   */
  const handlePrintQr = () => {
    if (!resource?.qr_token) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    const doc = w.document;
    doc.title = `QR — ${resource.name}`;
    const qrUrl = `${window.location.origin}/public/resource/${resource.qr_token}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`;

    const style = doc.createElement("style");
    style.textContent = `
      body { font-family: system-ui, sans-serif; padding: 2em; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1em; }
      .card { border: 1px solid #ccc; padding: 1em; text-align: center; }
      .card img { width: 180px; height: 180px; }
      .slug { font-size: 0.7em; color: #666; margin-top: 0.5em; word-break: break-all; }
      @media print { body { padding: 0.5em; } .grid { gap: 0.5em; } }
    `;
    doc.head.appendChild(style);

    const h2 = doc.createElement("h2");
    h2.textContent = resource.name;
    doc.body.appendChild(h2);

    const grid = doc.createElement("div");
    grid.className = "grid";
    for (let i = 0; i < 9; i++) {
      const card = doc.createElement("div");
      card.className = "card";
      const img = doc.createElement("img");
      img.src = qrImg;
      img.alt = "QR";
      const slug = doc.createElement("div");
      slug.className = "slug";
      slug.textContent = resource.slug;
      card.appendChild(img);
      card.appendChild(slug);
      grid.appendChild(card);
    }
    doc.body.appendChild(grid);

    // Trigger print after images have loaded — use window load event.
    w.addEventListener("load", () => w.print());
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 text-muted-foreground">Chargement…</div>
      </AppLayout>
    );
  }

  if (!resource) {
    return (
      <AppLayout>
        <div className="p-6 text-muted-foreground">Ressource introuvable.</div>
      </AppLayout>
    );
  }

  const qrUrl = resource.qr_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/public/resource/${resource.qr_token}`
    : null;

  return (
    <AppLayout>
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/resources">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au catalogue
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl flex items-center gap-3">
                {resource.name}
                <Badge variant="outline" className="text-xs">
                  {resource.kind}
                </Badge>
                <Badge>{STATUS_LABELS[resource.status]}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {resource.slug}
                {resource.serial_or_ref && ` · ${resource.serial_or_ref}`}
              </p>
              {resource.description && (
                <p className="text-sm mt-2">{resource.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                size="sm"
                onClick={() => setTransitionOpen(true)}
                disabled={allowedTargets.length === 0}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Changer statut
              </Button>
              <Button size="sm" variant="outline" onClick={handleRotate}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Rotate QR
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrintQr}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimer QR
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleArchive}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Archiver
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="attribution">Attribution</TabsTrigger>
            <TabsTrigger value="assignments">
              <Users className="h-4 w-4 mr-1" /> Rôles ({assignments.length})
            </TabsTrigger>
            <TabsTrigger value="renewals">
              <CalendarClock className="h-4 w-4 mr-1" /> Renouvellements (
              {renewals.length})
            </TabsTrigger>
            <TabsTrigger value="acl">
              <ShieldCheck className="h-4 w-4 mr-1" /> ACL
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" /> Historique ({history.length})
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="h-4 w-4 mr-1" /> QR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-2">
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                <Row label="Coût d'achat">
                  {resource.purchase_cost_cents != null
                    ? `${(resource.purchase_cost_cents / 100).toLocaleString(
                        "fr-FR",
                      )} ${resource.currency ?? "EUR"}`
                    : "—"}
                </Row>
                <Row label="Date d'achat">{resource.purchase_date ?? "—"}</Row>
                <Row label="Amortissement">
                  {resource.amortization_months
                    ? `${resource.amortization_months} mois`
                    : "—"}
                </Row>
                <Row label="Garantie">{resource.warranty_end_date ?? "—"}</Row>
                <Row label="Prochaine maintenance">
                  {resource.next_maintenance_date ?? "—"}
                </Row>
                <Row label="Attributs">
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(resource.attributes, null, 2)}
                  </pre>
                </Row>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attribution" className="space-y-2">
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                <Row label="Personne">
                  {resource.assigned_to_person_id ?? "—"}
                </Row>
                <Row label="Node">{resource.assigned_to_node_id ?? "—"}</Row>
                <Row label="Site">{resource.primary_site_id ?? "—"}</Row>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Assignments actifs</CardTitle>
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  Ajouter
                </Button>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun assignment.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {assignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 rounded border p-2 text-sm"
                      >
                        <Badge>{a.role}</Badge>
                        <Badge variant="outline">{a.subject_type}</Badge>
                        <code className="font-mono text-xs text-muted-foreground">
                          {a.subject_id.slice(0, 12)}…
                        </code>
                        {a.is_primary && (
                          <Badge variant="secondary">Primary</Badge>
                        )}
                        {a.reason && (
                          <span className="text-xs text-muted-foreground italic">
                            {a.reason}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive"
                          onClick={async () => {
                            await orgApi.resources.assignments.end(
                              resource.id,
                              a.id,
                            );
                            toast.success("Assignment clos");
                            await load();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="renewals" className="space-y-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Renouvellements actifs
                </CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/admin/resources/renewals">Dashboard</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {renewals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun renouvellement suivi.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {renewals.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded border p-2 text-sm"
                      >
                        <Badge variant="outline">{r.kind}</Badge>
                        <span>échéance {r.due_date}</span>
                        <Badge className="ml-auto">{r.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="acl" className="space-y-2">
            <Card>
              <CardContent className="pt-6">
                <AclTable resourceId={resource.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            <Card>
              <CardContent className="pt-6">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune transition.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {history.map((h) => (
                      <li
                        key={h.id}
                        className="flex items-center gap-3 text-sm border-l-2 border-primary pl-3"
                      >
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.at).toLocaleString("fr-FR")}
                        </span>
                        <span>
                          {h.from_status
                            ? `${STATUS_LABELS[h.from_status]} → `
                            : "Création → "}
                          <strong>{STATUS_LABELS[h.to_status]}</strong>
                        </span>
                        {h.reason && (
                          <span className="text-xs text-muted-foreground italic">
                            — {h.reason}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qr" className="space-y-2">
            <Card>
              <CardContent className="pt-6 text-center">
                {qrUrl && resource.qr_token ? (
                  <div className="flex flex-col items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                        qrUrl,
                      )}`}
                      alt="QR"
                      className="border rounded"
                      width={240}
                      height={240}
                    />
                    <p className="text-xs font-mono break-all">
                      {resource.qr_token}
                    </p>
                    <p className="text-xs text-muted-foreground">{qrUrl}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucun QR token — appuyez sur &quot;Rotate QR&quot;.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AssignDialog
        resourceId={resource.id}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onCreated={() => load()}
      />

      <Dialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nouvel état</Label>
              <Select
                value={target}
                onValueChange={(v) => setTarget(v as ResourceStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedTargets.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motif (facultatif)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Exemple: Prêt 2 semaines"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleTransition}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
