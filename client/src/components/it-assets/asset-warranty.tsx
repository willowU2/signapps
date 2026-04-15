"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldCheck,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
} from "lucide-react";
import {
  format,
  isPast,
  isWithinInterval,
  addDays,
  differenceInDays,
} from "date-fns";

export interface WarrantyContract {
  id: string;
  asset_id: string;
  type: "warranty" | "support" | "license" | "insurance";
  vendor: string;
  contract_number?: string;
  start_date: string;
  end_date: string;
  notes?: string;
}

interface Props {
  assetId: string;
  assetName: string;
}

const TYPE_LABELS: Record<string, string> = {
  warranty: "Warranty",
  support: "Support Contract",
  license: "License",
  insurance: "Insurance",
};

function getContractStatus(endDate: string) {
  const d = new Date(endDate);
  const now = new Date();
  if (isPast(d))
    return {
      label: "Expired",
      icon: AlertTriangle,
      color: "bg-red-500/10 text-red-600 border-red-500/20",
      iconColor: "text-red-500",
    };
  const soonBoundary = addDays(now, 30);
  if (isWithinInterval(d, { start: now, end: soonBoundary })) {
    return {
      label: `Expires in ${differenceInDays(d, now)}d`,
      icon: Clock,
      color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      iconColor: "text-orange-500",
    };
  }
  return {
    label: "Active",
    icon: CheckCircle,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    iconColor: "text-emerald-500",
  };
}

export function AssetWarranty({ assetId, assetName }: Props) {
  const [contracts, setContracts] = useState<WarrantyContract[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    type: "warranty",
    vendor: "",
    contract_number: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const expiringSoon = useMemo(
    () =>
      contracts.filter((c) => {
        const d = new Date(c.end_date);
        return (
          !isPast(d) &&
          isWithinInterval(d, {
            start: new Date(),
            end: addDays(new Date(), 30),
          })
        );
      }).length,
    [contracts],
  );

  const handleAdd = () => {
    if (!form.vendor.trim() || !form.end_date) return;
    const entry: WarrantyContract = {
      id: Date.now().toString(),
      asset_id: assetId,
      type: form.type as WarrantyContract["type"],
      vendor: form.vendor,
      contract_number: form.contract_number || undefined,
      start_date: form.start_date || new Date().toISOString().slice(0, 10),
      end_date: form.end_date,
      notes: form.notes || undefined,
    };
    setContracts((c) => [...c, entry]);
    setForm({
      type: "warranty",
      vendor: "",
      contract_number: "",
      start_date: "",
      end_date: "",
      notes: "",
    });
    setDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
          Warranty &amp; Contracts
          {expiringSoon > 0 && (
            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 ml-1">
              {expiringSoon} expiring
            </Badge>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {contracts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No warranties or contracts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => {
              const s = getContractStatus(c.end_date);
              const Icon = s.icon;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${s.iconColor} shrink-0`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {TYPE_LABELS[c.type] ?? c.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs border ${s.color}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.vendor}
                        {c.contract_number ? ` · #${c.contract_number}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires: {format(new Date(c.end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() =>
                      setContracts((cs) => cs.filter((x) => x.id !== c.id))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Contract — {assetName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Vendor *</Label>
                <Input
                  placeholder="e.g. Dell ProSupport"
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendor: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contract #</Label>
                <Input
                  placeholder="Optional"
                  value={form.contract_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contract_number: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!form.vendor.trim() || !form.end_date}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
